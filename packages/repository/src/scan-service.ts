import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@codemri/db";
import {
  repositories,
  scanJobs,
  scanMetrics,
  scanProgressEvents,
  scans,
  users
} from "@codemri/db/schema";
import {
  closeScanQueues,
  createQueueConnection,
  createScanQueues,
  enqueueCloneJob
} from "@codemri/queue";
import type { ScanJobData, ScanStage } from "@codemri/types";

import { getGitHubRepositoryMetadata } from "./github";

type DrizzleDatabase = Database["database"];
type DatabaseInsertExecutor = Pick<DrizzleDatabase, "insert">;

const actorSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(256).nullable().optional(),
  image: z.string().url().nullable().optional()
});

const createScanInputSchema = z.object({
  repositoryUrl: z.string().url().max(2_048),
  branch: z.string().min(1).max(255).optional()
});

export type AuthenticatedActor = z.infer<typeof actorSchema>;
export type CreateScanInput = z.infer<typeof createScanInputSchema>;

export class ScanQueueError extends Error {}

function assertReturned<T>(value: T | undefined, message: string): T {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

async function upsertActor(database: DatabaseInsertExecutor, actor: AuthenticatedActor) {
  const [user] = await database
    .insert(users)
    .values({
      email: actor.email.toLowerCase(),
      name: actor.name ?? null,
      image: actor.image ?? null
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: actor.name ?? null,
        image: actor.image ?? null,
        updatedAt: new Date()
      }
    })
    .returning({ id: users.id, email: users.email });

  return assertReturned(user, "Unable to create the authenticated user record.");
}

export async function createRepositoryImport({
  actor: rawActor,
  input: rawInput,
  database,
  redisUrl,
  githubToken
}: {
  actor: AuthenticatedActor;
  input: CreateScanInput;
  database: DrizzleDatabase;
  redisUrl: string;
  githubToken?: string;
}) {
  const actor = actorSchema.parse(rawActor);
  const input = createScanInputSchema.parse(rawInput);
  const metadata = await getGitHubRepositoryMetadata(input.repositoryUrl, githubToken);
  const branch = input.branch ?? metadata.defaultBranch;

  const created = await database.transaction(async (transaction) => {
    const user = await upsertActor(transaction, actor);
    const [repository] = await transaction
      .insert(repositories)
      .values({
        userId: user.id,
        provider: "github",
        providerRepositoryId: metadata.id,
        owner: metadata.owner,
        name: metadata.name,
        fullName: `${metadata.owner}/${metadata.name}`,
        url: metadata.canonicalUrl,
        cloneUrl: metadata.cloneUrl,
        defaultBranch: branch,
        visibility: metadata.visibility,
        status: "pending"
      })
      .onConflictDoUpdate({
        target: [repositories.userId, repositories.provider, repositories.providerRepositoryId],
        set: {
          owner: metadata.owner,
          name: metadata.name,
          fullName: `${metadata.owner}/${metadata.name}`,
          url: metadata.canonicalUrl,
          cloneUrl: metadata.cloneUrl,
          defaultBranch: branch,
          visibility: metadata.visibility,
          status: "pending",
          updatedAt: new Date()
        }
      })
      .returning();
    const persistedRepository = assertReturned(
      repository,
      "Unable to save the imported repository."
    );

    const [scan] = await transaction
      .insert(scans)
      .values({
        repositoryId: persistedRepository.id,
        requestedByUserId: user.id,
        status: "queued",
        currentStage: "clone",
        progress: 0
      })
      .returning();
    const persistedScan = assertReturned(scan, "Unable to create a scan.");

    const [job] = await transaction
      .insert(scanJobs)
      .values({
        scanId: persistedScan.id,
        stage: "clone",
        status: "queued",
        bullmqJobId: persistedScan.id
      })
      .returning();
    const persistedJob = assertReturned(job, "Unable to create a scan job.");

    await transaction.insert(scanProgressEvents).values({
      scanId: persistedScan.id,
      stage: "clone",
      status: "queued",
      progress: 0,
      message: "Repository import accepted. Waiting to clone the default branch."
    });

    return { user, repository: persistedRepository, scan: persistedScan, job: persistedJob };
  });

  const queueConnection = createQueueConnection(redisUrl);
  const queues = createScanQueues(queueConnection);
  const queueData: ScanJobData = {
    scanId: created.scan.id,
    repositoryId: created.repository.id,
    requestedByUserId: created.user.id,
    stage: "clone",
    attempt: 0
  };

  try {
    await enqueueCloneJob(queues.clone, queueData, created.job.bullmqJobId);
  } catch {
    await markQueueFailure(database, created.scan.id, created.job.id);
    throw new ScanQueueError("The import was saved but could not be queued. Please try again.");
  } finally {
    await closeScanQueues(queues);
    await queueConnection.quit();
  }

  return {
    repository: {
      id: created.repository.id,
      fullName: created.repository.fullName,
      branch: created.repository.defaultBranch,
      url: created.repository.url
    },
    scan: {
      id: created.scan.id,
      status: created.scan.status,
      currentStage: created.scan.currentStage,
      progress: created.scan.progress
    }
  };
}

async function markQueueFailure(database: DrizzleDatabase, scanId: string, jobId: string) {
  const message = "The clone job could not be added to Redis.";

  await database.transaction(async (transaction) => {
    await transaction
      .update(scans)
      .set({ status: "failed", errorMessage: message, updatedAt: new Date() })
      .where(eq(scans.id, scanId));
    await transaction
      .update(scanJobs)
      .set({
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(scanJobs.id, jobId));
    await transaction.insert(scanProgressEvents).values({
      scanId,
      stage: "clone",
      status: "failed",
      progress: 0,
      message
    });
  });
}

export async function listScansForActor(database: DrizzleDatabase, email: string) {
  const [user] = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    return [];
  }

  return database
    .select({
      id: scans.id,
      status: scans.status,
      currentStage: scans.currentStage,
      progress: scans.progress,
      errorMessage: scans.errorMessage,
      createdAt: scans.createdAt,
      completedAt: scans.completedAt,
      repositoryId: repositories.id,
      repositoryName: repositories.fullName,
      repositoryUrl: repositories.url,
      repositoryStatus: repositories.status,
      branch: repositories.defaultBranch
    })
    .from(scans)
    .innerJoin(repositories, eq(scans.repositoryId, repositories.id))
    .where(eq(repositories.userId, user.id))
    .orderBy(desc(scans.createdAt));
}

export async function getScanProgressForActor(
  database: DrizzleDatabase,
  scanId: string,
  email: string
) {
  const [user] = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    return undefined;
  }

  const [scan] = await database
    .select({
      id: scans.id,
      status: scans.status,
      currentStage: scans.currentStage,
      progress: scans.progress,
      errorMessage: scans.errorMessage,
      createdAt: scans.createdAt,
      startedAt: scans.startedAt,
      completedAt: scans.completedAt,
      repositoryName: repositories.fullName,
      repositoryUrl: repositories.url,
      branch: repositories.defaultBranch,
      repositoryStatus: repositories.status
    })
    .from(scans)
    .innerJoin(repositories, eq(scans.repositoryId, repositories.id))
    .where(and(eq(scans.id, scanId), eq(repositories.userId, user.id)))
    .limit(1);

  if (!scan) {
    return undefined;
  }

  const [events, jobs] = await Promise.all([
    database
      .select({
        id: scanProgressEvents.id,
        stage: scanProgressEvents.stage,
        status: scanProgressEvents.status,
        progress: scanProgressEvents.progress,
        message: scanProgressEvents.message,
        createdAt: scanProgressEvents.createdAt
      })
      .from(scanProgressEvents)
      .where(eq(scanProgressEvents.scanId, scanId))
      .orderBy(desc(scanProgressEvents.createdAt)),
    database
      .select({
        id: scanJobs.id,
        stage: scanJobs.stage,
        status: scanJobs.status,
        attemptCount: scanJobs.attemptCount,
        errorMessage: scanJobs.errorMessage,
        createdAt: scanJobs.createdAt,
        startedAt: scanJobs.startedAt,
        completedAt: scanJobs.completedAt
      })
      .from(scanJobs)
      .where(eq(scanJobs.scanId, scanId))
      .orderBy(desc(scanJobs.createdAt))
  ]);

  return { ...scan, events, jobs };
}

export async function getScanMetricsForActor(
  database: DrizzleDatabase,
  scanId: string,
  email: string
) {
  const [user] = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    return undefined;
  }

  const metrics = await database
    .select({
      metric: scanMetrics.metric,
      score: scanMetrics.score,
      severity: scanMetrics.severity,
      explanation: scanMetrics.explanation,
      evidence: scanMetrics.evidence,
      confidence: scanMetrics.confidence,
      recommendedActions: scanMetrics.recommendedActions
    })
    .from(scanMetrics)
    .innerJoin(scans, eq(scanMetrics.scanId, scans.id))
    .innerJoin(repositories, eq(scans.repositoryId, repositories.id))
    .where(and(eq(scanMetrics.scanId, scanId), eq(repositories.userId, user.id)));

  return metrics;
}

export async function getQueuedCloneJobs(database: DrizzleDatabase) {
  return database
    .select({
      scanId: scans.id,
      repositoryId: scans.repositoryId,
      requestedByUserId: scans.requestedByUserId,
      bullmqJobId: scanJobs.bullmqJobId
    })
    .from(scanJobs)
    .innerJoin(scans, eq(scanJobs.scanId, scans.id))
    .where(and(eq(scanJobs.stage, "clone"), eq(scanJobs.status, "queued")));
}

export async function getCloneJobContext(database: DrizzleDatabase, scanId: string) {
  const [context] = await database
    .select({
      scanId: scans.id,
      jobId: scanJobs.id,
      repositoryId: repositories.id,
      cloneUrl: repositories.cloneUrl,
      branch: repositories.defaultBranch,
      repositoryName: repositories.fullName
    })
    .from(scans)
    .innerJoin(repositories, eq(scans.repositoryId, repositories.id))
    .innerJoin(scanJobs, and(eq(scanJobs.scanId, scans.id), eq(scanJobs.stage, "clone")))
    .where(eq(scans.id, scanId))
    .limit(1);

  return context;
}

export async function markCloneStarted(database: DrizzleDatabase, scanId: string, jobId: string) {
  await database.transaction(async (transaction) => {
    await transaction
      .update(scans)
      .set({
        status: "running",
        currentStage: "clone",
        progress: 5,
        startedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(scans.id, scanId));
    await transaction
      .update(repositories)
      .set({ status: "cloning", updatedAt: new Date() })
      .where(eq(repositories.id, sql`(SELECT repository_id FROM scans WHERE id = ${scanId})`));
    await transaction
      .update(scanJobs)
      .set({
        status: "active",
        attemptCount: sql`${scanJobs.attemptCount} + 1`,
        startedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(scanJobs.id, jobId));
    await transaction.insert(scanProgressEvents).values({
      scanId,
      stage: "clone",
      status: "running",
      progress: 5,
      message: "Cloning the repository into an isolated workspace."
    });
  });
}

export async function markCloneCompleted(
  database: DrizzleDatabase,
  scanId: string,
  jobId: string,
  clone: { clonePath: string; commit: string }
) {
  await database.transaction(async (transaction) => {
    await transaction
      .update(scans)
      .set({
        status: "running",
        currentStage: "parse",
        progress: 20,
        clonePath: clone.clonePath,
        cloneCommit: clone.commit,
        errorMessage: null,
        updatedAt: new Date()
      })
      .where(eq(scans.id, scanId));
    await transaction
      .update(repositories)
      .set({
        status: "ready",
        lastCloneCommit: clone.commit,
        lastClonedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(repositories.id, sql`(SELECT repository_id FROM scans WHERE id = ${scanId})`));
    await transaction
      .update(scanJobs)
      .set({
        status: "completed",
        completedAt: new Date(),
        errorMessage: null,
        updatedAt: new Date()
      })
      .where(eq(scanJobs.id, jobId));
    await transaction.insert(scanProgressEvents).values({
      scanId,
      stage: "clone",
      status: "running",
      progress: 20,
      message: "Repository clone completed. Extracting repository structure."
    });
  });
}

export async function markScanProgress(
  database: DrizzleDatabase,
  scanId: string,
  stage: ScanStage,
  progress: number,
  message: string
) {
  await database.transaction(async (transaction) => {
    await transaction
      .update(scans)
      .set({ status: "running", currentStage: stage, progress, updatedAt: new Date() })
      .where(eq(scans.id, scanId));
    await transaction.insert(scanProgressEvents).values({
      scanId,
      stage,
      status: "running",
      progress,
      message
    });
  });
}

export async function markScanCompleted(database: DrizzleDatabase, scanId: string) {
  await database.transaction(async (transaction) => {
    await transaction
      .update(scans)
      .set({
        status: "completed",
        currentStage: "metrics",
        progress: 100,
        errorMessage: null,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(scans.id, scanId));
    await transaction.insert(scanProgressEvents).values({
      scanId,
      stage: "metrics",
      status: "completed",
      progress: 100,
      message: "Static analysis and repository metrics are ready."
    });
  });
}

export async function markCloneFailure(
  database: DrizzleDatabase,
  scanId: string,
  jobId: string,
  message: string,
  finalAttempt: boolean
) {
  const status = finalAttempt ? "failed" : "queued";
  const progressMessage = finalAttempt
    ? "Repository cloning failed after all retry attempts."
    : "Repository cloning failed; BullMQ will retry this isolated job.";

  await database.transaction(async (transaction) => {
    await transaction
      .update(scans)
      .set({ status, errorMessage: message, updatedAt: new Date() })
      .where(eq(scans.id, scanId));
    await transaction
      .update(repositories)
      .set({ status: finalAttempt ? "failed" : "pending", updatedAt: new Date() })
      .where(eq(repositories.id, sql`(SELECT repository_id FROM scans WHERE id = ${scanId})`));
    await transaction
      .update(scanJobs)
      .set({
        status: finalAttempt ? "failed" : "queued",
        errorMessage: message,
        updatedAt: new Date()
      })
      .where(eq(scanJobs.id, jobId));
    await transaction.insert(scanProgressEvents).values({
      scanId,
      stage: "clone",
      status,
      progress: 5,
      message: progressMessage
    });
  });
}

import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { Queue, Worker } from "bullmq";
import { analyzeRepository, persistRepositoryExtraction } from "@codemri/analyzer";
import { getServerEnvironment } from "@codemri/config/env";
import { getDatabase } from "@codemri/db";
import { computeMetrics, persistMetricsReport } from "@codemri/metrics";
import { createQueueConnection, enqueueCloneJob, getQueueHealth, queueNames } from "@codemri/queue";
import {
  cloneGitHubRepository,
  getCloneJobContext,
  getQueuedCloneJobs,
  markCloneCompleted,
  markCloneFailure,
  markCloneStarted,
  markScanCompleted,
  markScanProgress
} from "@codemri/repository";
import type { ScanJobData, ScanStage } from "@codemri/types";

// The worker runs from apps/worker, while runtime configuration is stored at the monorepo root.
loadDotenv({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });

const environment = getServerEnvironment();
const connection = createQueueConnection(environment.REDIS_URL);
const database = getDatabase(environment.DATABASE_URL).database;
const cloneQueue = new Queue<ScanJobData>(queueNames.clone, { connection });

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The repository scan failed unexpectedly.";
}

const cloneWorker = new Worker<ScanJobData>(
  queueNames.clone,
  async (job) => {
    const context = await getCloneJobContext(database, job.data.scanId);
    if (!context) {
      throw new Error("The queued repository scan no longer exists.");
    }

    let stage: ScanStage = "clone";
    try {
      await markCloneStarted(database, context.scanId, context.jobId);
      const clone = await cloneGitHubRepository({
        cloneUrl: context.cloneUrl,
        branch: context.branch,
        scanId: context.scanId,
        workdir: environment.REPOSITORY_WORKDIR
      });
      await markCloneCompleted(database, context.scanId, context.jobId, clone);

      stage = "parse";
      await markScanProgress(
        database,
        context.scanId,
        stage,
        35,
        "Extracting files, symbols, imports, API routes, and database calls."
      );
      const extraction = await analyzeRepository(clone.clonePath, {
        maxFiles: environment.MAX_REPOSITORY_FILES,
        maxFileBytes: environment.MAX_REPOSITORY_FILE_BYTES
      });
      await persistRepositoryExtraction({
        database,
        scanId: context.scanId,
        repositoryId: context.repositoryId,
        extraction
      });

      stage = "graph";
      await markScanProgress(
        database,
        context.scanId,
        stage,
        70,
        "Building the internal dependency graph."
      );
      stage = "metrics";
      await markScanProgress(
        database,
        context.scanId,
        stage,
        85,
        "Computing repository health and engineering metrics."
      );
      await persistMetricsReport({
        database,
        scanId: context.scanId,
        report: computeMetrics(extraction)
      });
      await markScanCompleted(database, context.scanId);
    } catch (error) {
      const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      await markCloneFailure(
        database,
        context.scanId,
        context.jobId,
        getErrorMessage(error),
        finalAttempt
      );
      throw error;
    }
  },
  { connection, concurrency: 1 }
);

async function reconcileQueuedCloneJobs() {
  const queuedJobs = await getQueuedCloneJobs(database);
  for (const queuedJob of queuedJobs) {
    const existingJob = await cloneQueue.getJob(queuedJob.bullmqJobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (["active", "waiting", "delayed", "prioritized", "waiting-children"].includes(state)) {
        continue;
      }
      await existingJob.remove();
    }

    await enqueueCloneJob(
      cloneQueue,
      {
        scanId: queuedJob.scanId,
        repositoryId: queuedJob.repositoryId,
        requestedByUserId: queuedJob.requestedByUserId,
        stage: "clone",
        attempt: 0
      },
      queuedJob.bullmqJobId
    );
  }

  if (queuedJobs.length > 0) {
    console.info(`Requeued ${queuedJobs.length.toString()} persisted repository scan(s).`);
  }
}

async function start() {
  const health = await getQueueHealth(connection);
  console.info("CodeMRI worker foundation connected to Redis", health);
  await reconcileQueuedCloneJobs();
  console.info("CodeMRI clone, extraction, graph, and metrics worker is ready.");
}

async function shutdown(signal: string) {
  console.info(`Received ${signal}; closing worker foundation.`);
  await cloneWorker.close();
  await cloneQueue.close();
  await connection.quit();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

void start().catch(async (error: unknown) => {
  console.error("Worker startup failed", error);
  await connection.quit();
  process.exitCode = 1;
});

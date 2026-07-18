import { eq } from "drizzle-orm";

import type { Database } from "@codemri/db";
import { repositoryFiles, scanMetrics } from "@codemri/db/schema";

import type { MetricsReport } from "./engine";

type DrizzleDatabase = Database["database"];

export async function persistMetricsReport({
  database,
  scanId,
  report
}: {
  database: DrizzleDatabase;
  scanId: string;
  report: MetricsReport;
}) {
  const files = await database
    .select({ id: repositoryFiles.id, path: repositoryFiles.path })
    .from(repositoryFiles)
    .where(eq(repositoryFiles.scanId, scanId));
  const fileIdByPath = new Map(files.map((file) => [file.path, file.id]));

  await database.transaction(async (transaction) => {
    await transaction.delete(scanMetrics).where(eq(scanMetrics.scanId, scanId));
    await transaction.insert(scanMetrics).values(
      Object.entries(report.metrics).map(([metric, result]) => ({
        scanId,
        metric: metric as (typeof scanMetrics.$inferInsert)["metric"],
        score: result.score,
        severity: result.severity,
        explanation: result.explanation,
        evidence: result.evidence,
        affectedFileIds: result.affectedFiles.flatMap((path) => {
          const id = fileIdByPath.get(path);
          return id ? [id] : [];
        }),
        confidence: result.confidence,
        recommendedActions: result.recommendedActions
      }))
    );
  });

  return report;
}

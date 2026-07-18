export const scanStages = [
  "clone",
  "parse",
  "graph",
  "metrics",
  "embeddings",
  "ai",
  "report"
] as const;

export type ScanStage = (typeof scanStages)[number];

export type ScanStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type RepositoryStatus = "pending" | "cloning" | "ready" | "failed";

export type ScanJobStatus = "queued" | "active" | "completed" | "failed";

/**
 * A stable boundary between a future scan orchestration layer and its workers.
 * It deliberately contains no repository-analysis implementation.
 */
export interface ScanJobData {
  scanId: string;
  repositoryId: string;
  requestedByUserId: string;
  stage: ScanStage;
  attempt: number;
}

export interface QueueHealth {
  connected: boolean;
  checkedAt: string;
}

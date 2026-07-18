import { Queue, type DefaultJobOptions } from "bullmq";
import IORedis from "ioredis";

import { scanStages, type ScanJobData, type ScanStage } from "@codemri/types";

const queuePrefix = "codemri";

export const queueNames = Object.fromEntries(
  // BullMQ reserves ':' as an internal Redis key separator, so queue names must not contain it.
  scanStages.map((stage) => [stage, `${queuePrefix}-${stage}`])
) as Record<ScanStage, string>;

const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1_000 },
  removeOnComplete: { age: 86_400, count: 1_000 },
  removeOnFail: { age: 604_800, count: 5_000 }
};

export function createQueueConnection(redisUrl: string) {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
}

export function createScanQueues(connection: IORedis) {
  return Object.fromEntries(
    scanStages.map((stage) => [
      stage,
      new Queue<ScanJobData>(queueNames[stage], { connection, defaultJobOptions })
    ])
  ) as Record<ScanStage, Queue<ScanJobData>>;
}

export async function enqueueCloneJob(queue: Queue<ScanJobData>, data: ScanJobData, jobId: string) {
  return queue.add("clone", data, { jobId });
}

export async function closeScanQueues(queues: Record<ScanStage, Queue<ScanJobData>>) {
  await Promise.all(Object.values(queues).map((queue) => queue.close()));
}

/** Queue infrastructure only. Processors are intentionally added with future analysis stages. */
export function getQueueHealth(connection: IORedis) {
  return connection.ping().then(() => ({ connected: true, checkedAt: new Date().toISOString() }));
}

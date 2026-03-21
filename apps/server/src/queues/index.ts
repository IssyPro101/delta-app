import crypto from "node:crypto";

import { Queue } from "bullmq";

import type { IntegrationProvider } from "@pipeline-intelligence/shared";

import { env } from "../utils/env";

export interface WebhookJobData {
  payload: unknown;
  receivedAt: string;
}

export interface BackfillJobData {
  userId: string;
  provider: IntegrationProvider;
}

const redisUrl = new URL(env.redisUrl);

export const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  password: redisUrl.password || undefined,
  username: redisUrl.username || undefined,
};

export const hubspotWebhookQueue = new Queue("webhook.hubspot", { connection });
export const fathomWebhookQueue = new Queue("webhook.fathom", { connection });
export const backfillQueue = new Queue("backfill", { connection });

export async function enqueueHubSpotWebhook(payload: unknown, jobId: string) {
  await hubspotWebhookQueue.add(
    "hubspot-webhook",
    {
      payload,
      receivedAt: new Date().toISOString(),
    } satisfies WebhookJobData,
    {
      jobId,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1_000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}

export async function enqueueFathomWebhook(payload: unknown, jobId: string) {
  await fathomWebhookQueue.add(
    "fathom-webhook",
    {
      payload,
      receivedAt: new Date().toISOString(),
    } satisfies WebhookJobData,
    {
      jobId,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1_000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}

export async function enqueueBackfill(provider: IntegrationProvider, userId: string) {
  const job = await backfillQueue.add(
    `backfill-${provider}`,
    {
      provider,
      userId,
    } satisfies BackfillJobData,
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1_000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );

  return job.id ?? crypto.randomUUID();
}

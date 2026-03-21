import crypto from "node:crypto";

import { env } from "../utils/env";

function normalizeHubSpotUri(url: string): string {
  return decodeURIComponent(url);
}

export function verifyHubSpotSignature(input: {
  method: string;
  protocol: string;
  host: string;
  url: string;
  rawBody: string;
  signature: string | undefined;
  timestamp: string | undefined;
}) {
  if (!env.hubspotWebhookSecret) {
    throw new Error("HubSpot webhook secret is not configured");
  }

  if (!input.signature || !input.timestamp) {
    return false;
  }

  const currentTime = Date.now();
  const timestamp = Number(input.timestamp);

  if (!Number.isFinite(timestamp) || Math.abs(currentTime - timestamp) > 300_000) {
    return false;
  }

  const uri = `${input.protocol}://${input.host}${normalizeHubSpotUri(input.url)}`;
  const rawString = `${input.method.toUpperCase()}${uri}${input.rawBody}${input.timestamp}`;
  const expectedSignature = crypto
    .createHmac("sha256", env.hubspotWebhookSecret)
    .update(rawString)
    .digest("base64");

  const left = Buffer.from(expectedSignature);
  const right = Buffer.from(input.signature);

  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

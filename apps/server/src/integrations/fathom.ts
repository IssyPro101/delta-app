import crypto from "node:crypto";

import { Fathom } from "fathom-typescript";

import { env } from "../utils/env";

const fathomApiBase = "https://fathom.video/external/v1";

function ensureFathomEnv() {
  if (!env.fathomClientId || !env.fathomClientSecret || !env.fathomRedirectUri) {
    throw new Error("Fathom OAuth is not configured");
  }
}

export interface FathomTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface FathomMeetingListResponse {
  items: Array<{
    id: string;
    title?: string;
    url?: string;
    recording_id?: number;
    recording_start_time?: string;
    recording_end_time?: string;
    calendar_invitees?: Array<{
      name?: string;
      email?: string;
      is_external?: boolean;
    }>;
    summary?: string;
    transcript?: string;
    startTime?: string;
    endTime?: string;
  }>;
  next_cursor?: string | null;
}

export function buildFathomState(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function getFathomAuthorizeUrl(state: string): string {
  ensureFathomEnv();

  return Fathom.getAuthorizationUrl({
    clientId: env.fathomClientId!,
    redirectUri: env.fathomRedirectUri!,
    scope: "public_api",
    state,
  });
}

export async function exchangeFathomCode(code: string): Promise<FathomTokenResponse> {
  ensureFathomEnv();

  const response = await fetch(`${fathomApiBase}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: env.fathomClientId!,
      client_secret: env.fathomClientSecret!,
      redirect_uri: env.fathomRedirectUri!,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange Fathom authorization code");
  }

  return (await response.json()) as FathomTokenResponse;
}

export async function refreshFathomAccessToken(refreshToken: string): Promise<FathomTokenResponse> {
  ensureFathomEnv();

  const response = await fetch(`${fathomApiBase}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: env.fathomClientId!,
      client_secret: env.fathomClientSecret!,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Fathom access token");
  }

  return (await response.json()) as FathomTokenResponse;
}

async function fathomRequest<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${fathomApiBase}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Fathom request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function listFathomMeetings(accessToken: string, cursor?: string, includeTranscript = false) {
  const params = new URLSearchParams({
    limit: "100",
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  if (includeTranscript) {
    params.set("include_transcript", "true");
  }

  return fathomRequest<FathomMeetingListResponse>(`/meetings?${params.toString()}`, accessToken);
}

export async function getFathomTranscript(accessToken: string, recordingId: string | number) {
  return fathomRequest<{ transcript?: string }>(`/recordings/${recordingId}/transcript`, accessToken);
}

export async function verifyFathomWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string) {
  if (!env.fathomWebhookSecret) {
    throw new Error("Fathom webhook secret is not configured");
  }

  return Fathom.verifyWebhook(
    env.fathomWebhookSecret,
    {
      "webhook-id": String(headers["webhook-id"] ?? ""),
      "webhook-timestamp": String(headers["webhook-timestamp"] ?? ""),
      "webhook-signature": String(headers["webhook-signature"] ?? ""),
    },
    rawBody,
  );
}

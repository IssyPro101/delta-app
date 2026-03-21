import type { IntegrationProvider, SyncStatusResponse } from "@pipeline-intelligence/shared";

import { serializeIntegration } from "./serializers";
import {
  assertData,
  assertMaybeData,
  assertNoError,
  supabase,
  toIntegrationRecord,
} from "./supabase-utils";
import type { IntegrationRecord } from "./domain-types";
import { decryptSecret, encryptSecret } from "../utils/security";

const syncStates = new Map<string, SyncStatusResponse["status"]>();

function getSyncKey(userId: string, provider: IntegrationProvider): string {
  return `${userId}:${provider}`;
}

export async function listIntegrations(userId: string) {
  const rows = assertData(
    await supabase.from("integrations").select("*").eq("user_id", userId).order("provider", { ascending: true }),
  );
  const integrations = rows.map(toIntegrationRecord);

  return integrations.map(({ access_token: _accessToken, refresh_token: _refreshToken, ...integration }) =>
    serializeIntegration(integration),
  );
}

export async function getIntegration(userId: string, provider: IntegrationProvider) {
  const row = assertMaybeData(
    await supabase.from("integrations").select("*").eq("user_id", userId).eq("provider", provider).maybeSingle(),
  );

  return row ? toIntegrationRecord(row) : null;
}

export async function getAnyConnectedIntegration(provider: IntegrationProvider) {
  const row = assertMaybeData(
    await supabase.from("integrations").select("*").eq("provider", provider).eq("status", "connected").maybeSingle(),
  );

  return row ? toIntegrationRecord(row) : null;
}

export async function upsertIntegration(
  userId: string,
  provider: IntegrationProvider,
  tokens: {
    accessToken: string;
    refreshToken?: string | null;
    status?: IntegrationRecord["status"];
  },
) {
  const row = assertData(
    await supabase
      .from("integrations")
      .upsert(
        {
          user_id: userId,
          provider,
          status: tokens.status ?? "connected",
          access_token: encryptSecret(tokens.accessToken),
          refresh_token: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      )
      .select("*")
      .single(),
  );

  const integration = toIntegrationRecord(row);
  const { access_token: _accessToken, refresh_token: _refreshToken, ...sanitized } = integration;

  return serializeIntegration(sanitized);
}

export async function deleteIntegration(userId: string, provider: IntegrationProvider) {
  assertNoError(await supabase.from("integrations").delete().eq("user_id", userId).eq("provider", provider));
}

export async function updateIntegrationStatus(
  userId: string,
  provider: IntegrationProvider,
  status: IntegrationRecord["status"],
) {
  assertNoError(
    await supabase
      .from("integrations")
      .update({ status })
      .eq("user_id", userId)
      .eq("provider", provider),
  );
}

export function setSyncStatus(userId: string, provider: IntegrationProvider, status: SyncStatusResponse["status"]) {
  syncStates.set(getSyncKey(userId, provider), status);
}

export async function touchIntegrationSync(userId: string, provider: IntegrationProvider) {
  assertNoError(
    await supabase
      .from("integrations")
      .update({ last_synced_at: new Date().toISOString(), status: "connected" })
      .eq("user_id", userId)
      .eq("provider", provider),
  );
}

export async function getSyncStatus(userId: string, provider: IntegrationProvider): Promise<SyncStatusResponse> {
  const integration = await getIntegration(userId, provider);

  return {
    status: syncStates.get(getSyncKey(userId, provider)) ?? "idle",
    last_synced_at: integration?.last_synced_at?.toISOString() ?? null,
  };
}

export function readAccessToken(integration: IntegrationRecord): string {
  return decryptSecret(integration.access_token);
}

export function readRefreshToken(integration: IntegrationRecord): string | null {
  return integration.refresh_token ? decryptSecret(integration.refresh_token) : null;
}

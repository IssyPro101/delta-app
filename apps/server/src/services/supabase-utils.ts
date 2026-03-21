import { supabase, type Database, type Json } from "@pipeline-intelligence/db";

import type {
  DealRecord,
  EventRecord,
  InsightRecord,
  IntegrationRecord,
  StageTransitionRecord,
  UserRecord,
} from "./domain-types";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type IntegrationRow = Database["public"]["Tables"]["integrations"]["Row"];
type DealRow = Database["public"]["Tables"]["deals"]["Row"];
type StageTransitionRow = Database["public"]["Tables"]["stage_transitions"]["Row"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
type InsightRow = Database["public"]["Tables"]["insights"]["Row"];

export { supabase };

export function assertData<T>(
  result: { data: T | null; error: { message: string } | null },
): NonNullable<T> {
  if (result.error) {
    throw new Error(result.error.message);
  }

  if (result.data === null) {
    throw new Error("Expected query data but received null");
  }

  return result.data as NonNullable<T>;
}

export function assertMaybeData<T>(
  result: { data: T; error: { message: string; code?: string } | null },
): T {
  if (result.error && result.error.code !== "PGRST116") {
    throw new Error(result.error.message);
  }

  return result.data;
}

export function assertNoError(result: { error: { message: string } | null }) {
  if (result.error) {
    throw new Error(result.error.message);
  }
}

function toRecordObject(value: Json): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export function toUserRecord(row: UserRow): UserRecord {
  return {
    ...row,
    created_at: new Date(row.created_at),
  };
}

export function toIntegrationRecord(row: IntegrationRow): IntegrationRecord {
  return {
    ...row,
    last_synced_at: row.last_synced_at ? new Date(row.last_synced_at) : null,
    created_at: new Date(row.created_at),
  };
}

export function toDealRecord(row: DealRow): DealRecord {
  return {
    ...row,
    close_date: row.close_date ? new Date(row.close_date) : null,
    closed_at: row.closed_at ? new Date(row.closed_at) : null,
    last_activity: new Date(row.last_activity),
    created_at: new Date(row.created_at),
  };
}

export function toStageTransitionRecord(row: StageTransitionRow): StageTransitionRecord {
  return {
    ...row,
    transitioned_at: new Date(row.transitioned_at),
    created_at: new Date(row.created_at),
  };
}

export function toEventRecord(row: EventRow, deal?: DealRecord | null): EventRecord {
  return {
    ...row,
    occurred_at: new Date(row.occurred_at),
    raw_payload: toRecordObject(row.raw_payload),
    metadata: toRecordObject(row.metadata),
    created_at: new Date(row.created_at),
    deal: deal ?? null,
  };
}

export function toInsightRecord(row: InsightRow): InsightRecord {
  return {
    ...row,
    data: toRecordObject(row.data),
    generated_at: new Date(row.generated_at),
    created_at: new Date(row.created_at),
  };
}

export function toJson(value: Record<string, unknown> | unknown[]): Json {
  return value as Json;
}

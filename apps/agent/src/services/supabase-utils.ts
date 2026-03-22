import { supabase, type Database, type Json } from "@pipeline-intelligence/db";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

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

export function toUserRecord(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar_url: row.avatar_url,
    created_at: new Date(row.created_at),
  };
}

export function toJson(value: Record<string, unknown> | unknown[]): Json {
  return value as Json;
}

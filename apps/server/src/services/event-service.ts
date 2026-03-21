import type { EventsResponse } from "@pipeline-intelligence/shared";

import { serializeEvent } from "./serializers";
import { assertData, assertMaybeData, supabase, toDealRecord, toEventRecord } from "./supabase-utils";

export async function listEvents(
  userId: string,
  params: {
    source?: "fathom" | "hubspot";
    deal_id?: string;
    stage?: string;
    limit?: number;
    offset?: number;
  },
): Promise<EventsResponse> {
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  let dealIdsForStage: string[] | null = null;

  if (params.stage) {
    const dealRows = assertData(
      await supabase.from("deals").select("id").eq("user_id", userId).eq("stage", params.stage),
    );
    dealIdsForStage = dealRows.map((row) => row.id);

    if (dealIdsForStage.length === 0) {
      return { events: [], total: 0 };
    }
  }

  let query = supabase
    .from("events")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.source) query = query.eq("source", params.source);
  if (params.deal_id) query = query.eq("deal_id", params.deal_id);
  if (dealIdsForStage) query = query.in("deal_id", dealIdsForStage);

  const result = await query;
  const eventRows = assertData(result);
  const dealIds = [...new Set(eventRows.map((row) => row.deal_id).filter(Boolean))];
  const dealRows =
    dealIds.length === 0
      ? []
      : assertData(await supabase.from("deals").select("*").in("id", dealIds as string[]).eq("user_id", userId));
  const dealLookup = new Map(dealRows.map((row) => [row.id, toDealRecord(row)]));

  return {
    events: eventRows.map((row) => serializeEvent(toEventRecord(row, row.deal_id ? dealLookup.get(row.deal_id) ?? null : null))),
    total: result.count ?? eventRows.length,
  };
}

export async function getEventById(userId: string, eventId: string) {
  const eventRow = assertMaybeData(
    await supabase.from("events").select("*").eq("id", eventId).eq("user_id", userId).maybeSingle(),
  );

  if (!eventRow) {
    return null;
  }

  const dealRow = eventRow.deal_id
    ? assertMaybeData(await supabase.from("deals").select("*").eq("id", eventRow.deal_id).eq("user_id", userId).maybeSingle())
    : null;

  return serializeEvent(toEventRecord(eventRow, dealRow ? toDealRecord(dealRow) : null));
}

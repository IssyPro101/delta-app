import type { DashboardDataResponse } from "@pipeline-intelligence/shared";

import {
  serializeDeal,
  serializeEvent,
  serializeInsight,
  serializeIntegration,
  serializeStageTransition,
} from "./serializers";
import {
  assertData,
  supabase,
  toDealRecord,
  toEventRecord,
  toInsightRecord,
  toIntegrationRecord,
  toStageTransitionRecord,
} from "./supabase-utils";

export async function getDashboardData(userId: string): Promise<DashboardDataResponse> {
  const [integrationRows, dealRows, stageTransitionRows, eventRows, insightRows] = await Promise.all([
    assertData(
      await supabase.from("integrations").select("*").eq("user_id", userId).order("provider", { ascending: true }),
    ),
    assertData(await supabase.from("deals").select("*").eq("user_id", userId).order("created_at", { ascending: false })),
    assertData(
      await supabase
        .from("stage_transitions")
        .select("*")
        .eq("user_id", userId)
        .order("transitioned_at", { ascending: true }),
    ),
    assertData(await supabase.from("events").select("*").eq("user_id", userId).order("occurred_at", { ascending: false })),
    assertData(
      await supabase.from("insights").select("*").eq("user_id", userId).order("generated_at", { ascending: false }),
    ),
  ]);

  const deals = dealRows.map((row) => toDealRecord(row));
  const dealLookup = new Map(deals.map((deal) => [deal.id, deal]));

  return {
    integrations: integrationRows.map((row) => serializeIntegration(toIntegrationRecord(row))),
    deals: deals.map(serializeDeal),
    stageTransitions: stageTransitionRows.map((row) => serializeStageTransition(toStageTransitionRecord(row))),
    events: eventRows.map((row) =>
      serializeEvent(toEventRecord(row, row.deal_id ? dealLookup.get(row.deal_id) ?? null : null)),
    ),
    insights: insightRows.map((row) => serializeInsight(toInsightRecord(row))),
  };
}

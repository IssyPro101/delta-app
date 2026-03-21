import type { DealsResponse } from "@pipeline-intelligence/shared";

import { serializeDeal, serializeDealDetail } from "./serializers";
import { assertData, assertMaybeData, supabase, toDealRecord, toStageTransitionRecord } from "./supabase-utils";

export async function listDeals(
  userId: string,
  params: {
    stage?: string;
    outcome?: "open" | "won" | "lost";
    limit?: number;
    offset?: number;
  },
): Promise<DealsResponse> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  let query = supabase
    .from("deals")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.stage) query = query.eq("stage", params.stage);
  if (params.outcome) query = query.eq("outcome", params.outcome);

  const result = await query;
  const dealRows = assertData(result);

  return {
    deals: dealRows.map((row) => serializeDeal(toDealRecord(row))),
    total: result.count ?? dealRows.length,
  };
}

export async function getDealById(userId: string, dealId: string) {
  const dealRow = assertMaybeData(
    await supabase.from("deals").select("*").eq("id", dealId).eq("user_id", userId).maybeSingle(),
  );

  if (!dealRow) {
    return null;
  }

  const transitionRows = assertData(
    await supabase
      .from("stage_transitions")
      .select("*")
      .eq("user_id", userId)
      .eq("deal_id", dealId)
      .order("transitioned_at", { ascending: true }),
  );

  return serializeDealDetail(
    toDealRecord(dealRow),
    transitionRows.map((row) => toStageTransitionRecord(row)),
  );
}

import {
  PIPELINE_MINIMUM_CLOSED_DEALS,
  type PipelinePeriod,
  type PipelineResponse,
} from "@pipeline-intelligence/shared";

import { average, buildStageEntries, getStageOrder, round } from "../analyzers/helpers";
import type { DealRecord, StageTransitionRecord } from "./domain-types";
import { assertData, supabase, toDealRecord, toStageTransitionRecord } from "./supabase-utils";
import { getPeriodStart } from "../utils/time";

function isDealInPeriod(deal: DealRecord, periodStart: Date | null): boolean {
  if (!periodStart) {
    return true;
  }

  const relevantDate = deal.closed_at ?? deal.last_activity ?? deal.created_at;
  return relevantDate >= periodStart;
}

export async function getPipelineData(
  userId: string,
  params: {
    pipeline_name?: string;
    period?: PipelinePeriod;
  },
): Promise<PipelineResponse> {
  const period = params.period ?? "last_90_days";
  const periodStart = getPeriodStart(period);

  let dealsQuery = supabase.from("deals").select("*").eq("user_id", userId).order("created_at", { ascending: true });

  if (params.pipeline_name) {
    dealsQuery = dealsQuery.eq("pipeline_name", params.pipeline_name);
  }

  const [allDealRows, pipelineNameRows] = await Promise.all([
    assertData(await dealsQuery),
    assertData(await supabase.from("deals").select("pipeline_name").eq("user_id", userId)),
  ]);

  const deals = allDealRows.map(toDealRecord).filter((deal) => isDealInPeriod(deal, periodStart));
  const dealIds = deals.map((deal) => deal.id);

  const stageTransitions: StageTransitionRecord[] =
    dealIds.length === 0
      ? []
      : assertData(
          await supabase
            .from("stage_transitions")
            .select("*")
            .eq("user_id", userId)
            .in("deal_id", dealIds)
            .order("transitioned_at", { ascending: true })
            .gte("transitioned_at", periodStart?.toISOString() ?? "1970-01-01T00:00:00.000Z"),
        ).map(toStageTransitionRecord);

  const stageEntries = buildStageEntries(deals, stageTransitions);
  const stageOrder = getStageOrder(deals, stageTransitions);

  const stages = stageOrder.map((stage) => {
    const entries = stageEntries.filter((entry) => entry.stage === stage);
    const leaving = stageTransitions.filter((transition) => transition.from_stage === stage);
    const wonLeaving = leaving.filter(
      (transition) => deals.find((deal) => deal.id === transition.deal_id)?.outcome === "won",
    );
    const lostLeaving = leaving.filter(
      (transition) => deals.find((deal) => deal.id === transition.deal_id)?.outcome === "lost",
    );

    const dealsEntered = entries.length;
    const dealsProgressed = entries.filter((entry) => entry.nextStage).length;
    const dealsLost = entries.filter(
      (entry) => !entry.nextStage && entry.deal.outcome === "lost" && entry.deal.stage === stage,
    ).length;

    return {
      name: stage,
      deals_entered: dealsEntered,
      deals_progressed: dealsProgressed,
      deals_lost: dealsLost,
      conversion_rate: dealsEntered === 0 ? 0 : round(dealsProgressed / dealsEntered),
      avg_days_in_stage: round(average(leaving.map((transition) => (transition.time_in_stage_hours ?? 0) / 24))),
      avg_days_in_stage_won: round(
        average(wonLeaving.map((transition) => (transition.time_in_stage_hours ?? 0) / 24)),
      ),
      avg_days_in_stage_lost: round(
        average(lostLeaving.map((transition) => (transition.time_in_stage_hours ?? 0) / 24)),
      ),
    };
  });

  const won = deals.filter((deal) => deal.outcome === "won").length;
  const lost = deals.filter((deal) => deal.outcome === "lost").length;
  const open = deals.filter((deal) => deal.outcome === "open").length;
  const closedDeals = won + lost;
  const avgDealCycleDays = average(
    deals
      .filter((deal) => deal.closed_at)
      .map((deal) => ((deal.closed_at ?? deal.created_at).getTime() - deal.created_at.getTime()) / 86_400_000),
  );

  return {
    stages,
    summary: {
      total_deals: deals.length,
      won,
      lost,
      open,
      overall_win_rate: closedDeals === 0 ? 0 : round(won / closedDeals),
      avg_deal_cycle_days: round(avgDealCycleDays),
    },
    pipelines: [...new Set(pipelineNameRows.map((row) => row.pipeline_name).filter(Boolean))],
    minimum_closed_deals_met: closedDeals >= PIPELINE_MINIMUM_CLOSED_DEALS,
    closed_deals_count: closedDeals,
  };
}

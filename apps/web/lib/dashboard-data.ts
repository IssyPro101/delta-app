import {
  PIPELINE_MINIMUM_CLOSED_DEALS,
  periodToDays,
  type DashboardDataResponse,
  type Deal,
  type PipelinePeriod,
  type PipelineResponse,
  type StageTransition,
} from "@pipeline-intelligence/shared";

type StageEntry = {
  deal: Deal;
  stage: string;
  enteredAt: Date;
  exitedAt: Date | null;
  nextStage: string | null;
};

function getPeriodStart(period: PipelinePeriod): Date | null {
  if (period === "all_time") {
    return null;
  }

  const value = new Date();
  value.setUTCDate(value.getUTCDate() - periodToDays[period]);
  return value;
}

function isDealInPeriod(deal: Deal, periodStart: Date | null) {
  if (!periodStart) {
    return true;
  }

  const relevantDate = deal.closed_at ?? deal.last_activity ?? deal.created_at;
  return new Date(relevantDate) >= periodStart;
}

function buildStageEntries(deals: Deal[], transitions: StageTransition[], now = new Date()): StageEntry[] {
  const transitionsByDeal = new Map<string, StageTransition[]>();

  for (const transition of transitions) {
    const current = transitionsByDeal.get(transition.deal_id) ?? [];
    current.push(transition);
    transitionsByDeal.set(transition.deal_id, current);
  }

  const entries: StageEntry[] = [];

  for (const deal of deals) {
    const ordered = [...(transitionsByDeal.get(deal.id) ?? [])].sort(
      (left, right) => new Date(left.transitioned_at).getTime() - new Date(right.transitioned_at).getTime(),
    );

    if (ordered.length === 0) {
      entries.push({
        deal,
        stage: deal.stage,
        enteredAt: new Date(deal.created_at),
        exitedAt: deal.outcome === "open" ? null : deal.closed_at ? new Date(deal.closed_at) : now,
        nextStage: null,
      });
      continue;
    }

    for (let index = 0; index < ordered.length; index += 1) {
      const transition = ordered[index];
      const next = ordered[index + 1];

      if (!transition) {
        continue;
      }

      entries.push({
        deal,
        stage: transition.to_stage,
        enteredAt: new Date(transition.transitioned_at),
        exitedAt: next?.transitioned_at
          ? new Date(next.transitioned_at)
          : deal.outcome === "open"
            ? null
            : deal.closed_at
              ? new Date(deal.closed_at)
              : now,
        nextStage: next?.to_stage ?? null,
      });
    }
  }

  return entries;
}

function getStageOrder(deals: Deal[], transitions: StageTransition[]) {
  const ordered = new Map<string, number>();
  let counter = 0;

  for (const transition of [...transitions].sort(
    (left, right) => new Date(left.transitioned_at).getTime() - new Date(right.transitioned_at).getTime(),
  )) {
    if (transition.from_stage && !ordered.has(transition.from_stage)) {
      ordered.set(transition.from_stage, counter);
      counter += 1;
    }

    if (!ordered.has(transition.to_stage)) {
      ordered.set(transition.to_stage, counter);
      counter += 1;
    }
  }

  for (const deal of deals) {
    if (!ordered.has(deal.stage)) {
      ordered.set(deal.stage, counter);
      counter += 1;
    }
  }

  return [...ordered.entries()]
    .sort((left, right) => left[1] - right[1])
    .map(([stage]) => stage);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function buildPipelineData(
  dashboardData: DashboardDataResponse,
  params: {
    pipelineName?: string;
    period?: PipelinePeriod;
  },
): PipelineResponse {
  const period = params.period ?? "last_90_days";
  const periodStart = getPeriodStart(period);
  const pipelines = [...new Set(dashboardData.deals.map((deal) => deal.pipeline_name).filter(Boolean))];
  const scopedDeals = dashboardData.deals
    .filter((deal) => !params.pipelineName || deal.pipeline_name === params.pipelineName)
    .filter((deal) => isDealInPeriod(deal, periodStart));
  const dealIds = new Set(scopedDeals.map((deal) => deal.id));
  const scopedTransitions = dashboardData.stageTransitions.filter((transition) => {
    if (!dealIds.has(transition.deal_id)) {
      return false;
    }

    return !periodStart || new Date(transition.transitioned_at) >= periodStart;
  });

  const stageEntries = buildStageEntries(scopedDeals, scopedTransitions);
  const stageOrder = getStageOrder(scopedDeals, scopedTransitions);

  const stages = stageOrder.map((stage) => {
    const entries = stageEntries.filter((entry) => entry.stage === stage);
    const leaving = scopedTransitions.filter((transition) => transition.from_stage === stage);
    const wonLeaving = leaving.filter(
      (transition) => scopedDeals.find((deal) => deal.id === transition.deal_id)?.outcome === "won",
    );
    const lostLeaving = leaving.filter(
      (transition) => scopedDeals.find((deal) => deal.id === transition.deal_id)?.outcome === "lost",
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

  const won = scopedDeals.filter((deal) => deal.outcome === "won").length;
  const lost = scopedDeals.filter((deal) => deal.outcome === "lost").length;
  const open = scopedDeals.filter((deal) => deal.outcome === "open").length;
  const closedDeals = won + lost;
  const avgDealCycleDays = average(
    scopedDeals
      .filter((deal) => deal.closed_at)
      .map(
        (deal) => (new Date(deal.closed_at ?? deal.created_at).getTime() - new Date(deal.created_at).getTime()) / 86_400_000,
      ),
  );

  return {
    stages,
    summary: {
      total_deals: scopedDeals.length,
      won,
      lost,
      open,
      overall_win_rate: closedDeals === 0 ? 0 : round(won / closedDeals),
      avg_deal_cycle_days: round(avgDealCycleDays),
    },
    pipelines,
    minimum_closed_deals_met: closedDeals >= PIPELINE_MINIMUM_CLOSED_DEALS,
    closed_deals_count: closedDeals,
  };
}

import { VELOCITY_GAP_FACTOR } from "@pipeline-intelligence/shared";

import type { InsightRecord } from "../services/domain-types";
import { average, getStageOrder, round, type AnalyzerContext } from "./helpers";

export function runVelocityComparisonAnalyzer(
  context: AnalyzerContext,
): Omit<InsightRecord, "id" | "created_at">[] {
  const stageOrder = getStageOrder(context.deals, context.stageTransitions);

  return stageOrder
    .map((stage) => {
      const leavingStage = context.stageTransitions.filter((transition) => transition.from_stage === stage);
      const wonDurations = leavingStage
        .filter((transition) => context.deals.find((deal) => deal.id === transition.deal_id)?.outcome === "won")
        .map((transition) => (transition.time_in_stage_hours ?? 0) / 24)
        .filter(Boolean);
      const lostDurations = leavingStage
        .filter((transition) => context.deals.find((deal) => deal.id === transition.deal_id)?.outcome === "lost")
        .map((transition) => (transition.time_in_stage_hours ?? 0) / 24)
        .filter(Boolean);

      const wonAverage = average(wonDurations);
      const lostAverage = average(lostDurations);

      return {
        stage,
        wonAverage,
        lostAverage,
        differenceFactor: wonAverage === 0 ? 0 : lostAverage / wonAverage,
        wonCount: wonDurations.length,
        lostCount: lostDurations.length,
      };
    })
    .filter(
      (metric) =>
        metric.wonCount >= 3 &&
        metric.lostCount >= 3 &&
        metric.wonAverage > 0 &&
        metric.differenceFactor >= VELOCITY_GAP_FACTOR,
    )
    .map((metric) => ({
      user_id: context.userId,
      analyzer: "velocity_comparison",
      category: "pattern" as const,
      severity: metric.differenceFactor >= 3 ? ("high" as const) : ("medium" as const),
      title: `Lost deals stall in ${metric.stage}`,
      description: `Deals that eventually lose spend much longer in ${metric.stage} than deals that close won. This is a consistent stall point and usually indicates weak progression criteria or poor follow-up in that stage.`,
      data: {
        pipeline: context.pipelineName,
        stage: metric.stage,
        won_avg_days: round(metric.wonAverage),
        lost_avg_days: round(metric.lostAverage),
        difference_factor: round(metric.differenceFactor),
        won_deals_count: metric.wonCount,
        lost_deals_count: metric.lostCount,
        period: context.periodLabel,
      },
      affected_deals: [],
      pipeline_name: context.pipelineName,
      is_active: true,
      generated_at: context.generatedAt,
    }));
}

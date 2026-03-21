import { LEAK_DELTA_THRESHOLD } from "@pipeline-intelligence/shared";

import type { InsightRecord } from "../services/domain-types";
import { buildStageEntries, getStageOrder, round, type AnalyzerContext } from "./helpers";

export function runStageLeakAnalyzer(context: AnalyzerContext): Omit<InsightRecord, "id" | "created_at">[] {
  const entries = buildStageEntries(context.deals, context.stageTransitions);
  const stageOrder = getStageOrder(context.deals, context.stageTransitions);

  const metrics = stageOrder
    .map((stage) => {
      const stageEntries = entries.filter((entry) => entry.stage === stage);
      const dealsEntered = stageEntries.length;
      const dealsProgressed = stageEntries.filter((entry) => entry.nextStage).length;
      const dealsLost = stageEntries.filter(
        (entry) => !entry.nextStage && entry.deal.outcome === "lost" && entry.deal.stage === stage,
      ).length;

      return {
        stage,
        dealsEntered,
        dealsProgressed,
        dealsLost,
        conversionRate: dealsEntered === 0 ? 0 : dealsProgressed / dealsEntered,
      };
    })
    .filter((stage) => stage.dealsEntered > 0);

  const pipelineAverage =
    metrics.length === 0
      ? 0
      : metrics.reduce((sum, metric) => sum + metric.conversionRate, 0) / metrics.length;

  return metrics
    .filter((metric) => metric.conversionRate <= pipelineAverage - LEAK_DELTA_THRESHOLD)
    .map((metric) => ({
      user_id: context.userId,
      analyzer: "stage_leak",
      category: "leak" as const,
      severity: metric.conversionRate <= pipelineAverage - 0.3 ? ("high" as const) : ("medium" as const),
      title: `${metric.stage} stage is losing ${Math.round((1 - metric.conversionRate) * 100)}% of deals`,
      description: `Over the ${context.periodLabel.replaceAll("_", " ")}, only ${Math.round(
        metric.conversionRate * 100,
      )}% of deals that reached ${metric.stage} progressed. The pipeline average is ${Math.round(
        pipelineAverage * 100,
      )}%, and ${metric.dealsLost} deals were lost at this stage.`,
      data: {
        pipeline: context.pipelineName,
        stage: metric.stage,
        conversion_rate: round(metric.conversionRate),
        pipeline_avg_conversion: round(pipelineAverage),
        deals_entered: metric.dealsEntered,
        deals_progressed: metric.dealsProgressed,
        deals_lost: metric.dealsLost,
        period: context.periodLabel,
      },
      affected_deals: entries
        .filter((entry) => entry.stage === metric.stage && !entry.nextStage)
        .map((entry) => entry.deal.id),
      pipeline_name: context.pipelineName,
      is_active: true,
      generated_at: context.generatedAt,
    }));
}

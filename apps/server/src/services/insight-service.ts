import type { InsightCategory, InsightsResponse, PipelinePeriod } from "@pipeline-intelligence/shared";

import {
  runActivityPatternAnalyzer,
  runDealRiskAnalyzer,
  runStageLeakAnalyzer,
  runVelocityComparisonAnalyzer,
} from "../analyzers";
import type { DealRecord, EventRecord, InsightRecord, StageTransitionRecord } from "./domain-types";
import { serializeInsight } from "./serializers";
import {
  assertData,
  assertNoError,
  supabase,
  toDealRecord,
  toEventRecord,
  toInsightRecord,
  toJson,
  toStageTransitionRecord,
} from "./supabase-utils";
import { getPeriodStart } from "../utils/time";

export async function listInsights(
  userId: string,
  params: {
    category?: InsightCategory;
    analyzer?: string;
    is_active?: boolean;
    stage?: string;
    limit?: number;
    offset?: number;
  },
): Promise<InsightsResponse> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  let query = supabase
    .from("insights")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("generated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.category) query = query.eq("category", params.category);
  if (params.analyzer) query = query.eq("analyzer", params.analyzer);
  if (typeof params.is_active === "boolean") query = query.eq("is_active", params.is_active);

  const result = await query;
  const insightRows = assertData(result);
  const mapped = insightRows.map(toInsightRecord);
  const filtered = params.stage ? mapped.filter((insight) => insight.data.stage === params.stage) : mapped;

  return {
    insights: filtered.map(serializeInsight),
    total: result.count ?? filtered.length,
  };
}

export async function runPipelineAnalyzers(
  userId: string,
  pipelineName: string,
  period: PipelinePeriod = "last_90_days",
  analyzers: string[] = ["stage_leak", "velocity_comparison", "activity_pattern", "deal_risk"],
): Promise<void> {
  const periodStart = getPeriodStart(period);

  let dealsQuery = supabase
    .from("deals")
    .select("*")
    .eq("user_id", userId)
    .eq("pipeline_name", pipelineName)
    .order("created_at", { ascending: true });

  if (periodStart) {
    dealsQuery = dealsQuery.or(
      `created_at.gte.${periodStart.toISOString()},closed_at.gte.${periodStart.toISOString()},last_activity.gte.${periodStart.toISOString()}`,
    );
  }

  const dealRows = assertData(await dealsQuery);
  const deals = dealRows.map(toDealRecord);
  const dealIds = deals.map((deal) => deal.id);

  const [stageTransitionRows, eventRows] = await Promise.all([
    dealIds.length === 0
      ? Promise.resolve([])
      : assertData(
          await supabase
            .from("stage_transitions")
            .select("*")
            .eq("user_id", userId)
            .in("deal_id", dealIds)
            .gte("transitioned_at", periodStart?.toISOString() ?? "1970-01-01T00:00:00.000Z"),
        ),
    dealIds.length === 0
      ? Promise.resolve([])
      : assertData(
          await supabase
            .from("events")
            .select("*")
            .eq("user_id", userId)
            .in("deal_id", dealIds)
            .gte("occurred_at", periodStart?.toISOString() ?? "1970-01-01T00:00:00.000Z"),
        ),
  ]);

  const context = {
    userId,
    pipelineName,
    deals,
    stageTransitions: stageTransitionRows.map(toStageTransitionRecord) as StageTransitionRecord[],
    events: eventRows.map((row) => toEventRecord(row)) as EventRecord[],
    generatedAt: new Date(),
    periodLabel: period,
  };

  const results = analyzers.flatMap((analyzer) => {
    switch (analyzer) {
      case "stage_leak":
        return runStageLeakAnalyzer(context);
      case "velocity_comparison":
        return runVelocityComparisonAnalyzer(context);
      case "activity_pattern":
        return runActivityPatternAnalyzer(context);
      case "deal_risk":
        return runDealRiskAnalyzer(context);
      default:
        return [];
    }
  });

  for (const analyzer of analyzers) {
    assertNoError(
      await supabase
        .from("insights")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("analyzer", analyzer)
        .eq("pipeline_name", pipelineName)
        .eq("is_active", true),
    );
  }

  if (results.length > 0) {
    assertNoError(
      await supabase.from("insights").insert(
        results.map((result) => ({
          user_id: result.user_id,
          analyzer: result.analyzer,
          category: result.category,
          severity: result.severity,
          title: result.title,
          description: result.description,
          data: toJson(result.data),
          affected_deals: result.affected_deals,
          pipeline_name: result.pipeline_name,
          is_active: result.is_active,
          generated_at: result.generated_at.toISOString(),
        })),
      ),
    );
  }
}

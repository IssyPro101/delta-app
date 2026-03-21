import { ACTIVITY_PATTERN_FACTOR } from "@pipeline-intelligence/shared";

import type { InsightRecord } from "../services/domain-types";
import { average, countEventType, round, type AnalyzerContext } from "./helpers";

export function runActivityPatternAnalyzer(
  context: AnalyzerContext,
): Omit<InsightRecord, "id" | "created_at">[] {
  const wonDeals = context.deals.filter((deal) => deal.outcome === "won");
  const lostDeals = context.deals.filter((deal) => deal.outcome === "lost");
  const meetingCounts = countEventType(context.events, "meeting");
  const activityCounts = countEventType(context.events, "contact_activity");

  const wonMeetingAverage = average(wonDeals.map((deal) => meetingCounts.get(deal.id) ?? 0));
  const lostMeetingAverage = average(lostDeals.map((deal) => meetingCounts.get(deal.id) ?? 0));
  const wonActivityAverage = average(wonDeals.map((deal) => activityCounts.get(deal.id) ?? 0));
  const lostActivityAverage = average(lostDeals.map((deal) => activityCounts.get(deal.id) ?? 0));

  const insights: Omit<InsightRecord, "id" | "created_at">[] = [];

  if (wonDeals.length >= 3 && lostDeals.length >= 3 && wonMeetingAverage >= lostMeetingAverage * ACTIVITY_PATTERN_FACTOR) {
    insights.push({
      user_id: context.userId,
      analyzer: "activity_pattern",
      category: "pattern",
      severity: wonMeetingAverage >= lostMeetingAverage * 2 ? "high" : "medium",
      title: `Won deals average ${round(wonMeetingAverage, 1)} meetings, lost deals average ${round(
        lostMeetingAverage,
        1,
      )}`,
      description:
        "Won deals show materially higher meeting volume than lost deals. The strongest signal in this dataset is early conversation density before a deal moves deeper into the pipeline.",
      data: {
        pattern: "meeting_frequency",
        won_avg: round(wonMeetingAverage, 1),
        lost_avg: round(lostMeetingAverage, 1),
        unit: "meetings per deal",
        stage_context: "Discovery → Proposal",
        won_deals_count: wonDeals.length,
        lost_deals_count: lostDeals.length,
        period: context.periodLabel,
      },
      affected_deals: wonDeals.slice(0, 5).map((deal) => deal.id),
      pipeline_name: context.pipelineName,
      is_active: true,
      generated_at: context.generatedAt,
    });
  }

  if (
    wonDeals.length >= 3 &&
    lostDeals.length >= 3 &&
    wonActivityAverage >= lostActivityAverage * ACTIVITY_PATTERN_FACTOR
  ) {
    insights.push({
      user_id: context.userId,
      analyzer: "activity_pattern",
      category: "pattern",
      severity: "medium",
      title: `Won deals keep contact activity moving`,
      description:
        "Won deals maintain more touchpoints between meetings than lost deals. Consistent engagement between buyer interactions appears to correlate with progression.",
      data: {
        pattern: "contact_frequency",
        won_avg: round(wonActivityAverage, 1),
        lost_avg: round(lostActivityAverage, 1),
        unit: "activities per deal",
        stage_context: "Discovery → Proposal",
        won_deals_count: wonDeals.length,
        lost_deals_count: lostDeals.length,
        period: context.periodLabel,
      },
      affected_deals: wonDeals.slice(0, 5).map((deal) => deal.id),
      pipeline_name: context.pipelineName,
      is_active: true,
      generated_at: context.generatedAt,
    });
  }

  return insights;
}

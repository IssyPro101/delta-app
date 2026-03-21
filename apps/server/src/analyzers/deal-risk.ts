import { DEAL_RISK_SIMILARITY_THRESHOLD } from "@pipeline-intelligence/shared";

import type { InsightRecord } from "../services/domain-types";
import { average, buildStageEntries, countEventType, round, type AnalyzerContext } from "./helpers";

export function runDealRiskAnalyzer(context: AnalyzerContext): Omit<InsightRecord, "id" | "created_at">[] {
  const entries = buildStageEntries(context.deals, context.stageTransitions, context.generatedAt);
  const meetingCounts = countEventType(context.events, "meeting");

  return context.deals
    .filter((deal) => deal.outcome === "open")
    .map((deal) => {
      const stageEntries = entries.filter((entry) => entry.stage === deal.stage);
      const wonStageEntries = stageEntries.filter((entry) => entry.deal.outcome === "won");
      const lostStageEntries = stageEntries.filter((entry) => entry.deal.outcome === "lost");
      const currentEntry =
        entries
          .filter((entry) => entry.deal.id === deal.id && entry.stage === deal.stage)
          .sort((left, right) => right.enteredAt.getTime() - left.enteredAt.getTime())[0] ?? null;

      if (!currentEntry || wonStageEntries.length < 3 || lostStageEntries.length < 3) {
        return null;
      }

      const wonAvgDays = average(
        wonStageEntries
          .filter((entry) => entry.exitedAt)
          .map((entry) => ((entry.exitedAt ?? context.generatedAt).getTime() - entry.enteredAt.getTime()) / 86_400_000),
      );
      const lostAvgDays = average(
        lostStageEntries
          .filter((entry) => entry.exitedAt)
          .map((entry) => ((entry.exitedAt ?? context.generatedAt).getTime() - entry.enteredAt.getTime()) / 86_400_000),
      );

      const daysInStage = (context.generatedAt.getTime() - currentEntry.enteredAt.getTime()) / 86_400_000;
      const wonMeetingAvg = average(wonStageEntries.map((entry) => meetingCounts.get(entry.deal.id) ?? 0));
      const lostMeetingAvg = average(lostStageEntries.map((entry) => meetingCounts.get(entry.deal.id) ?? 0));
      const currentMeetings = meetingCounts.get(deal.id) ?? 0;

      const timeSimilarity =
        lostAvgDays <= wonAvgDays
          ? 0
          : Math.min(1, Math.max(0, (daysInStage - wonAvgDays) / Math.max(0.1, lostAvgDays - wonAvgDays)));
      const meetingSimilarity =
        wonMeetingAvg <= lostMeetingAvg
          ? 0
          : Math.min(
              1,
              Math.max(0, (wonMeetingAvg - currentMeetings) / Math.max(0.1, wonMeetingAvg - lostMeetingAvg)),
            );
      const similarity = round((timeSimilarity + meetingSimilarity) / 2);

      return {
        deal,
        daysInStage,
        currentMeetings,
        wonAvgDays,
        lostAvgDays,
        wonMeetingAvg,
        lostMeetingAvg,
        similarity,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .filter((risk) => risk.similarity >= DEAL_RISK_SIMILARITY_THRESHOLD)
    .map((risk) => ({
      user_id: context.userId,
      analyzer: "deal_risk",
      category: "risk" as const,
      severity: risk.similarity >= 0.85 ? ("high" as const) : ("medium" as const),
      title: `${risk.deal.name} is tracking like a lost deal`,
      description: `This deal has spent ${round(
        risk.daysInStage,
        1,
      )} days in ${risk.deal.stage}. That is much closer to the historical lost profile than the won profile, and engagement volume is currently below what winning deals usually show.`,
      data: {
        risk_factors: [
          {
            factor: "time_in_stage",
            current: round(risk.daysInStage, 1),
            lost_avg: round(risk.lostAvgDays, 1),
            won_avg: round(risk.wonAvgDays, 1),
          },
          {
            factor: "meetings_so_far",
            current: risk.currentMeetings,
            lost_avg: round(risk.lostMeetingAvg, 1),
            won_avg: round(risk.wonMeetingAvg, 1),
          },
        ],
        similarity_to_lost: risk.similarity,
        deal_id: risk.deal.id,
        deal_name: risk.deal.name,
        current_stage: risk.deal.stage,
        days_in_stage: round(risk.daysInStage, 1),
      },
      affected_deals: [risk.deal.id],
      pipeline_name: risk.deal.pipeline_name,
      is_active: true,
      generated_at: context.generatedAt,
    }));
}

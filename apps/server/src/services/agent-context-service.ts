import { getDealById } from "./deal-service";
import { listEvents } from "./event-service";
import { serializeDeal, serializeInsight } from "./serializers";
import { assertData, supabase, toDealRecord, toInsightRecord } from "./supabase-utils";

function summarizeTitle(title: string) {
  return title.trim().replace(/\s+/g, " ");
}

export async function getAgentWorkspaceSummary(userId: string) {
  const [dealRows, insightRows, eventResponse] = await Promise.all([
    assertData(await supabase.from("deals").select("*").eq("user_id", userId).order("last_activity", { ascending: false })),
    assertData(
      await supabase
        .from("insights")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("generated_at", { ascending: false })
        .limit(8),
    ),
    listEvents(userId, { limit: 8 }),
  ]);

  const deals = dealRows.map(toDealRecord);
  const openDeals = deals.filter((deal) => deal.outcome === "open");
  const wonDeals = deals.filter((deal) => deal.outcome === "won");
  const lostDeals = deals.filter((deal) => deal.outcome === "lost");
  const openAmount = openDeals.reduce((sum, deal) => sum + (deal.amount ?? 0), 0);
  const pipelines = [...new Set(deals.map((deal) => summarizeTitle(deal.pipeline_name)).filter(Boolean))];
  const stageDistribution = Object.entries(
    deals.reduce<Record<string, number>>((accumulator, deal) => {
      accumulator[deal.stage] = (accumulator[deal.stage] ?? 0) + 1;
      return accumulator;
    }, {}),
  )
    .sort((left, right) => right[1] - left[1])
    .map(([stage, count]) => ({ stage, count }));

  return {
    overview: {
      total_deals: deals.length,
      open_deals: openDeals.length,
      won_deals: wonDeals.length,
      lost_deals: lostDeals.length,
      total_open_amount: openAmount,
      active_insights: insightRows.length,
      pipeline_names: pipelines,
      stage_distribution: stageDistribution,
    },
    highlighted_deals: deals.slice(0, 8).map(serializeDeal),
    active_insights: insightRows.map((row) => serializeInsight(toInsightRecord(row))),
    recent_activity: eventResponse.events,
  };
}

export async function searchAgentDeals(
  userId: string,
  params: {
    query?: string;
    stage?: string;
    outcome?: "open" | "won" | "lost";
    limit?: number;
  },
) {
  const limit = Math.min(params.limit ?? 10, 25);
  const query = params.query?.trim().toLowerCase();

  const rows = assertData(await supabase.from("deals").select("*").eq("user_id", userId).order("last_activity", { ascending: false }));
  const deals = rows
    .map(toDealRecord)
    .filter((deal) => !params.stage || deal.stage === params.stage)
    .filter((deal) => !params.outcome || deal.outcome === params.outcome)
    .filter((deal) => {
      if (!query) {
        return true;
      }

      const haystack = [deal.name, deal.company_name, deal.owner_name, deal.pipeline_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    })
    .slice(0, limit);

  return {
    deals: deals.map(serializeDeal),
    total: deals.length,
  };
}

export async function getAgentDealContext(userId: string, dealId: string) {
  const deal = await getDealById(userId, dealId);

  if (!deal) {
    return null;
  }

  const [eventResponse, insightRows] = await Promise.all([
    listEvents(userId, { deal_id: dealId, limit: 10 }),
    assertData(
      await supabase
        .from("insights")
        .select("*")
        .eq("user_id", userId)
        .contains("affected_deals", [dealId])
        .eq("is_active", true)
        .order("generated_at", { ascending: false })
        .limit(8),
    ),
  ]);

  return {
    deal,
    related_insights: insightRows.map((row) => serializeInsight(toInsightRecord(row))),
    recent_activity: eventResponse.events,
  };
}

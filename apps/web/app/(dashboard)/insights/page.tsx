import type { Deal, DealsResponse, InsightsResponse } from "@pipeline-intelligence/shared";

import { InsightCard } from "../../../components/insight-card";
import { EmptyState, PillLink, SectionTitle } from "../../../components/ui";
import { apiFetch } from "../../../lib/api";

const categories = [
  { label: "All", value: "" },
  { label: "Leaks", value: "leak" },
  { label: "Patterns", value: "pattern" },
  { label: "Risks", value: "risk" },
];

export default async function InsightsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ category?: string; analyzer?: string; stage?: string; offset?: string }>;
}>) {
  const params = await searchParams;
  const limit = 50;
  const offset = Number(params.offset ?? "0");
  const query = new URLSearchParams();

  if (params.category) query.set("category", params.category);
  if (params.analyzer) query.set("analyzer", params.analyzer);
  if (params.stage) query.set("stage", params.stage);
  query.set("is_active", "true");
  query.set("limit", String(limit));
  query.set("offset", String(offset));

  const [insightData, dealData] = await Promise.all([
    apiFetch<InsightsResponse>(`/api/insights?${query.toString()}`),
    apiFetch<DealsResponse>("/api/deals?limit=200"),
  ]);

  const dealLookup = new Map<string, Deal>(dealData.deals.map((deal) => [deal.id, deal]));
  const hasMore = offset + insightData.insights.length < insightData.total;

  function categoryHref(category: string) {
    const nextQuery = new URLSearchParams();

    if (category) nextQuery.set("category", category);
    if (params.analyzer) nextQuery.set("analyzer", params.analyzer);
    if (params.stage) nextQuery.set("stage", params.stage);

    const next = nextQuery.toString();
    return next ? `/insights?${next}` : "/insights";
  }

  const loadMoreQuery = new URLSearchParams();
  if (params.category) loadMoreQuery.set("category", params.category);
  if (params.analyzer) loadMoreQuery.set("analyzer", params.analyzer);
  if (params.stage) loadMoreQuery.set("stage", params.stage);
  loadMoreQuery.set("offset", String(offset + limit));
  const loadMoreHref = `/insights?${loadMoreQuery.toString()}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {categories.map((category) => {
          return <PillLink key={category.label} href={categoryHref(category.value)} label={category.label} active={params.category === category.value || (!params.category && !category.value)} />;
        })}
      </div>
      <SectionTitle eyebrow="Analyzers" title="Findings derived from deal flow and activity" />
      {insightData.insights.length === 0 ? (
        <EmptyState
          title="No insights yet."
          description="Insights are generated as deal data is analyzed. They’ll appear here once enough deals have closed."
        />
      ) : (
        <div className="space-y-4">
          {insightData.insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} dealLookup={dealLookup} />
          ))}
          {hasMore ? (
            <div className="pt-2">
              <PillLink href={loadMoreHref} label="Load more" />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

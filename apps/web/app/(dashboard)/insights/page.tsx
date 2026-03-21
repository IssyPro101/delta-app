"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { Deal, DealsResponse, InsightsResponse } from "@pipeline-intelligence/shared";

import { InsightCard } from "../../../components/insight-card";
import { EmptyState, Panel, PillLink, SectionTitle } from "../../../components/ui";
import { apiFetch, toErrorMessage } from "../../../lib/api";

const categories = [
  { label: "All", value: "" },
  { label: "Leaks", value: "leak" },
  { label: "Patterns", value: "pattern" },
  { label: "Risks", value: "risk" },
];

export default function InsightsPage() {
  return (
    <Suspense>
      <InsightsPageContent />
    </Suspense>
  );
}

function InsightsPageContent() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") ?? undefined;
  const analyzer = searchParams.get("analyzer") ?? undefined;
  const stage = searchParams.get("stage") ?? undefined;
  const limit = 50;
  const offset = Number(searchParams.get("offset") ?? "0");
  const [insightData, setInsightData] = useState<InsightsResponse | null>(null);
  const [dealData, setDealData] = useState<DealsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = new URLSearchParams();

  if (category) query.set("category", category);
  if (analyzer) query.set("analyzer", analyzer);
  if (stage) query.set("stage", stage);
  query.set("is_active", "true");
  query.set("limit", String(limit));
  query.set("offset", String(offset));
  const queryString = query.toString();

  useEffect(() => {
    let active = true;

    setInsightData(null);
    setDealData(null);
    setError(null);

    void (async () => {
      try {
        const [nextInsightData, nextDealData] = await Promise.all([
          apiFetch<InsightsResponse>(`/api/insights?${queryString}`),
          apiFetch<DealsResponse>("/api/deals?limit=200"),
        ]);

        if (active) {
          setInsightData(nextInsightData);
          setDealData(nextDealData);
        }
      } catch (error) {
        if (active) {
          setError(toErrorMessage(error));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [queryString]);

  if ((!insightData || !dealData) && !error) {
    return (
      <Panel>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--line-strong)] border-t-[color:var(--accent)]" />
          <p className="text-sm text-[color:var(--muted)]">Loading insights...</p>
        </div>
      </Panel>
    );
  }

  if (!insightData || !dealData) {
    return (
      <Panel className="border-[rgba(229,72,77,0.12)] bg-[color:var(--danger-soft)]">
        <p className="text-sm text-[color:var(--danger)]">{error ?? "Could not load insights."}</p>
      </Panel>
    );
  }

  const dealLookup = new Map<string, Deal>(dealData.deals.map((deal) => [deal.id, deal]));
  const hasMore = offset + insightData.insights.length < insightData.total;

  function categoryHref(category: string) {
    const nextQuery = new URLSearchParams();

    if (category) nextQuery.set("category", category);
    if (analyzer) nextQuery.set("analyzer", analyzer);
    if (stage) nextQuery.set("stage", stage);

    const next = nextQuery.toString();
    return next ? `/insights?${next}` : "/insights";
  }

  const loadMoreQuery = new URLSearchParams();
  if (category) loadMoreQuery.set("category", category);
  if (analyzer) loadMoreQuery.set("analyzer", analyzer);
  if (stage) loadMoreQuery.set("stage", stage);
  loadMoreQuery.set("offset", String(offset + limit));
  const loadMoreHref = `/insights?${loadMoreQuery.toString()}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        {categories.map((category) => {
          return <PillLink key={category.label} href={categoryHref(category.value)} label={category.label} active={searchParams.get("category") === category.value || (!searchParams.get("category") && !category.value)} />;
        })}
      </div>
      <SectionTitle eyebrow="Analyzers" title="Findings derived from deal flow and activity" />
      {insightData.insights.length === 0 ? (
        <EmptyState
          title="No insights yet."
          description="Insights are generated as deal data is analyzed. They'll appear here once enough deals have closed."
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

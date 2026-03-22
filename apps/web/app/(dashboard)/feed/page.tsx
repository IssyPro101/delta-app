"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { useDashboardData } from "../../../components/dashboard-data-provider";
import { FeedList } from "../../../components/feed-view";
import { EmptyState, Panel, PillLink, SectionTitle } from "../../../components/ui";

const sourceTabs = [
  { label: "All", value: "" },
  { label: "Fathom", value: "fathom" },
  { label: "HubSpot", value: "hubspot" },
];

export default function FeedPage() {
  return (
    <Suspense>
      <FeedPageContent />
    </Suspense>
  );
}

function FeedPageContent() {
  const searchParams = useSearchParams();
  const source = searchParams.get("source") ?? undefined;
  const dealId = searchParams.get("deal_id") ?? undefined;
  const eventId = searchParams.get("event") ?? undefined;
  const stage = searchParams.get("stage") ?? undefined;
  const limit = 50;
  const offset = Number(searchParams.get("offset") ?? "0");
  const { data, error, loading } = useDashboardData();
  const query = new URLSearchParams();

  if (source) query.set("source", source);
  if (dealId) query.set("deal_id", dealId);
  if (stage) query.set("stage", stage);
  query.set("limit", String(limit));
  query.set("offset", String(offset));
  const filteredEvents = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.events.filter((event) => {
      if (source && event.source !== source) {
        return false;
      }

      if (dealId && event.deal_id !== dealId) {
        return false;
      }

      if (stage && event.deal?.stage !== stage) {
        return false;
      }

      return true;
    });
  }, [data, dealId, source, stage]);
  const visibleEvents = filteredEvents.slice(offset, offset + limit);
  const activeEvent = useMemo(() => {
    if (!data || !eventId) {
      return null;
    }

    return data.events.find((event) => event.id === eventId) ?? null;
  }, [data, eventId]);
  const dealFilter = useMemo(() => {
    if (!data || !dealId) {
      return null;
    }

    return data.deals.find((deal) => deal.id === dealId) ?? null;
  }, [data, dealId]);

  if (!data && loading) {
    return (
      <Panel>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--line-strong)] border-t-[color:var(--accent)]" />
          <p className="text-sm text-[color:var(--muted)]">Loading activity feed...</p>
        </div>
      </Panel>
    );
  }

  if (!data) {
    return (
      <Panel className="border-[rgba(229,72,77,0.12)] bg-[color:var(--danger-soft)]">
        <p className="text-sm text-[color:var(--danger)]">{error ?? "Could not load activity feed."}</p>
      </Panel>
    );
  }

  const hasMore = offset + visibleEvents.length < filteredEvents.length;

  function sourceHref(source: string) {
    const nextQuery = new URLSearchParams();

    if (source) nextQuery.set("source", source);
    if (dealId) nextQuery.set("deal_id", dealId);
    if (stage) nextQuery.set("stage", stage);

    const next = nextQuery.toString();
    return next ? `/feed?${next}` : "/feed";
  }

  const loadMoreQuery = new URLSearchParams();
  if (source) loadMoreQuery.set("source", source);
  if (dealId) loadMoreQuery.set("deal_id", dealId);
  if (stage) loadMoreQuery.set("stage", stage);
  loadMoreQuery.set("offset", String(offset + limit));
  const loadMoreHref = `/feed?${loadMoreQuery.toString()}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        {sourceTabs.map((tab) => {
          return <PillLink key={tab.label} href={sourceHref(tab.value)} label={tab.label} active={source === tab.value || (!source && !tab.value)} />;
        })}
      </div>
      <SectionTitle eyebrow="Inspection Layer" title="Raw chronological activity across every deal" />
      {visibleEvents.length === 0 ? (
        <EmptyState
          title="No events yet."
          description="Once your integrations are syncing, activity will appear here."
        />
      ) : (
        <FeedList
          events={visibleEvents}
          activeEvent={activeEvent}
          dealFilter={dealFilter}
          baseQuery={query}
          {...(hasMore ? { loadMoreHref } : {})}
        />
      )}
    </div>
  );
}

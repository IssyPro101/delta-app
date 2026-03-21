"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { DealDetail, Event, EventsResponse } from "@pipeline-intelligence/shared";

import { FeedList } from "../../../components/feed-view";
import { EmptyState, Panel, PillLink, SectionTitle } from "../../../components/ui";
import { apiFetch, toErrorMessage } from "../../../lib/api";

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
  const [eventData, setEventData] = useState<EventsResponse | null>(null);
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [dealFilter, setDealFilter] = useState<DealDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = new URLSearchParams();

  if (source) query.set("source", source);
  if (dealId) query.set("deal_id", dealId);
  if (stage) query.set("stage", stage);
  query.set("limit", String(limit));
  query.set("offset", String(offset));
  const queryString = query.toString();

  useEffect(() => {
    let active = true;

    setEventData(null);
    setActiveEvent(null);
    setDealFilter(null);
    setError(null);

    void (async () => {
      try {
        const [nextEventData, nextActiveEvent, nextDealFilter] = await Promise.all([
          apiFetch<EventsResponse>(`/api/events?${queryString}`),
          eventId ? apiFetch<Event>(`/api/events/${eventId}`) : Promise.resolve(null),
          dealId ? apiFetch<DealDetail>(`/api/deals/${dealId}`) : Promise.resolve(null),
        ]);

        if (active) {
          setEventData(nextEventData);
          setActiveEvent(nextActiveEvent);
          setDealFilter(nextDealFilter);
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
  }, [dealId, eventId, queryString]);

  if (!eventData && !error) {
    return (
      <Panel>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--line-strong)] border-t-[color:var(--accent)]" />
          <p className="text-sm text-[color:var(--muted)]">Loading activity feed...</p>
        </div>
      </Panel>
    );
  }

  if (!eventData) {
    return (
      <Panel className="border-[rgba(229,72,77,0.12)] bg-[color:var(--danger-soft)]">
        <p className="text-sm text-[color:var(--danger)]">{error ?? "Could not load activity feed."}</p>
      </Panel>
    );
  }

  const hasMore = offset + eventData.events.length < eventData.total;

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
      {eventData.events.length === 0 ? (
        <EmptyState
          title="No events yet."
          description="Once your integrations are syncing, activity will appear here."
        />
      ) : (
        <FeedList
          events={eventData.events}
          activeEvent={activeEvent}
          dealFilter={dealFilter}
          baseQuery={query}
          {...(hasMore ? { loadMoreHref } : {})}
        />
      )}
    </div>
  );
}

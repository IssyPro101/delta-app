import type { DealDetail, Event, EventsResponse } from "@pipeline-intelligence/shared";

import { FeedList } from "../../../components/feed-view";
import { EmptyState, PillLink, SectionTitle } from "../../../components/ui";
import { apiFetch } from "../../../lib/api";

const sourceTabs = [
  { label: "All", value: "" },
  { label: "Fathom", value: "fathom" },
  { label: "HubSpot", value: "hubspot" },
];

export default async function FeedPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ source?: string; deal_id?: string; event?: string; stage?: string; offset?: string }>;
}>) {
  const params = await searchParams;
  const limit = 50;
  const offset = Number(params.offset ?? "0");
  const query = new URLSearchParams();

  if (params.source) query.set("source", params.source);
  if (params.deal_id) query.set("deal_id", params.deal_id);
  if (params.stage) query.set("stage", params.stage);
  query.set("limit", String(limit));
  query.set("offset", String(offset));

  const [eventData, activeEvent, dealFilter] = await Promise.all([
    apiFetch<EventsResponse>(`/api/events?${query.toString()}`),
    params.event ? apiFetch<Event>(`/api/events/${params.event}`) : Promise.resolve(null),
    params.deal_id ? apiFetch<DealDetail>(`/api/deals/${params.deal_id}`) : Promise.resolve(null),
  ]);
  const hasMore = offset + eventData.events.length < eventData.total;

  function sourceHref(source: string) {
    const nextQuery = new URLSearchParams();

    if (source) nextQuery.set("source", source);
    if (params.deal_id) nextQuery.set("deal_id", params.deal_id);
    if (params.stage) nextQuery.set("stage", params.stage);

    const next = nextQuery.toString();
    return next ? `/feed?${next}` : "/feed";
  }

  const loadMoreQuery = new URLSearchParams();
  if (params.source) loadMoreQuery.set("source", params.source);
  if (params.deal_id) loadMoreQuery.set("deal_id", params.deal_id);
  if (params.stage) loadMoreQuery.set("stage", params.stage);
  loadMoreQuery.set("offset", String(offset + limit));
  const loadMoreHref = `/feed?${loadMoreQuery.toString()}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {sourceTabs.map((tab) => {
          return <PillLink key={tab.label} href={sourceHref(tab.value)} label={tab.label} active={params.source === tab.value || (!params.source && !tab.value)} />;
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

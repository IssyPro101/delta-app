import Link from "next/link";

import type { Deal, Event, EventMetadata } from "@pipeline-intelligence/shared";

import { formatCurrency, formatDateTime, formatRelativeTime } from "../lib/format";
import { Panel } from "./ui";

const sourceStyles = {
  fathom: "bg-[color:var(--accent)]",
  hubspot: "bg-[color:var(--warn)]",
};

function toNullableNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function buildFeedHref(baseQuery: URLSearchParams, changes: Record<string, string | null | undefined>) {
  const query = new URLSearchParams(baseQuery.toString());

  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined || value === "") {
      query.delete(key);
    } else {
      query.set(key, value);
    }
  }

  const next = query.toString();
  return next ? `/feed?${next}` : "/feed";
}

function renderMetadata(event: Event) {
  const metadata = event.metadata as EventMetadata & Record<string, unknown>;

  switch (event.event_type) {
    case "meeting":
      return (
        <>
          <DetailRow label="Duration" value={`${metadata.duration_minutes ?? 0} minutes`} />
          <DetailRow
            label="Participants"
            value={Array.isArray(metadata.participants) ? metadata.participants.join(", ") : "\u2014"}
          />
          <DetailRow
            label="Topics"
            value={Array.isArray(metadata.key_topics) ? metadata.key_topics.join(", ") : "\u2014"}
          />
        </>
      );
    case "deal_stage_change":
      return (
        <>
          <DetailRow label="Previous stage" value={String(metadata.previous_stage ?? "\u2014")} />
          <DetailRow label="New stage" value={String(metadata.new_stage ?? "\u2014")} />
          <DetailRow label="Changed by" value={String(metadata.changed_by ?? "\u2014")} />
        </>
      );
    case "deal_amount_change":
      return (
        <>
          <DetailRow label="Previous amount" value={formatCurrency(toNullableNumber(metadata.previous_amount))} />
          <DetailRow label="New amount" value={formatCurrency(toNullableNumber(metadata.new_amount))} />
        </>
      );
    case "contact_activity":
      return (
        <>
          <DetailRow label="Activity type" value={String(metadata.activity_type ?? "\u2014")} />
          <DetailRow label="Contact name" value={String(metadata.contact_name ?? "\u2014")} />
          <DetailRow label="Contact email" value={String(metadata.contact_email ?? "\u2014")} />
        </>
      );
    case "deal_created":
      return (
        <>
          <DetailRow label="Stage" value={String(metadata.stage ?? "\u2014")} />
          <DetailRow label="Amount" value={formatCurrency(toNullableNumber(metadata.amount))} />
          <DetailRow label="Pipeline" value={String(metadata.pipeline ?? "\u2014")} />
        </>
      );
    case "deal_closed":
      return (
        <>
          <DetailRow label="Outcome" value={String(metadata.outcome ?? "\u2014")} />
          <DetailRow label="Final stage" value={String(metadata.final_stage ?? "\u2014")} />
          <DetailRow label="Total days in pipeline" value={String(metadata.total_days_in_pipeline ?? "\u2014")} />
        </>
      );
    default:
      return null;
  }
}

function DetailRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="grid gap-1">
      <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
        {label}
      </p>
      <p className="text-sm leading-6 text-[color:var(--text-strong)]">{value}</p>
    </div>
  );
}

export function FeedList({
  events,
  activeEvent,
  dealFilter,
  baseQuery,
  loadMoreHref,
}: Readonly<{
  events: Event[];
  activeEvent?: Event | null;
  dealFilter?: Deal | null;
  baseQuery: URLSearchParams;
  loadMoreHref?: string;
}>) {
  const clearDealHref = buildFeedHref(baseQuery, { deal_id: null, event: null, offset: null });
  const closeEventHref = buildFeedHref(baseQuery, { event: null });
  const showDealHref = activeEvent?.deal ? buildFeedHref(baseQuery, { deal_id: activeEvent.deal.id, event: null }) : null;
  const meetingMetadata = activeEvent?.metadata as EventMetadata & Record<string, unknown> | undefined;
  const recordingUrl = typeof meetingMetadata?.recording_url === "string" ? meetingMetadata.recording_url : null;
  const transcriptUrl = typeof meetingMetadata?.transcript_url === "string" ? meetingMetadata.transcript_url : null;

  return (
    <>
      <div className="space-y-3">
        {dealFilter ? (
          <Panel className="bg-[color:var(--accent-soft)] shadow-none">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-[color:var(--text)]">
                Showing events for <span className="font-medium text-[color:var(--text-strong)]">{dealFilter.name}</span>
              </p>
              <Link href={clearDealHref} className="text-sm font-medium text-[color:var(--accent)] hover:underline">
                Clear
              </Link>
            </div>
          </Panel>
        ) : null}
        {events.map((event) => {
          const href = buildFeedHref(baseQuery, { event: event.id });

          return (
            <Link key={event.id} href={href}>
              <Panel className="cursor-pointer transition-all duration-150 hover:border-[color:var(--line-strong)] hover:bg-[color:var(--panel-strong)]">
                <div className="flex items-start gap-4">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sourceStyles[event.source]}`} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">{event.title}</h3>
                      <p className="shrink-0 font-[var(--font-mono)] text-[11px] text-[color:var(--muted)]">{formatRelativeTime(event.occurred_at)}</p>
                    </div>
                    <p className="text-sm leading-relaxed text-[color:var(--muted)]">{event.summary}</p>
                  </div>
                </div>
              </Panel>
            </Link>
          );
        })}
        {loadMoreHref ? (
          <div className="pt-2">
            <Link
              href={loadMoreHref}
              className="inline-flex rounded-xl border border-[color:var(--line)] px-4 py-2 text-sm font-medium text-[color:var(--muted)] transition-colors hover:border-[color:var(--line-strong)] hover:text-[color:var(--text)]"
            >
              Load more
            </Link>
          </div>
        ) : null}
      </div>

      {activeEvent ? (
        <>
          <Link href={closeEventHref} aria-label="Close event details" className="fixed inset-0 z-30 bg-[rgba(6,6,9,0.7)] backdrop-blur-sm" />
          <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-[480px] animate-[slideInRight_0.25s_ease-out] overflow-y-auto border-l border-[color:var(--line)] bg-[var(--bg-elevated)] p-6 shadow-[-4px_0_24px_rgba(0,0,0,0.5)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Event Detail
                </p>
                <h2 className="mt-2 font-[var(--font-display)] text-xl tracking-[-0.01em] text-[color:var(--text-strong)]">{activeEvent.title}</h2>
              </div>
              <Link href={closeEventHref} className="rounded-lg border border-[color:var(--line)] px-3 py-1.5 text-xs text-[color:var(--muted)] transition-colors hover:border-[color:var(--line-strong)] hover:text-[color:var(--text)]">
                Close
              </Link>
            </div>
            <div className="mt-6 space-y-5">
              <DetailRow label="Occurred" value={formatDateTime(activeEvent.occurred_at)} />
              <DetailRow label="Source" value={activeEvent.source === "fathom" ? "Fathom" : "HubSpot"} />
              {activeEvent.deal ? (
                <>
                  <div className="grid gap-1">
                    <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Deal
                    </p>
                    <Link href={showDealHref ?? "/feed"} className="text-sm font-medium leading-6 text-[color:var(--accent)] hover:underline">
                      {activeEvent.deal.name}
                    </Link>
                  </div>
                  <DetailRow label="Deal stage" value={activeEvent.deal.stage} />
                  <DetailRow label="Deal outcome" value={activeEvent.deal.outcome} />
                </>
              ) : null}
              <div className="space-y-2">
                <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Summary
                </p>
                <p className="text-sm leading-7 text-[color:var(--text)]">{activeEvent.summary}</p>
              </div>
              <div className="space-y-4">
                <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Details
                </p>
                {renderMetadata(activeEvent) ?? (
                  <p className="text-sm text-[color:var(--muted)]">No additional details captured for this event.</p>
                )}
              </div>
              {recordingUrl || transcriptUrl ? (
                <div className="space-y-3">
                  <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Links
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {recordingUrl ? (
                      <a
                        href={recordingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-[color:var(--line)] px-4 py-2 text-sm font-medium text-[color:var(--text)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                      >
                        Recording
                      </a>
                    ) : null}
                    {transcriptUrl ? (
                      <a
                        href={transcriptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-[color:var(--line)] px-4 py-2 text-sm font-medium text-[color:var(--text)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                      >
                        Transcript
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Raw payload
                </p>
                <pre className="max-h-72 overflow-auto rounded-xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 text-xs leading-6 text-[color:var(--muted)]">
                  {JSON.stringify(activeEvent.raw_payload, null, 2)}
                </pre>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}

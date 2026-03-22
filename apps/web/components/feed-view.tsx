import Link from "next/link";

import type { Deal, Event, EventMetadata } from "@pipeline-intelligence/shared";

import { formatCurrency, formatDateTime, formatRelativeTime } from "../lib/format";
import { Panel } from "./ui";

/* ────────────────────────────── helpers ────────────────────────────── */

const STAGE_LABELS: Record<string, string> = {
  appointmentscheduled: "Appointment Scheduled",
  qualifiedtobuy: "Qualified to Buy",
  presentationscheduled: "Presentation Scheduled",
  decisionmakerboughtin: "Decision Maker Bought In",
  contractsent: "Contract Sent",
  closedwon: "Closed Won",
  closedlost: "Closed Lost",
};

function humanStage(raw: string | undefined | null): string {
  if (!raw) return "\u2014";
  return STAGE_LABELS[raw] ?? raw.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

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

interface TranscriptLine {
  speaker?: { display_name?: string };
  text?: string;
  timestamp?: string;
}

function parseMeetingSummary(summary: string): TranscriptLine[] | null {
  try {
    const parsed = JSON.parse(summary);
    if (Array.isArray(parsed)) return parsed as TranscriptLine[];
  } catch {
    // not JSON, return null
  }
  return null;
}

/* ────────────────────────────── icons ────────────────────────────── */

function DealCreatedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DealClosedWonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DealClosedLostIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function StageChangeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 8h8m-3-3.5L11.5 8 8 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MeetingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 7.5h5M5.5 10h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function getEventIcon(event: Event) {
  const metadata = event.metadata as EventMetadata & Record<string, unknown>;

  switch (event.event_type) {
    case "deal_created":
      return { icon: <DealCreatedIcon />, color: "text-[color:var(--accent)]", bg: "bg-[rgba(29,116,231,0.12)]" };
    case "deal_closed":
      if (metadata.outcome === "won")
        return { icon: <DealClosedWonIcon />, color: "text-[color:var(--success)]", bg: "bg-[rgba(62,207,142,0.12)]" };
      return { icon: <DealClosedLostIcon />, color: "text-[color:var(--danger)]", bg: "bg-[rgba(229,72,77,0.12)]" };
    case "deal_stage_change":
      return { icon: <StageChangeIcon />, color: "text-[color:var(--warn)]", bg: "bg-[rgba(240,149,62,0.12)]" };
    case "meeting":
      return { icon: <MeetingIcon />, color: "text-[color:var(--accent)]", bg: "bg-[rgba(29,116,231,0.12)]" };
    default:
      return { icon: <StageChangeIcon />, color: "text-[color:var(--muted)]", bg: "bg-[rgba(255,255,255,0.04)]" };
  }
}

function getEventLabel(event: Event): string {
  switch (event.event_type) {
    case "deal_created": return "New Deal";
    case "deal_closed": return "Deal Closed";
    case "deal_stage_change": return "Stage Change";
    case "deal_amount_change": return "Amount Change";
    case "meeting": return "Meeting";
    case "contact_activity": return "Contact Activity";
    default: return "Event";
  }
}

/* ────────────────────────────── card renderers ────────────────────────────── */

function DealClosedCard({ event }: { event: Event }) {
  const metadata = event.metadata as EventMetadata & Record<string, unknown>;
  const isWon = metadata.outcome === "won";
  const dealName = event.deal?.name ?? event.title.replace(/^Deal Closed\s*—\s*/, "");
  const amount = event.deal?.amount;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          isWon
            ? "bg-[rgba(62,207,142,0.12)] text-[color:var(--success)]"
            : "bg-[rgba(229,72,77,0.12)] text-[color:var(--danger)]"
        }`}>
          {isWon ? "Won" : "Lost"}
        </span>
        {amount != null && (
          <span className="text-sm font-semibold text-[color:var(--text-strong)]">
            {formatCurrency(amount)}
          </span>
        )}
      </div>
      <p className="text-sm text-[color:var(--muted)]">
        {dealName} closed {isWon ? "won" : "lost"} after{" "}
        {metadata.total_days_in_pipeline != null
          ? `${metadata.total_days_in_pipeline} day${Number(metadata.total_days_in_pipeline) !== 1 ? "s" : ""} in pipeline`
          : "pipeline progression"}
      </p>
    </div>
  );
}

function StageChangeCard({ event }: { event: Event }) {
  const metadata = event.metadata as EventMetadata & Record<string, unknown>;
  const from = humanStage(metadata.previous_stage as string);
  const to = humanStage(metadata.new_stage as string);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center rounded-md bg-[rgba(255,255,255,0.04)] border border-[color:var(--line)] px-2 py-0.5 text-xs text-[color:var(--muted)]">
        {from}
      </span>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-[color:var(--muted)]">
        <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="inline-flex items-center rounded-md bg-[rgba(255,255,255,0.04)] border border-[color:var(--line)] px-2 py-0.5 text-xs font-medium text-[color:var(--text-strong)]">
        {to}
      </span>
    </div>
  );
}

function DealCreatedCard({ event }: { event: Event }) {
  const metadata = event.metadata as EventMetadata & Record<string, unknown>;
  const amount = event.deal?.amount ?? toNullableNumber(metadata.amount);
  const pipeline = metadata.pipeline as string | undefined;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {amount != null && (
        <span className="text-sm font-semibold text-[color:var(--text-strong)]">
          {formatCurrency(amount)}
        </span>
      )}
      {pipeline && (
        <span className="inline-flex items-center rounded-md bg-[rgba(255,255,255,0.04)] border border-[color:var(--line)] px-2 py-0.5 text-xs text-[color:var(--muted)]">
          {pipeline}
        </span>
      )}
      <span className="text-xs text-[color:var(--muted)]">
        Imported from {event.source === "fathom" ? "Fathom" : "HubSpot"}
      </span>
    </div>
  );
}

function MeetingCard({ event }: { event: Event }) {
  const metadata = event.metadata as EventMetadata & Record<string, unknown>;
  const transcript = parseMeetingSummary(event.summary);
  const duration = metadata.duration_minutes;
  const participants = Array.isArray(metadata.participants) ? metadata.participants : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap text-xs text-[color:var(--muted)]">
        {duration != null && (
          <span className="inline-flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1" /><path d="M6 3.5V6l2 1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
            {Number(duration) >= 60 ? `${Math.floor(Number(duration) / 60)}h ${Number(duration) % 60}m` : `${duration} min`}
          </span>
        )}
        {participants.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="4" r="2" stroke="currentColor" strokeWidth="1" /><path d="M2 10.5c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
            {participants.length} participant{participants.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {transcript && transcript.length > 0 ? (
        <div className="space-y-1.5 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[color:var(--line)] p-3">
          {transcript.slice(0, 3).map((line, i) => (
            <div key={i} className="flex gap-2 text-xs leading-relaxed">
              <span className="shrink-0 font-medium text-[color:var(--text)]">
                {line.speaker?.display_name?.split(" ")[0] ?? "Speaker"}:
              </span>
              <span className="text-[color:var(--muted)]">{line.text}</span>
            </div>
          ))}
          {transcript.length > 3 && (
            <p className="text-[11px] text-[color:var(--muted)] pt-1">
              +{transcript.length - 3} more lines
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-[color:var(--muted)]">{event.summary}</p>
      )}
    </div>
  );
}

function renderCardBody(event: Event) {
  switch (event.event_type) {
    case "deal_closed":
      return <DealClosedCard event={event} />;
    case "deal_stage_change":
      return <StageChangeCard event={event} />;
    case "deal_created":
      return <DealCreatedCard event={event} />;
    case "meeting":
      return <MeetingCard event={event} />;
    default:
      return <p className="text-sm text-[color:var(--muted)]">{event.summary}</p>;
  }
}

/* ────────────────────────────── detail panel ────────────────────────────── */

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
          <DetailRow label="Previous stage" value={humanStage(metadata.previous_stage as string)} />
          <DetailRow label="New stage" value={humanStage(metadata.new_stage as string)} />
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
          <DetailRow label="Stage" value={humanStage(metadata.stage as string)} />
          <DetailRow label="Amount" value={formatCurrency(toNullableNumber(metadata.amount))} />
          <DetailRow label="Pipeline" value={String(metadata.pipeline ?? "\u2014")} />
        </>
      );
    case "deal_closed":
      return (
        <>
          <DetailRow label="Outcome" value={String(metadata.outcome ?? "\u2014")} />
          <DetailRow label="Final stage" value={humanStage(metadata.final_stage as string)} />
          <DetailRow label="Total days in pipeline" value={String(metadata.total_days_in_pipeline ?? "\u2014")} />
        </>
      );
    default:
      return null;
  }
}

function MeetingTranscriptPanel({ event }: { event: Event }) {
  const transcript = parseMeetingSummary(event.summary);
  if (!transcript || transcript.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
        Transcript
      </p>
      <div className="max-h-64 overflow-y-auto space-y-2 rounded-xl border border-[color:var(--line)] bg-[rgba(255,255,255,0.02)] p-4">
        {transcript.map((line, i) => (
          <div key={i} className="flex gap-2 text-xs leading-relaxed">
            <span className="shrink-0 font-medium text-[color:var(--text)] min-w-[80px]">
              {line.speaker?.display_name?.split(" ")[0] ?? "Speaker"}
            </span>
            <span className="text-[color:var(--muted)]">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────── main list ────────────────────────────── */

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
  const showDealHref = activeEvent?.deal ? `/deals/${activeEvent.deal.id}` : null;
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
          const { icon, color, bg } = getEventIcon(event);
          const label = getEventLabel(event);
          const dealName = event.deal?.name;

          return (
            <Link key={event.id} href={href} className="block">
              <Panel className="cursor-pointer transition-all duration-150 hover:border-[color:var(--line-strong)] hover:bg-[color:var(--panel-strong)]">
                <div className="flex items-start gap-3.5">
                  {/* Icon */}
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg} ${color}`}>
                    {icon}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
                            {label}
                          </span>
                          <span className={`inline-block h-1 w-1 rounded-full ${event.source === "fathom" ? "bg-[color:var(--accent)]" : "bg-[color:var(--warn)]"}`} />
                          <span className="font-[var(--font-mono)] text-[10px] text-[color:var(--muted)]">
                            {event.source === "fathom" ? "Fathom" : "HubSpot"}
                          </span>
                        </div>
                        <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">
                          {dealName ?? event.title.replace(/^(Deal Closed|Deal Stage Change|New Deal|Deal Amount Change|Fathom Meeting)\s*—\s*/, "")}
                        </h3>
                      </div>
                      <p className="shrink-0 font-[var(--font-mono)] text-[11px] text-[color:var(--muted)]">
                        {formatRelativeTime(event.occurred_at)}
                      </p>
                    </div>

                    {/* Event-specific body */}
                    {renderCardBody(event)}
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

      {/* ── Detail panel (slide-over) ── */}
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
                  <DetailRow label="Deal stage" value={humanStage(activeEvent.deal.stage)} />
                  <DetailRow label="Deal outcome" value={activeEvent.deal.outcome} />
                  {activeEvent.deal.amount != null && (
                    <DetailRow label="Deal value" value={formatCurrency(activeEvent.deal.amount)} />
                  )}
                </>
              ) : null}
              <div className="space-y-2">
                <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Summary
                </p>
                {activeEvent.event_type === "meeting" ? (
                  (() => {
                    const transcript = parseMeetingSummary(activeEvent.summary);
                    return transcript ? (
                      <p className="text-sm leading-7 text-[color:var(--text)]">
                        Meeting with {(activeEvent.metadata as Record<string, unknown>)?.participants
                          ? (Array.isArray((activeEvent.metadata as Record<string, unknown>).participants)
                              ? ((activeEvent.metadata as Record<string, unknown>).participants as string[]).join(", ")
                              : "participants")
                          : "participants"}
                      </p>
                    ) : (
                      <p className="text-sm leading-7 text-[color:var(--text)]">{activeEvent.summary}</p>
                    );
                  })()
                ) : (
                  <p className="text-sm leading-7 text-[color:var(--text)]">{activeEvent.summary}</p>
                )}
              </div>
              {activeEvent.event_type === "meeting" && <MeetingTranscriptPanel event={activeEvent} />}
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

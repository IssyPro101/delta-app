"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import type { Deal, Event, Insight } from "@pipeline-intelligence/shared";

import { useDashboardData } from "../../../../components/dashboard-data-provider";
import { EmptyState, Panel } from "../../../../components/ui";
import { formatCurrency, formatDateTime, formatRelativeTime } from "../../../../lib/format";

type TabId = "activity" | "insights";

/* ─── Utilities ──────────────────────────────────────────── */

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function daysSince(value?: string | null) {
  if (!value) return null;
  return Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000));
}

function relevantInsights(deal: Deal, insights: Insight[]) {
  return insights.filter(
    (insight) =>
      insight.is_active &&
      (insight.affected_deals.includes(deal.id) ||
        Boolean(insight.pipeline_name && insight.pipeline_name === deal.pipeline_name)),
  );
}

function stakeholderSummary(deal: Deal, events: Event[], insights: Insight[]) {
  const corpus = [deal.name, deal.company_name, ...events.map((e) => `${e.title} ${e.summary}`), ...insights.map((i) => `${i.title} ${i.description}`)]
    .join(" ")
    .toLowerCase();
  const has = (kw: string) => corpus.includes(kw);

  return [
    { label: "Champion", status: events.some((e) => e.event_type === "contact_activity") ? "present" : ("unknown" as const) },
    { label: "Economic Buyer", status: has("economic buyer") ? "present" : has("missing economic buyer") ? "missing" : ("unknown" as const) },
    { label: "Procurement", status: has("procurement") ? "present" : has("missing procurement") ? "missing" : ("unknown" as const) },
    { label: "Legal / Security", status: has("security") || has("legal") ? "present" : ("unknown" as const) },
  ] as const;
}

function scorecard(deal: Deal, events: Event[], insights: Insight[], stakeholderCount: number) {
  const inactivity = daysSince(deal.last_activity) ?? 14;
  const recentEvents = events.filter((e) => Date.now() - new Date(e.occurred_at).getTime() <= 14 * 86_400_000).length;
  const leaks = insights.filter((i) => i.category === "leak").length;
  const risks = insights.filter((i) => i.category === "risk").length;

  const metrics = [
    { label: "Follow-up Speed", value: clamp(100 - inactivity * 11), detail: `${inactivity}d since last activity` },
    { label: "Stakeholder Coverage", value: clamp((stakeholderCount / 4) * 100), detail: `${stakeholderCount}/4 roles identified` },
    { label: "Engagement", value: clamp(recentEvents * 16 + 20), detail: `${recentEvents} signals in 14d` },
    { label: "Stage Progression", value: clamp(82 - leaks * 14 - risks * 10), detail: `${leaks} leaks, ${risks} risks` },
    { label: "Objection Handling", value: clamp(events.some((e) => `${e.title} ${e.summary}`.toLowerCase().includes("implementation")) ? 44 : 76), detail: "From activity feed" },
    { label: "Next-step Clarity", value: clamp(insights.some((i) => `${i.title} ${i.description}`.toLowerCase().includes("next step")) ? 36 : 80), detail: "From insights" },
  ];

  const overall = clamp(metrics.reduce((s, m) => s + m.value, 0) / metrics.length);
  return { metrics, overall, rep: clamp(overall - leaks * 4) };
}

function scoreColor(value: number) {
  if (value >= 75) return "var(--accent)";
  if (value >= 45) return "var(--warn)";
  return "var(--danger)";
}

function scoreTone(value: number) {
  if (value >= 75) return "bg-[color:var(--accent-soft)] text-[color:var(--accent)]";
  if (value >= 45) return "bg-[color:var(--warn-soft)] text-[color:var(--warn)]";
  return "bg-[color:var(--danger-soft)] text-[color:var(--danger)]";
}

/* ─── Sub-components ─────────────────────────────────────── */

function ScoreBar({ label, value, detail }: Readonly<{ label: string; value: number; detail: string }>) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-[color:var(--text)]">{label}</span>
        <span className="font-[var(--font-mono)] text-sm font-medium" style={{ color: scoreColor(value) }}>{value}</span>
      </div>
      <div className="h-1 rounded-full bg-[color:var(--panel-strong)]">
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${value}%`, backgroundColor: scoreColor(value) }} />
      </div>
      <p className="text-xs text-[color:var(--muted)]">{detail}</p>
    </div>
  );
}

function ActivityTimeline({ events, insights, deal }: Readonly<{ events: Event[]; insights: Insight[]; deal: Deal }>) {
  const items = [
    ...events.map((e) => ({
      id: e.id,
      title: e.title,
      summary: e.summary,
      timestamp: e.occurred_at,
      source: e.source === "fathom" ? "Fathom" : "HubSpot",
    })),
    ...insights.slice(0, 3).map((i) => ({
      id: `insight-${i.id}`,
      title: i.title,
      summary: i.description,
      timestamp: i.generated_at,
      source: "Delta",
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const inactivity = daysSince(deal.last_activity);

  return (
    <div className="space-y-3">
      {inactivity != null && inactivity >= 5 ? (
        <div className={`rounded-xl border px-4 py-3 ${inactivity >= 8 ? "border-[rgba(229,72,77,0.16)] bg-[color:var(--danger-soft)]" : "border-[rgba(240,149,62,0.2)] bg-[color:var(--warn-soft)]"}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[color:var(--text-strong)]">
              <span className="font-semibold">Stalled {inactivity}d</span>
              <span className="text-[color:var(--text)]"> — no meaningful activity detected</span>
            </p>
            <span className="shrink-0 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Delta</span>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-[color:var(--muted)]">No activity recorded yet.</p>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4 transition-colors hover:border-[color:var(--line-strong)] hover:bg-[color:var(--panel-strong)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1.5">
                <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">{item.source}</span>
                <h3 className="text-sm font-semibold text-[color:var(--text-strong)]">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[color:var(--text)]">{item.summary}</p>
              </div>
              <span className="shrink-0 pt-0.5 text-xs text-[color:var(--muted)]">{formatRelativeTime(item.timestamp)}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────── */

export default function DealPage() {
  return (
    <Suspense>
      <DealPageContent />
    </Suspense>
  );
}

function DealPageContent() {
  const params = useParams<{ id: string }>();
  const dealId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data, error, loading } = useDashboardData();
  const [tab, setTab] = useState<TabId>("activity");

  const derived = useMemo(() => {
    if (!data || !dealId) return null;
    const deal = data.deals.find((d) => d.id === dealId);
    if (!deal) return null;
    const events = data.events.filter((e) => e.deal_id === deal.id);
    const insights = relevantInsights(deal, data.insights);
    const stakeholders = stakeholderSummary(deal, events, insights);
    const presentCount = stakeholders.filter((s) => s.status === "present").length;
    const scores = scorecard(deal, events, insights, presentCount);
    return { deal, events, insights, stakeholders, scores };
  }, [data, dealId]);

  if (!data && loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-20">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--line-strong)] border-t-[color:var(--accent)]" />
        <p className="text-sm text-[color:var(--muted)]">Loading deal...</p>
      </div>
    );
  }

  if (!derived) {
    return (
      <EmptyState
        title="Deal not found"
        description={error ?? "This deal could not be found in the current data."}
        action={<Link href="/pipeline" className="text-sm font-medium text-[color:var(--accent)] hover:underline">Back to pipeline</Link>}
      />
    );
  }

  const { deal, events, insights, stakeholders, scores } = derived;
  const risks = insights.filter((i) => i.category === "risk" || i.category === "leak").slice(0, 4);
  const patterns = insights.filter((i) => i.category === "pattern").slice(0, 3);
  const inactivity = daysSince(deal.last_activity);
  const alertInsight = insights[0];

  return (
    <div className="space-y-6">

      {/* ─── Header ─── */}
      <div className="animate-[fadeIn_0.4s_ease-out_both]">
        <Link href="/pipeline" className="inline-flex items-center gap-1.5 text-sm text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Pipeline
        </Link>

        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h1 className="font-[var(--font-display)] text-4xl tracking-[-0.02em] text-[color:var(--text-strong)]">
              {deal.company_name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
              <span className="font-medium text-[color:var(--text-strong)]">{formatCurrency(deal.amount)}</span>
              <span className="text-[color:var(--line-strong)]">&middot;</span>
              <span className="text-[color:var(--text)]">{deal.stage}</span>
              <span className="text-[color:var(--line-strong)]">&middot;</span>
              <span className="text-[color:var(--muted)]">{deal.owner_name ?? "Unassigned"}</span>
              {inactivity !== null && (
                <>
                  <span className="text-[color:var(--line-strong)]">&middot;</span>
                  <span className={inactivity >= 8 ? "text-[color:var(--danger)]" : inactivity >= 5 ? "text-[color:var(--warn)]" : "text-[color:var(--muted)]"}>
                    {inactivity === 0 ? "Active today" : `${inactivity}d since last activity`}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className={`flex shrink-0 flex-col items-center rounded-2xl px-5 py-3 ${scoreTone(scores.overall)}`}>
            <span className="font-[var(--font-display)] text-4xl leading-none">{scores.overall}</span>
            <span className="mt-1.5 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em]">Health</span>
          </div>
        </div>
      </div>

      {/* ─── Metrics row ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-[fadeIn_0.4s_ease-out_both]" style={{ animationDelay: "0.06s" }}>
        <Panel className="p-4">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Rep score</p>
          <p className="mt-2 font-[var(--font-display)] text-2xl text-[color:var(--text-strong)]">{scores.rep}</p>
        </Panel>
        <Panel className="p-4">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Open risks</p>
          <p className="mt-2 font-[var(--font-display)] text-2xl text-[color:var(--text-strong)]">{risks.length}</p>
        </Panel>
        <Panel className="p-4">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Events</p>
          <p className="mt-2 font-[var(--font-display)] text-2xl text-[color:var(--text-strong)]">{events.length}</p>
        </Panel>
        <Panel className="p-4">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Close date</p>
          <p className="mt-2 text-sm font-medium text-[color:var(--text-strong)]">{deal.close_date ? formatDateTime(deal.close_date) : "Not set"}</p>
        </Panel>
      </div>

      {/* ─── Alert ─── */}
      {alertInsight && (
        <div
          className={`rounded-xl border px-5 py-3.5 animate-[fadeIn_0.4s_ease-out_both] ${
            alertInsight.category === "risk" || alertInsight.category === "leak"
              ? "border-[rgba(229,72,77,0.16)] bg-[color:var(--danger-soft)]"
              : "border-[rgba(14,88,221,0.18)] bg-[color:var(--accent-soft)]"
          }`}
          style={{ animationDelay: "0.1s" }}
        >
          <p className="text-sm leading-relaxed text-[color:var(--text)]">
            <span className="font-semibold text-[color:var(--text-strong)]">Delta: </span>
            {alertInsight.description}
          </p>
        </div>
      )}

      {/* ─── Main content ─── */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] animate-[fadeIn_0.4s_ease-out_both]" style={{ animationDelay: "0.14s" }}>

        {/* ─── Left: tabs + content ─── */}
        <div className="space-y-4">
          <div className="flex items-center gap-1 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-1">
            {(["activity", "insights"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  tab === id
                    ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                    : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
                }`}
              >
                {id}
              </button>
            ))}
          </div>

          {tab === "activity" ? (
            <ActivityTimeline events={events} insights={insights} deal={deal} />
          ) : (
            <div className="space-y-4">
              <Panel>
                <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Scorecard</p>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {scores.metrics.map((metric) => (
                    <ScoreBar key={metric.label} {...metric} />
                  ))}
                </div>
              </Panel>

              {risks.length > 0 && (
                <Panel>
                  <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Risks & leaks</p>
                  <div className="mt-4 space-y-3">
                    {risks.map((insight) => (
                      <div key={insight.id} className="rounded-xl border border-[color:var(--line)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-semibold text-[color:var(--text-strong)]">{insight.title}</h3>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] ${
                            insight.category === "risk"
                              ? "bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
                              : "bg-[color:var(--warn-soft)] text-[color:var(--warn)]"
                          }`}>
                            {insight.category}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-[color:var(--text)]">{insight.description}</p>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}

              {patterns.length > 0 && (
                <Panel>
                  <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Patterns</p>
                  <div className="mt-4 space-y-3">
                    {patterns.map((pattern) => (
                      <div key={pattern.id} className="rounded-xl border border-[color:var(--line)] p-4">
                        <h3 className="text-sm font-semibold text-[color:var(--text-strong)]">{pattern.title}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--text)]">{pattern.description}</p>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </div>
          )}
        </div>

        {/* ─── Right: sidebar ─── */}
        <div className="space-y-4">
          <Panel>
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Deal details</p>
            <div className="mt-4 space-y-0">
              {[
                { label: "Value", value: formatCurrency(deal.amount) },
                { label: "Stage", value: deal.stage },
                { label: "Close date", value: deal.close_date ? formatDateTime(deal.close_date) : "Not set" },
                { label: "Owner", value: deal.owner_name ?? "Unassigned" },
                { label: "Last signal", value: deal.last_activity ? formatDateTime(deal.last_activity) : "None" },
              ].map((row, i, arr) => (
                <div key={row.label} className={`flex items-baseline justify-between gap-3 py-2.5 ${i < arr.length - 1 ? "border-b border-[color:var(--line)]" : ""}`}>
                  <span className="text-xs uppercase tracking-[0.15em] text-[color:var(--muted)]">{row.label}</span>
                  <span className="text-right text-sm text-[color:var(--text-strong)]">{row.value}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Stakeholders</p>
            <div className="mt-4 space-y-2.5">
              {stakeholders.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 rounded-full ${
                      s.status === "present" ? "bg-[color:var(--accent)]"
                        : s.status === "missing" ? "bg-[color:var(--danger)]"
                        : "bg-[color:var(--line-strong)]"
                    }`} />
                    <span className="text-sm text-[color:var(--text-strong)]">{s.label}</span>
                  </div>
                  <span className={`text-xs capitalize ${
                    s.status === "present" ? "text-[color:var(--accent)]"
                      : s.status === "missing" ? "text-[color:var(--danger)]"
                      : "text-[color:var(--muted)]"
                  }`}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Coaching</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-[color:var(--line)] p-3">
                <p className="text-sm font-medium text-[color:var(--text-strong)]">Reply within 24h</p>
                <p className="mt-1 text-xs leading-relaxed text-[color:var(--muted)]">Address buyer concerns quickly to maintain momentum.</p>
              </div>
              <div className="rounded-xl border border-[color:var(--line)] p-3">
                <p className="text-sm font-medium text-[color:var(--text-strong)]">Multi-thread earlier</p>
                <p className="mt-1 text-xs leading-relaxed text-[color:var(--muted)]">Engage additional stakeholders to reduce single-thread risk.</p>
              </div>
            </div>
          </Panel>
        </div>

      </div>
    </div>
  );
}

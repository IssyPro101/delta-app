"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import type { Deal, Event, Insight } from "@pipeline-intelligence/shared";

import { useDashboardData } from "../../../../components/dashboard-data-provider";
import { EmptyState, Panel, PrimaryButton, SecondaryButton } from "../../../../components/ui";
import { formatCurrency, formatDateTime, formatRelativeTime } from "../../../../lib/format";

type TabId = "activity" | "insights";

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
  const corpus = [deal.name, deal.company_name, ...events.map((event) => `${event.title} ${event.summary}`), ...insights.map((insight) => `${insight.title} ${insight.description}`)]
    .join(" ")
    .toLowerCase();
  const has = (keyword: string) => corpus.includes(keyword);

  return [
    { label: "Champion", status: events.some((event) => event.event_type === "contact_activity") ? "present" : "unknown", note: "Derived from existing contact activity" },
    { label: "Economic Buyer", status: has("economic buyer") ? "present" : has("missing economic buyer") ? "missing" : "unknown", note: "Pulled from current insights and activity text" },
    { label: "Procurement", status: has("procurement") ? "present" : has("missing procurement") ? "missing" : "unknown", note: "Pulled from current insights and activity text" },
    { label: "Legal / Security", status: has("security") || has("legal") ? "present" : "unknown", note: "Pulled from current insights and activity text" },
  ];
}

function scorecard(deal: Deal, events: Event[], insights: Insight[], stakeholderCount: number) {
  const inactivity = daysSince(deal.last_activity) ?? 14;
  const recentEvents = events.filter((event) => Date.now() - new Date(event.occurred_at).getTime() <= 14 * 86_400_000).length;
  const leaks = insights.filter((insight) => insight.category === "leak").length;
  const risks = insights.filter((insight) => insight.category === "risk").length;

  const metrics = [
    { label: "Follow-up Speed", value: clamp(100 - inactivity * 11), detail: `${inactivity} days since last meaningful activity` },
    { label: "Stakeholder Coverage", value: clamp((stakeholderCount / 4) * 100), detail: `${stakeholderCount}/4 key roles present` },
    { label: "Engagement Consistency", value: clamp(recentEvents * 16 + 20), detail: `${recentEvents} signals in the last 14 days` },
    { label: "Stage Progression", value: clamp(82 - leaks * 14 - risks * 10), detail: `${leaks} leak signals, ${risks} risk signals` },
    { label: "Objection Handling", value: clamp(events.some((event) => `${event.title} ${event.summary}`.toLowerCase().includes("implementation")) ? 44 : 76), detail: "Derived from the current activity feed" },
    { label: "Next-step Clarity", value: clamp(insights.some((insight) => `${insight.title} ${insight.description}`.toLowerCase().includes("next step")) ? 36 : 80), detail: "Derived from the current insights set" },
  ];

  const overall = clamp(metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length);
  return { metrics, overall, rep: clamp(overall - leaks * 4) };
}

function statusTone(value: number) {
  if (value >= 75) return "bg-[color:var(--accent-soft)] text-[color:var(--accent)]";
  if (value >= 45) return "bg-[color:var(--warn-soft)] text-[color:var(--warn)]";
  return "bg-[color:var(--danger-soft)] text-[color:var(--danger)]";
}

function ActivityList({ events, insights, deal }: Readonly<{ events: Event[]; insights: Insight[]; deal: Deal }>) {
  const items = [
    ...events.map((event) => ({
      id: event.id,
      title: event.title,
      summary: event.summary,
      timestamp: event.occurred_at,
      source: event.source === "fathom" ? "Fathom" : "HubSpot",
    })),
    ...insights.slice(0, 3).map((insight) => ({
      id: `insight-${insight.id}`,
      title: insight.title,
      summary: insight.description,
      timestamp: insight.generated_at,
      source: "Delta",
    })),
  ].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());

  const inactivity = daysSince(deal.last_activity);

  return (
    <div className="space-y-4">
      {inactivity && inactivity >= 5 ? (
        <Panel className={inactivity >= 8 ? "border-[rgba(229,72,77,0.16)] bg-[color:var(--danger-soft)]" : "border-[rgba(240,149,62,0.2)] bg-[color:var(--warn-soft)]"}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[color:var(--text-strong)]">Momentum stalled for {inactivity} days</p>
              <p className="text-sm leading-7 text-[color:var(--text)]">Delta detected an inactivity gap using the existing feed data for this deal.</p>
            </div>
            <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Delta</span>
          </div>
        </Panel>
      ) : null}
      {items.map((item) => (
        <Panel key={item.id}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">{item.source}</p>
              <h3 className="text-lg font-semibold text-[color:var(--text-strong)]">{item.title}</h3>
              <p className="text-sm leading-7 text-[color:var(--text)]">{item.summary}</p>
            </div>
            <span className="shrink-0 text-xs text-[color:var(--muted)]">{formatRelativeTime(item.timestamp)}</span>
          </div>
        </Panel>
      ))}
    </div>
  );
}

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
    const deal = data.deals.find((entry) => entry.id === dealId);
    if (!deal) return null;
    const events = data.events.filter((event) => event.deal_id === deal.id);
    const insights = relevantInsights(deal, data.insights);
    const stakeholders = stakeholderSummary(deal, events, insights);
    const presentStakeholders = stakeholders.filter((stakeholder) => stakeholder.status === "present").length;
    const scores = scorecard(deal, events, insights, presentStakeholders);
    return { deal, events, insights, stakeholders, scores };
  }, [data, dealId]);

  if (!data && loading) {
    return (
      <Panel>
        <p className="text-sm text-[color:var(--muted)]">Loading deal workspace...</p>
      </Panel>
    );
  }

  if (!derived) {
    return (
      <EmptyState
        title="Deal not found"
        description={error ?? "We could not find this deal in the existing dashboard data."}
        action={<Link href="/pipeline" className="text-sm font-medium text-[color:var(--accent)] hover:underline">Back to pipeline</Link>}
      />
    );
  }

  const { deal, events, insights, stakeholders, scores } = derived;
  const risks = insights.filter((insight) => insight.category === "risk" || insight.category === "leak").slice(0, 4);
  const patterns = insights.filter((insight) => insight.category === "pattern").slice(0, 3);
  const alert = insights[0]?.description ?? "Delta is monitoring this deal using the current feed and insight analyzers.";
  const inactivity = daysSince(deal.last_activity);

  return (
    <div className="space-y-8">
      <Panel className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--line)] bg-[radial-gradient(circle_at_top_left,rgba(14,88,221,0.18),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.02),transparent)] px-6 py-6 md:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted)]">Deal workspace</p>
                <h2 className="font-[var(--font-display)] text-3xl tracking-[-0.02em] text-[color:var(--text-strong)]">
                  {deal.company_name} - {formatCurrency(deal.amount)}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--muted)]">
                <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${statusTone(scores.overall)}`}>Health {scores.overall}</span>
                <span>Stage: {deal.stage}</span>
                <span>Last activity: {inactivity === null ? "No signal" : `${inactivity} days ago`}</span>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 xl:min-w-[360px]">
              <Panel className="p-4"><p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Health</p><p className="mt-3 font-[var(--font-display)] text-3xl text-[color:var(--text-strong)]">{scores.overall}</p></Panel>
              <Panel className="p-4"><p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Rep score</p><p className="mt-3 font-[var(--font-display)] text-3xl text-[color:var(--text-strong)]">{scores.rep}</p></Panel>
              <Panel className="p-4"><p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Open risks</p><p className="mt-3 font-[var(--font-display)] text-3xl text-[color:var(--text-strong)]">{risks.length}</p></Panel>
            </div>
          </div>
        </div>
        <div className="bg-[color:var(--danger-soft)] px-6 py-4 md:px-8">
          <p className="text-sm leading-7 text-[color:var(--text)]"><span className="font-semibold text-[color:var(--text-strong)]">Delta alert:</span> {alert}</p>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Panel>
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Deal snapshot</p>
            <div className="mt-4 grid gap-4">
              <div><p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Value</p><p className="mt-1 text-sm text-[color:var(--text-strong)]">{formatCurrency(deal.amount)}</p></div>
              <div><p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Stage</p><p className="mt-1 text-sm text-[color:var(--text-strong)]">{deal.stage}</p></div>
              <div><p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Close date</p><p className="mt-1 text-sm text-[color:var(--text-strong)]">{deal.close_date ? formatDateTime(deal.close_date) : "Not set"}</p></div>
              <div><p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Owner</p><p className="mt-1 text-sm text-[color:var(--text-strong)]">{deal.owner_name ?? "Unassigned"}</p></div>
            </div>
          </Panel>

          <Panel>
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Stakeholders</p>
            <div className="mt-4 space-y-3">
              {stakeholders.map((stakeholder) => (
                <div key={stakeholder.label} className={`rounded-2xl border p-4 ${stakeholder.status === "present" ? "border-[rgba(14,88,221,0.18)] bg-[color:var(--accent-soft)]" : stakeholder.status === "missing" ? "border-[rgba(229,72,77,0.16)] bg-[color:var(--danger-soft)]" : "border-[color:var(--line)] bg-[color:var(--panel-strong)]"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[color:var(--text-strong)]">{stakeholder.label}</p>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">{stakeholder.status}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--text)]">{stakeholder.note}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Key deal info</p>
            <div className="mt-4 grid gap-4">
              <div><p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Current blocker</p><p className="mt-1 text-sm text-[color:var(--text-strong)]">{risks[0]?.title ?? "No active blocker flagged"}</p></div>
              <div><p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Next step</p><p className="mt-1 text-sm text-[color:var(--text-strong)]">{insights.some((insight) => `${insight.title} ${insight.description}`.toLowerCase().includes("next step")) ? "Missing in current record" : "Delta sees a next-step signal"}</p></div>
              <div><p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Implementation concern</p><p className="mt-1 text-sm text-[color:var(--text-strong)]">{events.find((event) => `${event.title} ${event.summary}`.toLowerCase().includes("implementation"))?.summary ?? "No implementation concern captured"}</p></div>
              <div><p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Last synced signal</p><p className="mt-1 text-sm text-[color:var(--text-strong)]">{deal.last_activity ? formatDateTime(deal.last_activity) : "No synced activity yet"}</p></div>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Main workspace</p>
                <h3 className="mt-2 font-[var(--font-display)] text-2xl text-[color:var(--text-strong)]">Activity and coaching</h3>
              </div>
              <div className="inline-flex rounded-full border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-1">
                <button type="button" onClick={() => setTab("activity")} className={`rounded-full px-4 py-2 text-sm ${tab === "activity" ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]" : "text-[color:var(--muted)]"}`}>Activity</button>
                <button type="button" onClick={() => setTab("insights")} className={`rounded-full px-4 py-2 text-sm ${tab === "insights" ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]" : "text-[color:var(--muted)]"}`}>Insights</button>
              </div>
            </div>
          </Panel>

          {tab === "activity" ? (
            <ActivityList events={events} insights={insights} deal={deal} />
          ) : (
            <div className="space-y-6">
              <Panel>
                <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Deal scorecard</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {scores.metrics.map((metric) => (
                    <div key={metric.label} className={`rounded-2xl border p-4 ${statusTone(metric.value)}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">{metric.label}</p>
                        <span className="font-[var(--font-display)] text-2xl">{metric.value}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 opacity-90">{metric.detail}</p>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel>
                <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Mistakes and missed actions</p>
                <div className="mt-4 space-y-3">
                  {risks.map((insight) => (
                    <div key={insight.id} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-[color:var(--text-strong)]">{insight.title}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${insight.category === "risk" ? "bg-[color:var(--danger-soft)] text-[color:var(--danger)]" : "bg-[color:var(--warn-soft)] text-[color:var(--warn)]"}`}>{insight.category}</span>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-[color:var(--text)]">{insight.description}</p>
                    </div>
                  ))}
                </div>
              </Panel>

              <div className="grid gap-6 lg:grid-cols-2">
                <Panel>
                  <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Historical patterns</p>
                  <div className="mt-4 space-y-3">
                    {patterns.length === 0 ? (
                      <p className="text-sm text-[color:var(--muted)]">Patterns will appear here when the existing analyzers have enough history.</p>
                    ) : (
                      patterns.map((pattern) => (
                        <div key={pattern.id} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
                          <h3 className="text-base font-semibold text-[color:var(--text-strong)]">{pattern.title}</h3>
                          <p className="mt-2 text-sm leading-7 text-[color:var(--text)]">{pattern.description}</p>
                        </div>
                      ))
                    )}
                  </div>
                </Panel>

                <Panel>
                  <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Suggested coaching actions</p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4"><p className="text-sm font-semibold text-[color:var(--text-strong)]">Reply within 24 hours to buyer concerns</p><p className="mt-2 text-sm leading-7 text-[color:var(--text)]">This recommendation is grounded in the current activity feed and the active insight set.</p></div>
                    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4"><p className="text-sm font-semibold text-[color:var(--text-strong)]">Multi-thread the account earlier</p><p className="mt-2 text-sm leading-7 text-[color:var(--text)]">Use the stakeholder coverage panel to close gaps in economic buyer and procurement coverage.</p></div>
                  </div>
                </Panel>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Panel className="sticky top-28">
            <div className="space-y-6">
              <div>
                <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Delta</p>
                <h3 className="mt-2 font-[var(--font-display)] text-2xl text-[color:var(--text-strong)]">Action assistant</h3>
                <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">Assisting on {deal.company_name} in {deal.stage} using the current dashboard context.</p>
              </div>
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Next best actions</p>
                {[
                  "Draft a buyer follow-up",
                  "Add procurement stakeholder",
                  "Update CRM from discovered signals",
                  "Prepare meeting brief",
                ].map((action) => (
                  <div key={action} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
                    <p className="text-sm font-semibold text-[color:var(--text-strong)]">{action}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3">
                <PrimaryButton>Draft follow-up email</PrimaryButton>
                <SecondaryButton>Generate implementation brief</SecondaryButton>
                <SecondaryButton>Update CRM from signals</SecondaryButton>
                <SecondaryButton>Add missing stakeholder</SecondaryButton>
              </div>
              <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
                <p className="text-sm font-semibold text-[color:var(--text-strong)]">Delta chat</p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--text)]">&quot;Draft a reply to the latest implementation concern&quot;</p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--text)]">&quot;Why is this deal at risk?&quot;</p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--text)]">&quot;What changed in the last 7 days?&quot;</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

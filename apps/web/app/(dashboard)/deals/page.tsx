"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";

import type { Deal, Insight } from "@pipeline-intelligence/shared";

import { useDashboardData } from "../../../components/dashboard-data-provider";
import { EmptyState, Panel } from "../../../components/ui";
import { formatCurrency, formatRelativeTime } from "../../../lib/format";

/* ─── Utilities ──────────────────────────────────────────── */

type SortKey = "company" | "amount" | "stage" | "activity";
type SortDir = "asc" | "desc";

function daysSince(value?: string | null) {
  if (!value) return null;
  return Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000));
}

function dealHealthScore(deal: Deal, insights: Insight[]) {
  const related = insights.filter(
    (i) =>
      i.is_active &&
      (i.affected_deals.includes(deal.id) ||
        Boolean(i.pipeline_name && i.pipeline_name === deal.pipeline_name)),
  );
  const leaks = related.filter((i) => i.category === "leak").length;
  const risks = related.filter((i) => i.category === "risk").length;
  const inactivity = daysSince(deal.last_activity) ?? 14;
  const base = Math.max(0, Math.min(100, Math.round(82 - inactivity * 4 - leaks * 12 - risks * 8)));
  return base;
}

function healthColor(score: number) {
  if (score >= 70) return "var(--accent)";
  if (score >= 40) return "var(--warn)";
  return "var(--danger)";
}

function healthTone(score: number) {
  if (score >= 70) return "bg-[color:var(--accent-soft)] text-[color:var(--accent)]";
  if (score >= 40) return "bg-[color:var(--warn-soft)] text-[color:var(--warn)]";
  return "bg-[color:var(--danger-soft)] text-[color:var(--danger)]";
}

function activityStatus(deal: Deal) {
  const days = daysSince(deal.last_activity);
  if (days === null) return { label: "No activity", tone: "text-[color:var(--muted)]" };
  if (days === 0) return { label: "Active today", tone: "text-[color:var(--accent)]" };
  if (days <= 3) return { label: `${days}d ago`, tone: "text-[color:var(--text)]" };
  if (days <= 7) return { label: `${days}d ago`, tone: "text-[color:var(--warn)]" };
  return { label: `${days}d ago`, tone: "text-[color:var(--danger)]" };
}

function sortDeals(deals: Array<{ deal: Deal; health: number }>, key: SortKey, dir: SortDir) {
  const sorted = [...deals].sort((a, b) => {
    switch (key) {
      case "company":
        return a.deal.company_name.localeCompare(b.deal.company_name);
      case "amount":
        return (a.deal.amount ?? 0) - (b.deal.amount ?? 0);
      case "stage":
        return a.deal.stage.localeCompare(b.deal.stage);
      case "activity":
        return new Date(a.deal.last_activity).getTime() - new Date(b.deal.last_activity).getTime();
    }
  });
  return dir === "desc" ? sorted.reverse() : sorted;
}

/* ─── Sub-components ─────────────────────────────────────── */

function SortButton({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: Readonly<{
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
}>) {
  const active = currentKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 text-xs font-medium uppercase tracking-[0.12em] transition-colors ${
        active ? "text-[color:var(--accent)]" : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
      }`}
    >
      {label}
      {active && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className={currentDir === "asc" ? "rotate-180" : ""}>
          <path d="M5 6.5L2 3.5h6L5 6.5z" />
        </svg>
      )}
    </button>
  );
}

function DealRow({ deal, health }: Readonly<{ deal: Deal; health: number }>) {
  const activity = activityStatus(deal);
  const riskCount = health < 40 ? "high" : health < 70 ? "medium" : null;

  return (
    <Link
      href={`/deals/${deal.id}`}
      className="group block rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow)] backdrop-blur-sm transition-all duration-200 hover:border-[color:var(--line-strong)] hover:bg-[color:var(--panel-strong)] hover:shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-start gap-4">
        {/* Health indicator */}
        <div className="hidden sm:block">
          <div
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${healthTone(health)}`}
          >
            <span className="font-[var(--font-mono)] text-sm font-semibold">{health}</span>
          </div>
        </div>

        {/* Deal info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-[var(--font-display)] text-lg text-[color:var(--text-strong)] transition-colors group-hover:text-[color:var(--accent)]">
                {deal.company_name}
              </h3>
              <p className="mt-0.5 truncate text-sm text-[color:var(--muted)]">{deal.name}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              <span className={`sm:hidden rounded-md px-1.5 py-0.5 font-[var(--font-mono)] text-[11px] font-semibold ${healthTone(health)}`}>
                {health}
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="text-[color:var(--muted)] opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[color:var(--accent)] group-hover:opacity-100"
              >
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="text-sm font-medium text-[color:var(--text-strong)]">
              {formatCurrency(deal.amount)}
            </span>
            <span className="rounded-md border border-[color:var(--line)] px-2 py-0.5 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.15em] text-[color:var(--text)]">
              {deal.stage}
            </span>
            <span className={`text-xs ${activity.tone}`}>{activity.label}</span>
            {deal.owner_name && (
              <span className="text-xs text-[color:var(--muted)]">{deal.owner_name}</span>
            )}
            {riskCount && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${
                riskCount === "high"
                  ? "bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
                  : "bg-[color:var(--warn-soft)] text-[color:var(--warn)]"
              }`}>
                {riskCount} risk
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Health bar */}
      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-[color:var(--panel-strong)]">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${health}%`, backgroundColor: healthColor(health) }}
        />
      </div>
    </Link>
  );
}

/* ─── Page ───────────────────────────────────────────────── */

export default function DealsPage() {
  return (
    <Suspense>
      <DealsPageContent />
    </Suspense>
  );
}

function DealsPageContent() {
  const { data, error, loading } = useDashboardData();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("activity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | "open" | "won" | "lost">("all");

  const enrichedDeals = useMemo(() => {
    if (!data) return [];
    return data.deals.map((deal) => ({
      deal,
      health: dealHealthScore(deal, data.insights),
    }));
  }, [data]);

  const filtered = useMemo(() => {
    let result = enrichedDeals;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        ({ deal }) =>
          deal.company_name.toLowerCase().includes(q) ||
          deal.name.toLowerCase().includes(q) ||
          (deal.owner_name?.toLowerCase().includes(q) ?? false) ||
          deal.stage.toLowerCase().includes(q),
      );
    }
    if (outcomeFilter !== "all") {
      result = result.filter(({ deal }) => deal.outcome === outcomeFilter);
    }
    return sortDeals(result, sortKey, sortDir);
  }, [enrichedDeals, search, sortKey, sortDir, outcomeFilter]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (!data && loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-20">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--line-strong)] border-t-[color:var(--accent)]" />
        <p className="text-sm text-[color:var(--muted)]">Loading deals...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Unable to load deals"
        description={error ?? "Something went wrong while fetching deal data."}
      />
    );
  }

  /* ─── Summary stats ─── */
  const totalValue = enrichedDeals.reduce((s, { deal }) => s + (deal.amount ?? 0), 0);
  const openDeals = enrichedDeals.filter(({ deal }) => deal.outcome === "open");
  const avgHealth = openDeals.length > 0 ? Math.round(openDeals.reduce((s, d) => s + d.health, 0) / openDeals.length) : 0;
  const atRisk = openDeals.filter((d) => d.health < 40).length;

  return (
    <div className="space-y-6">
      {/* ─── Summary cards ─── */}
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-[fadeIn_0.4s_ease-out_both]"
      >
        <Panel className="p-4">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Total deals
          </p>
          <p className="mt-2 font-[var(--font-display)] text-2xl text-[color:var(--text-strong)]">
            {enrichedDeals.length}
          </p>
        </Panel>
        <Panel className="p-4">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Pipeline value
          </p>
          <p className="mt-2 font-[var(--font-display)] text-2xl text-[color:var(--text-strong)]">
            {formatCurrency(totalValue)}
          </p>
        </Panel>
        <Panel className="p-4">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Avg. health
          </p>
          <p className="mt-2 font-[var(--font-display)] text-2xl" style={{ color: healthColor(avgHealth) }}>
            {avgHealth}
          </p>
        </Panel>
        <Panel className="p-4">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            At risk
          </p>
          <p className="mt-2 font-[var(--font-display)] text-2xl text-[color:var(--danger)]">
            {atRisk}
          </p>
        </Panel>
      </div>

      {/* ─── Toolbar ─── */}
      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-[fadeIn_0.4s_ease-out_both]"
        style={{ animationDelay: "0.06s" }}
      >
        {/* Search */}
        <div className="relative max-w-sm flex-1">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
          >
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search deals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] py-2.5 pl-10 pr-4 text-sm text-[color:var(--text-strong)] placeholder-[color:var(--muted)] outline-none transition-colors focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-1">
          {(["all", "open", "won", "lost"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setOutcomeFilter(id)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                outcomeFilter === id
                  ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                  : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
              }`}
            >
              {id}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Sort bar ─── */}
      <div
        className="flex items-center gap-5 animate-[fadeIn_0.4s_ease-out_both]"
        style={{ animationDelay: "0.1s" }}
      >
        <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Sort</span>
        <SortButton label="Company" sortKey="company" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
        <SortButton label="Amount" sortKey="amount" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
        <SortButton label="Stage" sortKey="stage" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
        <SortButton label="Activity" sortKey="activity" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
      </div>

      {/* ─── Deal list ─── */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <EmptyState
            title="No deals found"
            description={search ? `No deals match "${search}".` : "No deals in this category yet."}
          />
        ) : (
          filtered.map(({ deal, health }, i) => (
            <div
              key={deal.id}
              className="animate-[fadeIn_0.35s_ease-out_both]"
              style={{ animationDelay: `${0.14 + i * 0.03}s` }}
            >
              <DealRow deal={deal} health={health} />
            </div>
          ))
        )}
      </div>

      {/* ─── Count footer ─── */}
      {filtered.length > 0 && (
        <p className="text-center text-xs text-[color:var(--muted)] animate-[fadeIn_0.4s_ease-out_both]" style={{ animationDelay: "0.3s" }}>
          Showing {filtered.length} of {enrichedDeals.length} deals
        </p>
      )}
    </div>
  );
}

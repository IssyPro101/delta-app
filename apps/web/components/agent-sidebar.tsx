"use client";

import clsx from "clsx";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AgentConversationDetailResponse, AgentConversationSummary } from "@pipeline-intelligence/shared";

import { getAgentConversation } from "../lib/agent-api";
import { toErrorMessage } from "../lib/api";
import { useAgentChat } from "./agent-chat-provider";
import { EmptyState } from "./ui";

/* ── Helpers ── */

function formatTimestamp(value: string | null) {
  if (!value) return "No messages yet";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatToolName(partType: string, dynamicName?: string) {
  const rawName = partType === "dynamic-tool" ? dynamicName ?? "tool" : partType.replace(/^tool-/, "");
  return rawName
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getToolName(part: Record<string, unknown> & { type: string }): string {
  if (part.type === "dynamic-tool" && typeof part.toolName === "string") return part.toolName;
  return typeof part.toolName === "string" ? part.toolName : part.type.replace(/^tool-/, "");
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function relativeTime(value: string | null | undefined): string {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── Typed helpers for safe access ── */

function asObj(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asNum(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/* ── Icons ── */

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M14.5 1.5L7 9M14.5 1.5L10 14.5L7 9M14.5 1.5L1.5 6L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M11 3L3 11M3 3L11 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2V12M2 7H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={clsx("transition-transform duration-200", open && "rotate-180")}
    >
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-spin">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <path d="M12.5 7A5.5 5.5 0 0 0 7 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* ── Metric cell (used across multiple tool renderers) ── */

function MetricCell({ label, value, accent }: Readonly<{ label: string; value: string | number; accent?: boolean }>) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate font-[var(--font-mono)] text-[11px] tracking-[0.02em] text-[color:var(--muted)]">{label}</p>
      <p className={clsx(
        "mt-0.5 truncate font-[var(--font-mono)] text-[13px] font-semibold",
        accent ? "text-[color:var(--accent)]" : "text-[color:var(--text-strong)]",
      )}>{value}</p>
    </div>
  );
}

/* ── Severity / category helpers ── */

function severityColor(severity: string): string {
  switch (severity) {
    case "high": return "var(--danger)";
    case "medium": return "var(--warn)";
    default: return "var(--accent)";
  }
}

function categoryLabel(category: string): string {
  switch (category) {
    case "leak": return "Leak";
    case "pattern": return "Pattern";
    case "risk": return "Risk";
    default: return category.charAt(0).toUpperCase() + category.slice(1);
  }
}

function outcomeColor(outcome: string): string {
  switch (outcome) {
    case "won": return "var(--success)";
    case "lost": return "var(--danger)";
    default: return "var(--accent)";
  }
}

/* ── Tool-specific renderers ── */

function WorkspaceSnapshotResult({ data }: Readonly<{ data: Record<string, unknown> }>) {
  const overview = asObj(data.overview);
  if (!overview) return null;

  const totalDeals = asNum(overview.total_deals) ?? 0;
  const openDeals = asNum(overview.open_deals) ?? 0;
  const wonDeals = asNum(overview.won_deals) ?? 0;
  const lostDeals = asNum(overview.lost_deals) ?? 0;
  const totalAmount = asNum(overview.total_open_amount);
  const activeInsights = asNum(overview.active_insights) ?? 0;
  const stageDistribution = asArr(overview.stage_distribution);
  const highlightedDeals = asArr(data.highlighted_deals);

  const maxStageCount = stageDistribution.reduce<number>((max, item) => {
    const obj = asObj(item);
    const count = obj ? asNum(obj.count) ?? 0 : 0;
    return Math.max(max, count);
  }, 1);

  return (
    <div className="space-y-2.5">
      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCell label="Pipeline" value={formatCurrency(totalAmount)} accent />
        <MetricCell label="Open" value={openDeals} />
        <MetricCell label="Total" value={totalDeals} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MetricCell label="Won" value={wonDeals} />
        <MetricCell label="Lost" value={lostDeals} />
        <MetricCell label="Insights" value={activeInsights} />
      </div>

      {/* Stage distribution mini bars */}
      {stageDistribution.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[color:var(--muted)]">Stages</p>
          {stageDistribution.map((item, i) => {
            const obj = asObj(item);
            if (!obj) return null;
            const name = asStr(obj.stage);
            const count = asNum(obj.count) ?? 0;
            const pct = Math.max((count / maxStageCount) * 100, 4);
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-16 shrink-0 truncate text-[10px] text-[color:var(--muted)]">{name}</span>
                <div className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.04)]">
                  <div className="h-full rounded-full bg-[color:var(--accent)]" style={{ width: `${pct}%`, opacity: 0.7 + (count / maxStageCount) * 0.3 }} />
                </div>
                <span className="w-5 shrink-0 text-right font-[var(--font-mono)] text-[10px] text-[color:var(--text)]">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Highlighted deals */}
      {highlightedDeals.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[color:var(--muted)]">Highlighted Deals</p>
          {highlightedDeals.slice(0, 4).map((deal, i) => {
            const d = asObj(deal);
            if (!d) return null;
            return (
              <div key={i} className="flex items-center justify-between gap-2 rounded-md bg-[rgba(255,255,255,0.02)] px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-[color:var(--text-strong)]">{asStr(d.name)}</p>
                  <p className="truncate text-[10px] text-[color:var(--muted)]">{asStr(d.company_name)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--text)]">
                  {asStr(d.stage)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PipelineSummaryResult({ data }: Readonly<{ data: Record<string, unknown> }>) {
  const summary = asObj(data.summary);
  const stages = asArr(data.stages);
  if (!summary) return null;

  const winRate = asNum(summary.overall_win_rate) ?? 0;
  const cycleDays = asNum(summary.avg_deal_cycle_days) ?? 0;
  const totalDeals = asNum(summary.total_deals) ?? 0;
  const won = asNum(summary.won) ?? 0;
  const lost = asNum(summary.lost) ?? 0;

  return (
    <div className="space-y-2.5">
      {/* Top metrics */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCell label="Win Rate" value={`${winRate.toFixed(0)}%`} accent />
        <MetricCell label="Avg Cycle" value={`${cycleDays.toFixed(0)}d`} />
        <MetricCell label="Deals" value={totalDeals} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MetricCell label="Won" value={won} />
        <MetricCell label="Lost" value={lost} />
      </div>

      {/* Stage funnel */}
      {stages.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[color:var(--muted)]">Conversion Funnel</p>
          {stages.map((stage, i) => {
            const s = asObj(stage);
            if (!s) return null;
            const name = asStr(s.name);
            const convRate = asNum(s.conversion_rate) ?? 0;
            const entered = asNum(s.deals_entered) ?? 0;
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-20 shrink-0 truncate text-[10px] text-[color:var(--muted)]">{name}</span>
                <div className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.04)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(convRate, 3)}%`,
                      background: `linear-gradient(90deg, var(--accent), ${convRate > 50 ? "var(--success)" : "var(--accent)"})`,
                    }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-[var(--font-mono)] text-[10px] text-[color:var(--text)]">
                  {convRate.toFixed(0)}% <span className="text-[color:var(--muted)]">({entered})</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InsightsResult({ data }: Readonly<{ data: Record<string, unknown> }>) {
  const insights = asArr(data.insights);
  const total = asNum(data.total) ?? insights.length;

  if (insights.length === 0) {
    return <p className="text-[11px] text-[color:var(--muted)]">No active insights found.</p>;
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-[color:var(--muted)]">{total} insight{total !== 1 ? "s" : ""} found</p>
      {insights.slice(0, 5).map((insight, i) => {
        const ins = asObj(insight);
        if (!ins) return null;
        const severity = asStr(ins.severity);
        const category = asStr(ins.category);
        return (
          <div key={i} className="rounded-md border border-[color:var(--line)] bg-[rgba(255,255,255,0.015)] px-2.5 py-2">
            <div className="flex items-start gap-2">
              <span
                className="mt-1 h-[6px] w-[6px] shrink-0 rounded-full"
                style={{ background: severityColor(severity) }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="rounded-sm px-1 py-[1px] text-[9px] font-semibold uppercase tracking-[0.06em]"
                    style={{
                      background: `color-mix(in srgb, ${severityColor(severity)} 12%, transparent)`,
                      color: severityColor(severity),
                    }}
                  >
                    {categoryLabel(category)}
                  </span>
                  <span className="text-[9px] capitalize text-[color:var(--muted)]">{severity}</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-[16px] text-[color:var(--text-strong)]">{asStr(ins.title)}</p>
                {asStr(ins.description) && (
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-[14px] text-[color:var(--muted)]">
                    {asStr(ins.description)}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {insights.length > 5 && (
        <p className="text-[10px] text-[color:var(--muted)]">+{insights.length - 5} more</p>
      )}
    </div>
  );
}

function DealSearchResult({ data }: Readonly<{ data: Record<string, unknown> }>) {
  const deals = asArr(data.deals);
  const total = asNum(data.total) ?? deals.length;

  if (deals.length === 0) {
    return <p className="text-[11px] text-[color:var(--muted)]">No deals found.</p>;
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-[color:var(--muted)]">{total} deal{total !== 1 ? "s" : ""} found</p>
      {deals.slice(0, 6).map((deal, i) => {
        const d = asObj(deal);
        if (!d) return null;
        const outcome = asStr(d.outcome);
        return (
          <div key={i} className="flex items-center gap-2 rounded-md bg-[rgba(255,255,255,0.02)] px-2.5 py-1.5">
            <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: outcomeColor(outcome) }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-[color:var(--text-strong)]">{asStr(d.name)}</p>
              <p className="truncate text-[10px] text-[color:var(--muted)]">
                {asStr(d.company_name)}{asStr(d.owner_name) ? ` · ${asStr(d.owner_name)}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className="inline-block rounded-full bg-[rgba(255,255,255,0.05)] px-1.5 py-[2px] text-[10px] font-medium text-[color:var(--text)]">
                {asStr(d.stage)}
              </span>
              {asNum(d.amount) != null && (
                <p className="mt-0.5 font-[var(--font-mono)] text-[10px] text-[color:var(--accent)]">{formatCurrency(asNum(d.amount))}</p>
              )}
            </div>
          </div>
        );
      })}
      {deals.length > 6 && (
        <p className="text-[10px] text-[color:var(--muted)]">+{deals.length - 6} more</p>
      )}
    </div>
  );
}

function DealContextResult({ data }: Readonly<{ data: Record<string, unknown> }>) {
  const deal = asObj(data.deal);
  if (!deal) return null;

  const transitions = asArr(deal.stage_transitions);
  const relatedInsights = asArr(data.related_insights);
  const recentActivity = asArr(data.recent_activity);
  const outcome = asStr(deal.outcome);

  return (
    <div className="space-y-2.5">
      {/* Deal header */}
      <div className="rounded-md border border-[color:var(--line)] bg-[rgba(255,255,255,0.02)] px-2.5 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-[color:var(--text-strong)]">{asStr(deal.name)}</p>
            <p className="truncate text-[10px] text-[color:var(--muted)]">{asStr(deal.company_name)}</p>
          </div>
          <span
            className="shrink-0 rounded-full px-1.5 py-[2px] text-[10px] font-semibold"
            style={{
              background: `color-mix(in srgb, ${outcomeColor(outcome)} 12%, transparent)`,
              color: outcomeColor(outcome),
            }}
          >
            {outcome.toUpperCase()}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <MetricCell label="Stage" value={asStr(deal.stage)} />
          <MetricCell label="Amount" value={formatCurrency(asNum(deal.amount))} accent />
          <MetricCell label="Close" value={formatShortDate(asStr(deal.close_date) || null)} />
        </div>
      </div>

      {/* Stage transitions timeline */}
      {transitions.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[color:var(--muted)]">Stage History</p>
          <div className="relative ml-1.5 border-l border-[color:var(--line)] pl-3">
            {transitions.slice(0, 6).map((t, i) => {
              const tr = asObj(t);
              if (!tr) return null;
              return (
                <div key={i} className="relative py-1">
                  <span className="absolute -left-[14.5px] top-[10px] h-[5px] w-[5px] rounded-full bg-[color:var(--accent)]" />
                  <p className="text-[11px] text-[color:var(--text-strong)]">
                    {asStr(tr.from_stage) ? `${asStr(tr.from_stage)} → ` : ""}{asStr(tr.to_stage)}
                  </p>
                  <p className="text-[10px] text-[color:var(--muted)]">
                    {formatShortDate(asStr(tr.transitioned_at) || null)}
                    {asNum(tr.time_in_stage_hours) != null && ` · ${Math.round((asNum(tr.time_in_stage_hours) ?? 0) / 24)}d in stage`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Related insights */}
      {relatedInsights.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[color:var(--muted)]">
            {relatedInsights.length} Related Insight{relatedInsights.length !== 1 ? "s" : ""}
          </p>
          {relatedInsights.slice(0, 3).map((insight, i) => {
            const ins = asObj(insight);
            if (!ins) return null;
            return (
              <div key={i} className="flex items-start gap-1.5">
                <span className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: severityColor(asStr(ins.severity)) }} />
                <p className="text-[10px] leading-[14px] text-[color:var(--text)]">{asStr(ins.title)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent activity count */}
      {recentActivity.length > 0 && (
        <p className="text-[10px] text-[color:var(--muted)]">{recentActivity.length} recent activit{recentActivity.length !== 1 ? "ies" : "y"}</p>
      )}
    </div>
  );
}

function ActivityResult({ data }: Readonly<{ data: Record<string, unknown> }>) {
  const events = asArr(data.events);
  const total = asNum(data.total) ?? events.length;

  if (events.length === 0) {
    return <p className="text-[11px] text-[color:var(--muted)]">No recent activity.</p>;
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-[color:var(--muted)]">{total} event{total !== 1 ? "s" : ""}</p>
      {events.slice(0, 6).map((event, i) => {
        const ev = asObj(event);
        if (!ev) return null;
        const eventType = asStr(ev.event_type);
        const dealObj = asObj(ev.deal);
        return (
          <div key={i} className="flex items-start gap-2 rounded-md bg-[rgba(255,255,255,0.02)] px-2 py-1.5">
            <span className="mt-0.5 shrink-0 text-[color:var(--muted)]">
              <ActivityIcon type={eventType} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] text-[color:var(--text-strong)]">{asStr(ev.title)}</p>
              <p className="truncate text-[10px] text-[color:var(--muted)]">
                {dealObj ? asStr(dealObj.name) : ""}
                {asStr(ev.occurred_at) ? ` · ${relativeTime(asStr(ev.occurred_at))}` : ""}
              </p>
            </div>
          </div>
        );
      })}
      {events.length > 6 && (
        <p className="text-[10px] text-[color:var(--muted)]">+{events.length - 6} more</p>
      )}
    </div>
  );
}

function ActivityIcon({ type }: Readonly<{ type: string }>) {
  switch (type) {
    case "meeting":
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1" />
          <path d="M6 3.5V6L7.5 7.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
      );
    case "deal_stage_change":
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6H10M7 3L10 6L7 9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "deal_created":
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
      );
    case "deal_closed":
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 6L5.5 8.5L9 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="2" fill="currentColor" opacity="0.5" />
        </svg>
      );
  }
}

function HubSpotActionResult({ data }: Readonly<{ data: Record<string, unknown> }>) {
  const summary = asStr(data.summary);
  const action = asStr(data.action);
  const status = asStr(data.status);
  const isCompleted = status === "completed";

  const actionLabel = action.includes("note") ? "Note Saved"
    : action.includes("task") ? "Task Created"
    : action.includes("email") ? "Email Logged"
    : "Action Completed";

  return (
    <div className={clsx(
      "flex items-start gap-2 rounded-md border px-2.5 py-2",
      isCompleted ? "border-[color:var(--success-soft)] bg-[color:var(--success-soft)]" : "border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]",
    )}>
      <span className="mt-[1px] shrink-0">
        {isCompleted ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="var(--success)" strokeWidth="1.2" />
            <path d="M4.5 7L6.5 9L9.5 5" stroke="var(--success)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="var(--danger)" strokeWidth="1.2" />
            <path d="M5 5L9 9M9 5L5 9" stroke="var(--danger)" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={clsx("text-[11px] font-semibold", isCompleted ? "text-[color:var(--success)]" : "text-[color:var(--danger)]")}>
          {actionLabel}
        </p>
        <p className="mt-0.5 text-[10px] leading-[14px] text-[color:var(--text)]">{summary || "Done."}</p>
      </div>
    </div>
  );
}

/* ── Generic fallback renderer ── */

function GenericToolResult({ data }: Readonly<{ data: unknown }>) {
  if (!data) return null;

  // If it has a summary field, prefer that
  if (typeof data === "object" && data !== null && "summary" in data) {
    const summary = (data as Record<string, unknown>).summary;
    if (typeof summary === "string") {
      return <p className="text-[11px] leading-[16px] text-[color:var(--text)]">{summary}</p>;
    }
  }

  const json = JSON.stringify(data, null, 2);
  // Truncate very long JSON
  const truncated = json.length > 400 ? json.slice(0, 400) + "\n…" : json;
  return (
    <pre className="whitespace-pre-wrap break-words font-[var(--font-mono)] text-[10px] leading-[15px] text-[color:var(--muted)]">
      {truncated}
    </pre>
  );
}

/* ── Tool invocation card ── */

function ToolInvocationCard({
  part,
}: Readonly<{
  part: Record<string, unknown> & { type: string };
}>) {
  const [expanded, setExpanded] = useState(false);
  const state = typeof part.state === "string" ? part.state : "input-available";
  const isError = state === "output-error";
  const isLoading = state !== "output-available" && state !== "output-error";
  const toolName = getToolName(part);
  const output = part.output as Record<string, unknown> | undefined;

  function renderToolOutput() {
    if (isError) {
      return (
        <p className="text-[11px] text-[color:var(--danger)]">
          {String(part.errorText ?? "Tool execution failed.")}
        </p>
      );
    }

    if (!output) return null;

    switch (toolName) {
      case "get_workspace_snapshot":
        return <WorkspaceSnapshotResult data={output} />;
      case "get_pipeline_summary":
        return <PipelineSummaryResult data={output} />;
      case "list_active_insights":
        return <InsightsResult data={output} />;
      case "find_deals":
        return <DealSearchResult data={output} />;
      case "get_deal_context":
        return <DealContextResult data={output} />;
      case "get_recent_activity":
        return <ActivityResult data={output} />;
      case "log_hubspot_note":
      case "create_hubspot_task":
      case "log_hubspot_email":
        return <HubSpotActionResult data={output} />;
      default:
        return <GenericToolResult data={output} />;
    }
  }

  // HubSpot actions render inline without collapsible wrapper
  const isHubSpotAction = toolName === "log_hubspot_note" || toolName === "create_hubspot_task" || toolName === "log_hubspot_email";
  if (state === "output-available" && isHubSpotAction && output) {
    return <HubSpotActionResult data={output} />;
  }

  return (
    <div className={clsx(
      "rounded-lg border",
      isError
        ? "border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]"
        : "border-[color:var(--line)] bg-[rgba(255,255,255,0.015)]",
    )}>
      {/* Header — always visible, clickable to expand/collapse */}
      <button
        onClick={() => !isLoading && setExpanded((v) => !v)}
        className={clsx(
          "flex w-full items-center gap-2 px-2.5 py-2 text-left",
          !isLoading && "cursor-pointer",
        )}
        disabled={isLoading}
      >
        <span className={clsx(
          "h-[6px] w-[6px] shrink-0 rounded-full",
          state === "output-available" ? "bg-[color:var(--success)]" :
          isError ? "bg-[color:var(--danger)]" : "bg-[color:var(--warn)] animate-pulse",
        )} />
        <p className="flex-1 truncate text-[11px] font-medium text-[color:var(--muted)]">
          {formatToolName(part.type, typeof part.toolName === "string" ? part.toolName : undefined)}
        </p>
        {isLoading && <SpinnerIcon />}
        {!isLoading && <ChevronIcon open={expanded} />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[color:var(--line)] px-2.5 py-2">
          {renderToolOutput()}
        </div>
      )}
    </div>
  );
}

/* ── Message bubble ── */

function MessageBubble({ message }: Readonly<{ message: UIMessage }>) {
  const isUser = message.role === "user";

  // Skip rendering if the message has no visible content (e.g. only step-start parts)
  const hasVisibleContent = message.parts.some(
    (part) => (part.type === "text" && part.text.trim()) || part.type.startsWith("tool-") || part.type === "dynamic-tool",
  );
  if (!hasVisibleContent) return null;

  return (
    <div className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[85%] space-y-2 rounded-2xl px-3.5 py-2.5",
          isUser
            ? "bg-[color:var(--accent)] text-white"
            : "bg-[rgba(255,255,255,0.04)] text-[color:var(--text)]",
        )}
      >
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            return (
              <p
                key={`${message.id}-${index}`}
                className="whitespace-pre-wrap text-[13px] leading-[22px]"
              >
                {part.text}
              </p>
            );
          }

          // Skip step-start parts — they're metadata markers, not content.
          // A live typing indicator is shown separately based on stream status.
          if (part.type === "step-start") {
            return null;
          }

          if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
            return <ToolInvocationCard key={`${message.id}-${index}`} part={part as Record<string, unknown> & { type: string }} />;
          }

          return null;
        })}
      </div>
    </div>
  );
}

/* ── Conversation list (collapsible) ── */

function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
}: Readonly<{
  conversations: AgentConversationSummary[];
  activeConversationId: string | null;
  onSelect: (conversationId: string) => void;
}>) {
  const [expanded, setExpanded] = useState(false);

  if (conversations.length === 0) return null;

  return (
    <div className="border-b border-[color:var(--line)]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)]"
      >
        <span>Conversations ({conversations.length})</span>
        <ChevronIcon open={expanded} />
      </button>
      {expanded ? (
        <div className="max-h-48 overflow-y-auto px-2 pb-2">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => {
                onSelect(conversation.id);
                setExpanded(false);
              }}
              className={clsx(
                "w-full rounded-lg px-3 py-2 text-left transition-colors",
                conversation.id === activeConversationId
                  ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                  : "text-[color:var(--text)] hover:bg-[rgba(255,255,255,0.04)]",
              )}
            >
              <p className="truncate text-[13px] font-medium">{conversation.title}</p>
              <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                {formatTimestamp(conversation.last_message_at)}
              </p>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ── Chat thread ── */

function AgentConversationThread({
  conversationId,
  initialMessages,
  onRefresh,
}: Readonly<{
  conversationId: string;
  initialMessages: UIMessage[];
  onRefresh: () => Promise<void>;
}>) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/agent-api/chat",
        body: { conversation_id: conversationId },
      }),
    [conversationId],
  );

  const { messages, sendMessage, status, error } = useChat<UIMessage>({
    id: conversationId,
    messages: initialMessages,
    transport,
    onFinish: () => {
      void onRefresh();
    },
  });

  const disabled = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    void sendMessage({ text: input.trim() });
    setInput("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  return (
    <>
      {/* Messages area */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-[260px] space-y-2 text-center">
              <p className="text-[13px] font-medium text-[color:var(--text-strong)]">
                Ask Delta anything
              </p>
              <p className="text-[12px] leading-[18px] text-[color:var(--muted)]">
                Summarize your pipeline, spot deal risks, draft follow-ups, or save CRM actions.
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {disabled ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl bg-[rgba(255,255,255,0.04)] px-3.5 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[color:var(--muted)] [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[color:var(--muted)] [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[color:var(--muted)] [animation-delay:300ms]" />
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Status line */}
      {(error || disabled) ? (
        <div className="px-4">
          <p className={clsx(
            "text-[11px]",
            error ? "text-[color:var(--danger)]" : "text-[color:var(--muted)]",
          )}>
            {error ? error.message : "Delta is thinking..."}
          </p>
        </div>
      ) : null}

      {/* Input area */}
      <div className="border-t border-[color:var(--line)] px-3 py-3">
        <div className="flex items-end gap-2 rounded-xl border border-[color:var(--line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 transition-colors focus-within:border-[color:var(--accent)]">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask Delta..."
            disabled={disabled}
            rows={1}
            className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent text-[13px] leading-6 text-[color:var(--text-strong)] outline-none placeholder:text-[color:var(--muted)] disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={disabled || !input.trim()}
            className={clsx(
              "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-all",
              input.trim() && !disabled
                ? "bg-[color:var(--accent)] text-white hover:brightness-110"
                : "text-[color:var(--muted)] opacity-40",
            )}
          >
            {disabled ? <SpinnerIcon /> : <SendIcon />}
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Main sidebar component ── */

export function AgentSidebar() {
  const {
    open,
    toggleOpen,
    setOpen,
    loading,
    error,
    conversations,
    activeConversationId,
    setActiveConversationId,
    refreshConversations,
    createConversation,
  } = useAgentChat();

  const [detail, setDetail] = useState<AgentConversationDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeConversationId) {
      setDetail(null);
      return;
    }

    let active = true;
    setDetailLoading(true);
    setDetailError(null);

    void (async () => {
      try {
        const payload = await getAgentConversation(activeConversationId);
        if (active) setDetail(payload);
      } catch (nextError) {
        if (active) setDetailError(toErrorMessage(nextError));
      } finally {
        if (active) setDetailLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [activeConversationId]);

  // Keyboard shortcut to toggle
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ".") {
        event.preventDefault();
        toggleOpen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleOpen]);

  return (
    <>
      {/* Mobile overlay */}
      {open ? (
        <button
          aria-label="Close chat"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-[rgba(0,0,0,0.5)] backdrop-blur-[2px] md:hidden"
        />
      ) : null}

      {/* Sidebar panel */}
      <aside
        className={clsx(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[color:var(--line)] bg-[var(--bg)] transition-transform duration-250 ease-[cubic-bezier(0.25,0.1,0.25,1)] md:w-[380px]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img src="/delta-logo.png" alt="Delta" className="h-7" />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => void createConversation()}
              title="New conversation"
              className="grid h-8 w-8 place-items-center rounded-lg text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[color:var(--text)]"
            >
              <PlusIcon />
            </button>
            <button
              onClick={() => setOpen(false)}
              title="Close (⌘.)"
              className="grid h-8 w-8 place-items-center rounded-lg text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[color:var(--text)]"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Conversation list */}
        {loading ? (
          <div className="border-b border-[color:var(--line)] px-4 py-2.5">
            <p className="text-[11px] text-[color:var(--muted)]">Loading...</p>
          </div>
        ) : error ? (
          <div className="border-b border-[color:var(--line)] px-4 py-2.5">
            <p className="text-[11px] text-[color:var(--danger)]">{error}</p>
          </div>
        ) : (
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelect={setActiveConversationId}
          />
        )}

        {/* Chat thread */}
        <div className="flex min-h-0 flex-1 flex-col">
          {detailLoading ? (
            <div className="grid flex-1 place-items-center">
              <SpinnerIcon />
            </div>
          ) : detailError ? (
            <div className="grid flex-1 place-items-center px-4">
              <p className="text-[13px] text-[color:var(--danger)]">{detailError}</p>
            </div>
          ) : detail && activeConversationId ? (
            <AgentConversationThread
              key={activeConversationId}
              conversationId={activeConversationId}
              initialMessages={detail.messages as unknown as UIMessage[]}
              onRefresh={refreshConversations}
            />
          ) : null}
        </div>
      </aside>
    </>
  );
}

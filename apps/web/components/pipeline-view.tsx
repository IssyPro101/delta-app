import Link from "next/link";

import type { PipelineResponse } from "@pipeline-intelligence/shared";

import { formatDays, formatPercent } from "../lib/format";
import { EmptyState, Panel, SectionTitle } from "./ui";

function leakThreshold(stages: PipelineResponse["stages"]) {
  const average =
    stages.length === 0
      ? 0
      : stages.reduce((sum, stage) => sum + stage.conversion_rate, 0) / stages.length;

  return average - 0.2;
}

export function PipelineView({
  data,
}: Readonly<{
  data: PipelineResponse;
}>) {
  if (data.summary.total_deals === 0) {
    return (
      <EmptyState
        title="Not enough data to analyze your pipeline yet."
        description="Connect HubSpot in Settings and sync your deal history."
        action={
          <Link
            href="/settings"
            className="inline-flex rounded-xl bg-gradient-to-r from-[#0e58dd] to-[#1d74e7] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_8px_rgba(14,88,221,0.3)]"
          >
            Open Settings
          </Link>
        }
      />
    );
  }

  if (!data.minimum_closed_deals_met) {
    return (
      <EmptyState
        title="Need more closed deal data to show meaningful conversion rates."
        description={`Currently tracking ${data.closed_deals_count} closed deals. Analysis begins at 10.`}
      />
    );
  }

  const firstStageCount = data.stages[0]?.deals_entered ?? 1;
  const lowConversionThreshold = leakThreshold(data.stages);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total Deals", value: data.summary.total_deals },
          { label: "Won", value: data.summary.won },
          { label: "Lost", value: data.summary.lost },
          { label: "Win Rate", value: formatPercent(data.summary.overall_win_rate) },
          { label: "Avg Cycle", value: formatDays(data.summary.avg_deal_cycle_days) },
        ].map((card) => (
          <Panel key={card.label} className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--accent)] to-transparent opacity-40" />
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {card.label}
            </p>
            <p className="mt-4 font-[var(--font-display)] text-[32px] tracking-[-0.02em] text-[color:var(--text-strong)]">
              {card.value}
            </p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
        <Panel>
          <SectionTitle eyebrow="Leak Detection" title="Funnel" />
          <div className="mt-8 space-y-7">
            {data.stages.map((stage, index) => {
              const width = Math.max(20, Math.round((stage.deals_entered / firstStageCount) * 100));
              const leak = stage.conversion_rate < lowConversionThreshold;

              return (
                <div key={stage.name} className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-6 w-6 place-items-center rounded-md bg-[color:var(--panel-strong)] font-[var(--font-mono)] text-[11px] text-[color:var(--muted)]">
                        {index + 1}
                      </span>
                      <Link href={`/feed?stage=${encodeURIComponent(stage.name)}`} className="text-sm font-medium text-[color:var(--text-strong)] transition-colors hover:text-[color:var(--accent)]">
                        {stage.name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
                      <span className="font-[var(--font-mono)] text-xs">{stage.deals_entered}</span>
                      {leak ? (
                        <Link
                          href={`/insights?analyzer=stage_leak&stage=${encodeURIComponent(stage.name)}`}
                          className="rounded-md bg-[color:var(--warn-soft)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--warn)]"
                        >
                          Leak
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[color:var(--panel-strong)]">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          leak
                            ? "bg-gradient-to-r from-[#f0953e] to-[#d97706]"
                            : "bg-gradient-to-r from-[#0e58dd] to-[#1d74e7]"
                        }`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className="w-14 text-right font-[var(--font-mono)] text-xs font-medium text-[color:var(--text)]">{formatPercent(stage.conversion_rate)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <SectionTitle eyebrow="Velocity" title="Stage Health" />
          <div className="mt-6 overflow-hidden rounded-xl border border-[color:var(--line)]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--line)] text-left">
                  {["Stage", "Conv.", "Won avg", "Lost avg", "Gap"].map((label) => (
                    <th key={label} className="bg-[color:var(--panel-strong)] px-4 py-3 font-[var(--font-mono)] text-[10px] font-medium uppercase tracking-wider text-[color:var(--muted)]">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {data.stages.map((stage) => {
                  const gap = stage.avg_days_in_stage_lost - stage.avg_days_in_stage_won;
                  const flag = stage.avg_days_in_stage_won > 0 && gap > stage.avg_days_in_stage_won * 2;

                  return (
                    <tr key={stage.name} className="transition-colors hover:bg-[color:var(--panel)]">
                      <td className="px-4 py-3.5 font-medium text-[color:var(--text-strong)]">{stage.name}</td>
                      <td className="px-4 py-3.5 font-[var(--font-mono)] text-xs text-[color:var(--muted)]">{formatPercent(stage.conversion_rate)}</td>
                      <td className="px-4 py-3.5 font-[var(--font-mono)] text-xs text-[color:var(--muted)]">{formatDays(stage.avg_days_in_stage_won)}</td>
                      <td className="px-4 py-3.5 font-[var(--font-mono)] text-xs text-[color:var(--muted)]">{formatDays(stage.avg_days_in_stage_lost)}</td>
                      <td className={`px-4 py-3.5 font-[var(--font-mono)] text-xs ${flag ? "text-[color:var(--warn)]" : "text-[color:var(--muted)]"}`}>
                        <span className="inline-flex items-center gap-2">
                          <span>
                            {gap > 0 ? "+" : ""}
                            {formatDays(gap)}
                          </span>
                          {flag ? <span className="text-[10px] font-semibold uppercase">Leak</span> : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

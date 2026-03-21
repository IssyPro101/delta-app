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
            className="inline-flex rounded-full bg-[color:var(--text)] px-4 py-2 text-sm font-medium text-white"
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
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total Deals", value: data.summary.total_deals },
          { label: "Won", value: data.summary.won },
          { label: "Lost", value: data.summary.lost },
          { label: "Win Rate", value: formatPercent(data.summary.overall_win_rate) },
          { label: "Avg Cycle", value: formatDays(data.summary.avg_deal_cycle_days) },
        ].map((card) => (
          <Panel key={card.label} className="bg-white/80">
            <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
              {card.label}
            </p>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.05em]">{card.value}</p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
        <Panel>
          <SectionTitle eyebrow="Leak Detection" title="Funnel" />
          <div className="mt-6 space-y-6">
            {data.stages.map((stage, index) => {
              const width = Math.max(20, Math.round((stage.deals_entered / firstStageCount) * 100));
              const leak = stage.conversion_rate < lowConversionThreshold;

              return (
                <div key={stage.name} className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--accent-soft)] font-[var(--font-mono)] text-xs text-[color:var(--accent)]">
                        {index + 1}
                      </span>
                      <Link href={`/feed?stage=${encodeURIComponent(stage.name)}`} className="font-medium hover:underline">
                        {stage.name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
                      <span>{stage.deals_entered} deals</span>
                      {leak ? (
                        <Link
                          href={`/insights?analyzer=stage_leak&stage=${encodeURIComponent(stage.name)}`}
                          className="rounded-full bg-[color:var(--warn-soft)] px-3 py-1 text-[color:var(--warn)]"
                        >
                          Leak
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-4 flex-1 overflow-hidden rounded-full bg-[color:var(--bg-strong)]">
                      <div
                        className={`h-full rounded-full ${
                          leak ? "bg-[color:var(--warn)]" : "bg-[color:var(--accent)]"
                        }`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className="w-14 text-right text-sm font-medium">{formatPercent(stage.conversion_rate)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <SectionTitle eyebrow="Velocity" title="Stage Health" />
          <div className="mt-6 overflow-hidden rounded-[22px] border border-[color:var(--line)]">
            <table className="min-w-full divide-y divide-[color:var(--line)] text-sm">
              <thead className="bg-white/70">
                <tr className="text-left text-[color:var(--muted)]">
                  {["Stage", "Conv.", "Won avg", "Lost avg", "Gap"].map((label) => (
                    <th key={label} className="px-4 py-3 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)] bg-white/50">
                {data.stages.map((stage) => {
                  const gap = stage.avg_days_in_stage_lost - stage.avg_days_in_stage_won;
                  const flag = stage.avg_days_in_stage_won > 0 && gap > stage.avg_days_in_stage_won * 2;

                  return (
                    <tr key={stage.name}>
                      <td className="px-4 py-4 font-medium">{stage.name}</td>
                      <td className="px-4 py-4">{formatPercent(stage.conversion_rate)}</td>
                      <td className="px-4 py-4">{formatDays(stage.avg_days_in_stage_won)}</td>
                      <td className="px-4 py-4">{formatDays(stage.avg_days_in_stage_lost)}</td>
                      <td className={`px-4 py-4 ${flag ? "text-[color:var(--warn)]" : "text-[color:var(--muted)]"}`}>
                        <span className="inline-flex items-center gap-2">
                          <span>
                            {gap > 0 ? "+" : ""}
                            {formatDays(gap)}
                          </span>
                          {flag ? <span className="text-xs font-medium uppercase">Leak</span> : null}
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

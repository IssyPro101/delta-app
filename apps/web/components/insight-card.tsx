import Link from "next/link";

import type { Insight, Deal, InsightsResponse } from "@pipeline-intelligence/shared";

import { Panel } from "./ui";

const categoryStyles: Record<Insight["category"], string> = {
  leak: "bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  risk: "bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  pattern: "bg-[color:var(--warn-soft)] text-[color:var(--warn)]",
};

function evidenceLine(insight: Insight) {
  const data = insight.data;

  switch (insight.analyzer) {
    case "stage_leak":
      return `${Math.round(Number(data.conversion_rate ?? 0) * 100)}% conversion vs ${Math.round(
        Number(data.pipeline_avg_conversion ?? 0) * 100,
      )}% pipeline average`;
    case "velocity_comparison":
      return `Lost deals spend ${data.difference_factor}x longer in ${String(data.stage ?? "this stage")}`;
    case "activity_pattern":
      return `Based on ${data.won_deals_count} won and ${data.lost_deals_count} lost deals`;
    case "deal_risk":
      return `${Math.round(Number(data.similarity_to_lost ?? 0) * 100)}% similarity to lost deal pattern`;
    default:
      return null;
  }
}

export function InsightCard({
  insight,
  dealLookup,
}: Readonly<{
  insight: Insight;
  dealLookup: Map<string, Deal>;
}>) {
  const deals = insight.affected_deals
    .map((dealId) => dealLookup.get(dealId))
    .filter((deal): deal is Deal => Boolean(deal));
  const evidence = evidenceLine(insight);

  return (
    <Panel className="bg-white/82">
      <div className="space-y-4">
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase ${categoryStyles[insight.category]}`}>
          {insight.category}
        </span>
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold tracking-[-0.05em]">{insight.title}</h3>
          <p className="max-w-3xl text-sm leading-7 text-[color:var(--muted)]">{insight.description}</p>
        </div>
        {evidence ? <p className="text-sm font-medium text-[color:var(--text)]">{evidence}</p> : null}
        {deals.length > 0 ? (
          <p className="text-sm text-[color:var(--muted)]">
            Affected deals:{" "}
            {deals.slice(0, 2).map((deal, index) => (
              <span key={deal.id}>
                {index > 0 ? ", " : null}
                <Link href={`/feed?deal_id=${deal.id}`} className="font-medium text-[color:var(--text)] hover:underline">
                  {deal.company_name}
                </Link>
              </span>
            ))}
            {deals.length > 2 ? `, + ${deals.length - 2} more` : null}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

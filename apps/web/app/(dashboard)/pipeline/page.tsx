"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { pipelinePeriods, type PipelinePeriod } from "@pipeline-intelligence/shared";

import { useDashboardData } from "../../../components/dashboard-data-provider";
import { QuerySelect } from "../../../components/query-select";
import { PipelineView } from "../../../components/pipeline-view";
import { Panel } from "../../../components/ui";
import { buildPipelineData } from "../../../lib/dashboard-data";

const periodOptions = [
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
  { value: "last_180_days", label: "Last 180 days" },
  { value: "all_time", label: "All time" },
];

export default function PipelinePage() {
  return (
    <Suspense>
      <PipelinePageContent />
    </Suspense>
  );
}

function PipelinePageContent() {
  const searchParams = useSearchParams();
  const pipelineName = searchParams.get("pipeline_name") ?? undefined;
  const requestedPeriod = searchParams.get("period");
  const period =
    requestedPeriod && pipelinePeriods.includes(requestedPeriod as PipelinePeriod)
      ? (requestedPeriod as PipelinePeriod)
      : "last_90_days";
  const { data, error, loading } = useDashboardData();
  const pipelineData = useMemo(() => {
    if (!data) {
      return null;
    }

    return buildPipelineData(data, pipelineName ? { pipelineName, period } : { period });
  }, [data, period, pipelineName]);

  if (!data && loading) {
    return (
      <Panel>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--line-strong)] border-t-[color:var(--accent)]" />
          <p className="text-sm text-[color:var(--muted)]">Loading pipeline data...</p>
        </div>
      </Panel>
    );
  }

  if (!data || !pipelineData) {
    return (
      <Panel className="border-[rgba(229,72,77,0.12)] bg-[color:var(--danger-soft)]">
        <p className="text-sm text-[color:var(--danger)]">{error ?? "Could not load pipeline data."}</p>
      </Panel>
    );
  }

  const selectedPipeline = pipelineName ?? "all";
  const pipelineOptions = [{ value: "all", label: "All pipelines" }].concat(
    pipelineData.pipelines.map((pipeline) => ({ value: pipeline, label: pipeline })),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <QuerySelect label="Pipeline" name="pipeline_name" value={selectedPipeline} options={pipelineOptions} />
        <QuerySelect label="Period" name="period" value={period} options={periodOptions} />
      </div>
      <PipelineView data={pipelineData} />
    </div>
  );
}

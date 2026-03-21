"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { PipelineResponse } from "@pipeline-intelligence/shared";

import { QuerySelect } from "../../../components/query-select";
import { PipelineView } from "../../../components/pipeline-view";
import { Panel } from "../../../components/ui";
import { apiFetch, toErrorMessage } from "../../../lib/api";

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
  const period = searchParams.get("period") ?? "last_90_days";
  const [data, setData] = useState<PipelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = new URLSearchParams();

  if (pipelineName) query.set("pipeline_name", pipelineName);
  if (period) query.set("period", period);
  const queryString = query.toString();

  useEffect(() => {
    let active = true;

    setData(null);
    setError(null);

    void (async () => {
      try {
        const nextData = await apiFetch<PipelineResponse>(`/api/pipeline?${queryString}`);

        if (active) {
          setData(nextData);
        }
      } catch (error) {
        if (active) {
          setError(toErrorMessage(error));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [queryString]);

  if (!data && !error) {
    return (
      <Panel>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--line-strong)] border-t-[color:var(--accent)]" />
          <p className="text-sm text-[color:var(--muted)]">Loading pipeline data...</p>
        </div>
      </Panel>
    );
  }

  if (!data) {
    return (
      <Panel className="border-[rgba(229,72,77,0.12)] bg-[color:var(--danger-soft)]">
        <p className="text-sm text-[color:var(--danger)]">{error ?? "Could not load pipeline data."}</p>
      </Panel>
    );
  }

  const selectedPipeline = pipelineName ?? "all";
  const pipelineOptions = [{ value: "all", label: "All pipelines" }].concat(
    data.pipelines.map((pipeline) => ({ value: pipeline, label: pipeline })),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <QuerySelect label="Pipeline" name="pipeline_name" value={selectedPipeline} options={pipelineOptions} />
        <QuerySelect label="Period" name="period" value={period} options={periodOptions} />
      </div>
      <PipelineView data={data} />
    </div>
  );
}

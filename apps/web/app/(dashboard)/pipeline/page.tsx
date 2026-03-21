import type { PipelineResponse } from "@pipeline-intelligence/shared";

import { QuerySelect } from "../../../components/query-select";
import { PipelineView } from "../../../components/pipeline-view";
import { apiFetch } from "../../../lib/api";

const periodOptions = [
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
  { value: "last_180_days", label: "Last 180 days" },
  { value: "all_time", label: "All time" },
];

export default async function PipelinePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ pipeline_name?: string; period?: string }>;
}>) {
  const params = await searchParams;
  const period = params.period ?? "last_90_days";
  const query = new URLSearchParams();

  if (params.pipeline_name) query.set("pipeline_name", params.pipeline_name);
  if (period) query.set("period", period);

  const data = await apiFetch<PipelineResponse>(`/api/pipeline?${query.toString()}`);
  const selectedPipeline = params.pipeline_name ?? "all";
  const pipelineOptions = [{ value: "all", label: "All pipelines" }].concat(
    data.pipelines.map((pipeline) => ({ value: pipeline, label: pipeline })),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <QuerySelect label="Pipeline" name="pipeline_name" value={selectedPipeline} options={pipelineOptions} />
        <QuerySelect label="Period" name="period" value={period} options={periodOptions} />
      </div>
      <PipelineView data={data} />
    </div>
  );
}

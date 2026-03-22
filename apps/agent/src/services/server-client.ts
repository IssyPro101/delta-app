import type {
  Deal,
  InsightsResponse,
  PipelinePeriod,
  PipelineResponse,
} from "@pipeline-intelligence/shared";

import { env } from "../utils/env";

type AgentWorkspaceSummary = {
  overview: {
    total_deals: number;
    open_deals: number;
    won_deals: number;
    lost_deals: number;
    total_open_amount: number;
    active_insights: number;
    pipeline_names: string[];
    stage_distribution: Array<{ stage: string; count: number }>;
  };
  highlighted_deals: Deal[];
  active_insights: InsightsResponse["insights"];
  recent_activity: Array<Record<string, unknown>>;
};

type AgentDealContext = {
  deal: Deal & {
    stage_transitions: Array<Record<string, unknown>>;
  };
  related_insights: InsightsResponse["insights"];
  recent_activity: Array<Record<string, unknown>>;
};

type DealSearchResponse = {
  deals: Deal[];
  total: number;
};

type ActivityResponse = {
  events: Array<Record<string, unknown>>;
  total: number;
};

function buildUrl(path: string, searchParams?: Record<string, string | number | undefined>) {
  const url = new URL(path, env.serverBaseUrl);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined) {
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

async function serverFetch<T>(
  accessToken: string,
  path: string,
  searchParams?: Record<string, string | number | undefined>,
): Promise<T> {
  const response = await fetch(buildUrl(path, searchParams), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Server request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getWorkspaceSummary(accessToken: string) {
  return serverFetch<AgentWorkspaceSummary>(accessToken, "/api/agent-context/summary");
}

export function getPipelineSummary(
  accessToken: string,
  params: {
    pipeline_name?: string;
    period?: PipelinePeriod;
  },
) {
  return serverFetch<PipelineResponse>(accessToken, "/api/pipeline", params);
}

export function listActiveInsights(
  accessToken: string,
  params: {
    category?: string;
    stage?: string;
    limit?: number;
  },
) {
  return serverFetch<InsightsResponse>(accessToken, "/api/insights", {
    ...(params.category ? { category: params.category } : {}),
    ...(params.stage ? { stage: params.stage } : {}),
    is_active: "true",
    limit: params.limit ?? 10,
  });
}

export function findDeals(
  accessToken: string,
  params: {
    query?: string;
    stage?: string;
    outcome?: "open" | "won" | "lost";
    limit?: number;
  },
) {
  return serverFetch<DealSearchResponse>(accessToken, "/api/agent-context/deals", params);
}

export function getDealContext(accessToken: string, dealId: string) {
  return serverFetch<AgentDealContext>(accessToken, `/api/agent-context/deals/${dealId}`);
}

export function getRecentActivity(
  accessToken: string,
  params: {
    deal_id?: string;
    stage?: string;
    limit?: number;
  },
) {
  return serverFetch<ActivityResponse>(accessToken, "/api/agent-context/recent-activity", params);
}

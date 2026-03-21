import type { PipelinePeriod } from "./enums";

export const PIPELINE_MINIMUM_CLOSED_DEALS = 10;
export const LEAK_DELTA_THRESHOLD = 0.2;
export const VELOCITY_GAP_FACTOR = 2;
export const ACTIVITY_PATTERN_FACTOR = 1.5;
export const DEAL_RISK_SIMILARITY_THRESHOLD = 0.7;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_EVENTS_PAGE_SIZE = 200;
export const SYNC_POLL_INTERVAL_MS = 3000;

export const periodToDays: Record<Exclude<PipelinePeriod, "all_time">, number> = {
  last_30_days: 30,
  last_90_days: 90,
  last_180_days: 180,
};

export const sidebarNavigation = [
  { href: "/pipeline", label: "Pipeline" },
  { href: "/insights", label: "Insights" },
  { href: "/feed", label: "Feed" },
  { href: "/settings", label: "Settings" },
] as const;

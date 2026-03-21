export const integrationProviders = ["hubspot", "fathom"] as const;
export type IntegrationProvider = (typeof integrationProviders)[number];

export const integrationStatuses = ["connected", "disconnected", "error"] as const;
export type IntegrationStatus = (typeof integrationStatuses)[number];

export const dealOutcomes = ["open", "won", "lost"] as const;
export type DealOutcome = (typeof dealOutcomes)[number];

export const eventSources = ["fathom", "hubspot"] as const;
export type EventSource = (typeof eventSources)[number];

export const eventTypes = [
  "meeting",
  "deal_stage_change",
  "deal_amount_change",
  "contact_activity",
  "deal_created",
  "deal_closed",
] as const;
export type EventType = (typeof eventTypes)[number];

export const insightCategories = ["leak", "pattern", "risk"] as const;
export type InsightCategory = (typeof insightCategories)[number];

export const insightSeverities = ["high", "medium", "low"] as const;
export type InsightSeverity = (typeof insightSeverities)[number];

export const pipelinePeriods = [
  "last_30_days",
  "last_90_days",
  "last_180_days",
  "all_time",
] as const;
export type PipelinePeriod = (typeof pipelinePeriods)[number];

export const syncStatuses = ["idle", "running", "error"] as const;
export type SyncStatus = (typeof syncStatuses)[number];

export const eventTypeLabels: Record<EventType, string> = {
  meeting: "Fathom Meeting",
  deal_stage_change: "Deal Stage Change",
  deal_amount_change: "Deal Amount Change",
  contact_activity: "Contact Activity",
  deal_created: "New Deal",
  deal_closed: "Deal Closed",
};

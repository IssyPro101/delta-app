import type {
  DealOutcome,
  EventSource,
  EventType,
  InsightCategory,
  InsightSeverity,
  IntegrationProvider,
  IntegrationStatus,
  PipelinePeriod,
  SyncStatus,
} from "./enums";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Integration {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  last_synced_at: string | null;
  created_at: string;
}

export interface Deal {
  id: string;
  user_id: string;
  external_id: string;
  name: string;
  stage: string;
  outcome: DealOutcome;
  amount: number | null;
  close_date: string | null;
  closed_at: string | null;
  company_name: string;
  owner_name: string | null;
  pipeline_name: string;
  last_activity: string;
  created_at: string;
}

export interface StageTransition {
  id: string;
  user_id: string;
  deal_id: string;
  from_stage: string | null;
  to_stage: string;
  transitioned_at: string;
  time_in_stage_hours: number | null;
  created_at: string;
}

export interface MeetingMetadata {
  duration_minutes: number;
  participants: string[];
  recording_url: string | null;
  transcript_url: string | null;
  fathom_summary: string;
  key_topics: string[];
}

export interface DealStageChangeMetadata {
  previous_stage: string | null;
  new_stage: string;
  changed_by: string | null;
}

export interface DealAmountChangeMetadata {
  previous_amount: number | null;
  new_amount: number | null;
}

export interface ContactActivityMetadata {
  activity_type: string;
  contact_email: string | null;
  contact_name: string | null;
}

export interface DealCreatedMetadata {
  stage: string;
  amount: number | null;
  pipeline: string;
}

export interface DealClosedMetadata {
  outcome: Extract<DealOutcome, "won" | "lost">;
  final_stage: string;
  total_days_in_pipeline: number;
}

export type EventMetadata =
  | MeetingMetadata
  | DealStageChangeMetadata
  | DealAmountChangeMetadata
  | ContactActivityMetadata
  | DealCreatedMetadata
  | DealClosedMetadata
  | Record<string, unknown>;

export interface Event {
  id: string;
  user_id: string;
  deal_id: string | null;
  source: EventSource;
  event_type: EventType;
  title: string;
  summary: string;
  occurred_at: string;
  raw_payload: Record<string, unknown>;
  metadata: EventMetadata;
  created_at: string;
  deal?: Deal | null;
}

export interface Insight {
  id: string;
  user_id: string;
  analyzer: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  data: Record<string, unknown>;
  affected_deals: string[];
  pipeline_name: string | null;
  is_active: boolean;
  generated_at: string;
  created_at: string;
}

export interface PipelineStageMetric {
  name: string;
  deals_entered: number;
  deals_progressed: number;
  deals_lost: number;
  conversion_rate: number;
  avg_days_in_stage: number;
  avg_days_in_stage_won: number;
  avg_days_in_stage_lost: number;
}

export interface PipelineSummary {
  total_deals: number;
  won: number;
  lost: number;
  open: number;
  overall_win_rate: number;
  avg_deal_cycle_days: number;
}

export interface PipelineResponse {
  stages: PipelineStageMetric[];
  summary: PipelineSummary;
  pipelines: string[];
  minimum_closed_deals_met: boolean;
  closed_deals_count: number;
}

export interface InsightsResponse {
  insights: Insight[];
  total: number;
}

export interface EventsResponse {
  events: Event[];
  total: number;
}

export interface DealDetail extends Deal {
  stage_transitions: StageTransition[];
}

export interface DealsResponse {
  deals: Deal[];
  total: number;
}

export interface DashboardDataResponse {
  integrations: Integration[];
  deals: Deal[];
  stageTransitions: StageTransition[];
  events: Event[];
  insights: Insight[];
}

export interface SyncStatusResponse {
  status: SyncStatus;
  last_synced_at: string | null;
}

export interface AuthSession {
  user: AppUser;
}

export interface PaginationQuery {
  limit?: number;
  offset?: number;
}

export interface PipelineQuery {
  pipeline_name?: string;
  period?: PipelinePeriod;
}

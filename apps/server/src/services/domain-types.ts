import type {
  DealOutcome,
  EventSource,
  EventType,
  InsightCategory,
  InsightSeverity,
  IntegrationProvider,
  IntegrationStatus,
} from "@pipeline-intelligence/shared";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: Date;
}

export interface IntegrationRecord {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  access_token: string;
  refresh_token: string | null;
  last_synced_at: Date | null;
  created_at: Date;
}

export interface DealRecord {
  id: string;
  user_id: string;
  external_id: string;
  name: string;
  stage: string;
  outcome: DealOutcome;
  amount: number | null;
  close_date: Date | null;
  closed_at: Date | null;
  company_name: string;
  owner_name: string | null;
  pipeline_name: string;
  last_activity: Date;
  created_at: Date;
}

export interface StageTransitionRecord {
  id: string;
  user_id: string;
  deal_id: string;
  from_stage: string | null;
  to_stage: string;
  transitioned_at: Date;
  time_in_stage_hours: number | null;
  created_at: Date;
}

export interface EventRecord {
  id: string;
  user_id: string;
  deal_id: string | null;
  source: EventSource;
  event_type: EventType;
  title: string;
  summary: string;
  occurred_at: Date;
  raw_payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: Date;
  deal?: DealRecord | null;
}

export interface InsightRecord {
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
  generated_at: Date;
  created_at: Date;
}

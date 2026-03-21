import type {
  AppUser,
  Deal,
  DealDetail,
  Event,
  Insight,
  Integration,
  StageTransition,
} from "@pipeline-intelligence/shared";

import type {
  DealRecord,
  EventRecord,
  InsightRecord,
  IntegrationRecord,
  StageTransitionRecord,
  UserRecord,
} from "./domain-types";

export function serializeUser(user: UserRecord): AppUser {
  return {
    ...user,
    created_at: user.created_at.toISOString(),
  };
}

export function serializeIntegration(integration: Omit<IntegrationRecord, "access_token" | "refresh_token">): Integration {
  return {
    ...integration,
    last_synced_at: integration.last_synced_at?.toISOString() ?? null,
    created_at: integration.created_at.toISOString(),
  };
}

export function serializeDeal(deal: DealRecord): Deal {
  return {
    ...deal,
    close_date: deal.close_date?.toISOString().slice(0, 10) ?? null,
    closed_at: deal.closed_at?.toISOString() ?? null,
    last_activity: deal.last_activity.toISOString(),
    created_at: deal.created_at.toISOString(),
  };
}

export function serializeStageTransition(transition: StageTransitionRecord): StageTransition {
  return {
    ...transition,
    transitioned_at: transition.transitioned_at.toISOString(),
    created_at: transition.created_at.toISOString(),
  };
}

export function serializeEvent(event: EventRecord): Event {
  return {
    ...event,
    occurred_at: event.occurred_at.toISOString(),
    created_at: event.created_at.toISOString(),
    deal: event.deal ? serializeDeal(event.deal) : null,
  };
}

export function serializeInsight(insight: InsightRecord): Insight {
  return {
    ...insight,
    generated_at: insight.generated_at.toISOString(),
    created_at: insight.created_at.toISOString(),
  };
}

export function serializeDealDetail(deal: DealRecord, stageTransitions: StageTransitionRecord[]): DealDetail {
  return {
    ...serializeDeal(deal),
    stage_transitions: stageTransitions.map(serializeStageTransition),
  };
}

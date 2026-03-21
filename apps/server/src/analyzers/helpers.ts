import type { DealRecord, EventRecord, StageTransitionRecord } from "../services/domain-types";

export interface AnalyzerContext {
  userId: string;
  pipelineName: string;
  deals: DealRecord[];
  stageTransitions: StageTransitionRecord[];
  events: EventRecord[];
  generatedAt: Date;
  periodLabel: string;
}

export interface StageEntry {
  deal: DealRecord;
  stage: string;
  enteredAt: Date;
  exitedAt: Date | null;
  nextStage: string | null;
}

export function byDealId<T extends { deal_id: string | null }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    if (!item.deal_id) {
      continue;
    }

    const current = groups.get(item.deal_id) ?? [];
    current.push(item);
    groups.set(item.deal_id, current);
  }

  return groups;
}

export function buildStageEntries(
  deals: DealRecord[],
  transitions: StageTransitionRecord[],
  now = new Date(),
): StageEntry[] {
  const transitionsByDeal = new Map<string, StageTransitionRecord[]>();

  for (const transition of transitions) {
    const current = transitionsByDeal.get(transition.deal_id) ?? [];
    current.push(transition);
    transitionsByDeal.set(transition.deal_id, current);
  }

  const entries: StageEntry[] = [];

  for (const deal of deals) {
    const ordered = (transitionsByDeal.get(deal.id) ?? []).sort(
      (left, right) => left.transitioned_at.getTime() - right.transitioned_at.getTime(),
    );

    if (ordered.length === 0) {
      entries.push({
        deal,
        stage: deal.stage,
        enteredAt: deal.created_at,
        exitedAt: deal.outcome === "open" ? null : deal.closed_at ?? now,
        nextStage: null,
      });
      continue;
    }

    for (let index = 0; index < ordered.length; index += 1) {
      const transition = ordered[index];
      const next = ordered[index + 1];

      if (!transition) {
        continue;
      }

      entries.push({
        deal,
        stage: transition.to_stage,
        enteredAt: transition.transitioned_at,
        exitedAt: next?.transitioned_at ?? (deal.outcome === "open" ? null : deal.closed_at ?? now),
        nextStage: next?.to_stage ?? null,
      });
    }
  }

  return entries;
}

export function getStageOrder(deals: DealRecord[], transitions: StageTransitionRecord[]): string[] {
  const ordered = new Map<string, number>();
  let counter = 0;

  for (const transition of transitions.sort(
    (left, right) => left.transitioned_at.getTime() - right.transitioned_at.getTime(),
  )) {
    if (transition.from_stage && !ordered.has(transition.from_stage)) {
      ordered.set(transition.from_stage, counter);
      counter += 1;
    }

    if (!ordered.has(transition.to_stage)) {
      ordered.set(transition.to_stage, counter);
      counter += 1;
    }
  }

  for (const deal of deals) {
    if (!ordered.has(deal.stage)) {
      ordered.set(deal.stage, counter);
      counter += 1;
    }
  }

  return [...ordered.entries()]
    .sort((left, right) => left[1] - right[1])
    .map(([stage]) => stage);
}

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function countEventType(events: EventRecord[], eventType: EventRecord["event_type"]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const event of events) {
    if (!event.deal_id || event.event_type !== eventType) {
      continue;
    }

    counts.set(event.deal_id, (counts.get(event.deal_id) ?? 0) + 1);
  }

  return counts;
}

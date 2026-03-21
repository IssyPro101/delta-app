import { periodToDays, type PipelinePeriod } from "@pipeline-intelligence/shared";

export function getPeriodStart(period: PipelinePeriod): Date | null {
  if (period === "all_time") {
    return null;
  }

  const days = periodToDays[period];
  const value = new Date();
  value.setUTCDate(value.getUTCDate() - days);
  return value;
}

export function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

export function daysBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}

export function formatOAuthState(provider: string, state: string): string {
  return `${provider}:${state}`;
}

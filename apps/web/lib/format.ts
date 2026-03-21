export function formatCurrency(cents: number | null) {
  if (cents === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatDays(value: number) {
  if (!Number.isFinite(value) || value === 0) {
    return "—";
  }

  return `${value.toFixed(1).replace(".0", "")}d`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const diffHours = diffMs / 3_600_000;

  if (Math.abs(diffHours) < 24) {
    const formatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
    if (Math.abs(diffHours) < 1) {
      return formatter.format(Math.round(diffMs / 60_000), "minute");
    }

    return formatter.format(Math.round(diffHours), "hour");
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

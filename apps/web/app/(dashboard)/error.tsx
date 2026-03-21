"use client";

import { PrimaryButton, Panel } from "../../components/ui";

export default function DashboardError({
  error,
  reset,
}: Readonly<{
  error: Error;
  reset: () => void;
}>) {
  return (
    <Panel className="text-center">
      <div className="mx-auto max-w-xl space-y-3 py-8">
        <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)]">
          Load Failure
        </p>
        <h2 className="text-2xl font-semibold tracking-[-0.04em]">Couldn&apos;t load this view.</h2>
        <p className="text-sm text-[color:var(--muted)]">{error.message || "Try refreshing."}</p>
        <PrimaryButton onClick={reset}>Try Again</PrimaryButton>
      </div>
    </Panel>
  );
}

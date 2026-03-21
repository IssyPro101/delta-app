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
      <div className="mx-auto max-w-md space-y-4 py-10">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[rgba(229,72,77,0.12)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="10" cy="10" r="8" />
            <path d="M12.5 7.5l-5 5M7.5 7.5l5 5" />
          </svg>
        </div>
        <h2 className="font-[var(--font-display)] text-2xl text-[color:var(--text-strong)]">Couldn&apos;t load this view.</h2>
        <p className="text-sm text-[color:var(--muted)]">{error.message || "Try refreshing."}</p>
        <PrimaryButton onClick={reset}>Try Again</PrimaryButton>
      </div>
    </Panel>
  );
}

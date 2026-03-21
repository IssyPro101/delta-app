import Link from "next/link";

import { Panel } from "../../../components/ui";

export default async function SignInPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ error?: string }>;
}>) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Panel className="w-full max-w-xl bg-[color:var(--panel-strong)] p-10">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
              Delta Pipeline Intelligence
            </p>
            <h1 className="text-4xl font-semibold tracking-[-0.08em]">See where deals leak before the quarter does.</h1>
            <p className="text-sm leading-7 text-[color:var(--muted)]">
              Sign in with Google to connect HubSpot and Fathom, backfill historical activity, and generate pipeline findings.
            </p>
          </div>
          {params.error ? (
            <div className="rounded-2xl border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
              Sign-in failed: {params.error}
            </div>
          ) : null}
          <Link
            href="/auth/google/start"
            className="inline-flex rounded-full bg-[color:var(--text)] px-5 py-3 text-sm font-medium text-white"
          >
            Continue With Google
          </Link>
        </div>
      </Panel>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "../../../components/auth-provider";
import { Panel, PrimaryButton } from "../../../components/ui";

function normalizeNext(next: string | null) {
  return next && next.startsWith("/") ? next : "/pipeline";
}

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading, signInPending, signInWithGoogle } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const next = normalizeNext(searchParams.get("next"));
  const serverError = searchParams.get("error");

  useEffect(() => {
    if (!loading && session) {
      router.replace(next);
    }
  }, [loading, next, router, session]);

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
          {serverError || authError ? (
            <div className="rounded-2xl border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
              Sign-in failed: {serverError ?? authError}
            </div>
          ) : null}
          <PrimaryButton
            disabled={loading || signInPending}
            className="px-5 py-3"
            onClick={() => {
              setAuthError(null);

              void signInWithGoogle(next).catch((error) => {
                setAuthError(error instanceof Error ? error.message : "Could not start Google sign-in.");
              });
            }}
          >
            {loading ? "Checking session..." : signInPending ? "Redirecting..." : "Continue With Google"}
          </PrimaryButton>
        </div>
      </Panel>
    </main>
  );
}

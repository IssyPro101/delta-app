"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "../../../components/auth-provider";
import { PrimaryButton } from "../../../components/ui";

function normalizeNext(next: string | null) {
  return next && next.startsWith("/") ? next : "/pipeline";
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInPageContent />
    </Suspense>
  );
}

function SignInPageContent() {
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
    <main className="relative grid min-h-screen place-items-center p-6">
      <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[300px] w-[400px] rounded-full bg-[color:var(--accent)] opacity-[0.04] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-lg space-y-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#0e58dd] to-[#1d74e7] font-[var(--font-display)] text-xl text-white shadow-[0_2px_20px_rgba(14,88,221,0.3)]">
          Δ
        </div>

        <div className="space-y-4">
          <h1 className="font-[var(--font-display)] text-4xl tracking-[-0.01em] text-[color:var(--text-strong)] md:text-[44px] md:leading-[1.15]">
            Spot pipeline leaks and close more deals.
          </h1>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-[color:var(--muted)]">
            Sign in with Google to connect HubSpot and Fathom, backfill historical activity, and generate pipeline findings.
          </p>
        </div>

        {serverError || authError ? (
          <div className="rounded-xl border border-[rgba(229,72,77,0.12)] bg-[color:var(--danger-soft)] px-5 py-3 text-sm text-[color:var(--danger)]">
            Sign-in failed: {serverError ?? authError}
          </div>
        ) : null}

        <div>
          <PrimaryButton
            disabled={loading || signInPending}
            className="px-8 py-3.5"
            onClick={() => {
              setAuthError(null);

              void signInWithGoogle(next).catch((error) => {
                setAuthError(error instanceof Error ? error.message : "Could not start Google sign-in.");
              });
            }}
          >
            {loading ? "Checking session..." : signInPending ? "Redirecting..." : "Continue with Google"}
          </PrimaryButton>
        </div>

        <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Delta Pipeline Intelligence
        </p>
      </div>
    </main>
  );
}

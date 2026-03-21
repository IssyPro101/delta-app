"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { IntegrationProvider } from "@pipeline-intelligence/shared";

import { useAuth } from "./auth-provider";
import { apiFetch } from "../lib/api";
import { Panel } from "./ui";

export function OAuthCallbackClient({ provider }: Readonly<{ provider: IntegrationProvider }>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (loading || startedRef.current) {
      return;
    }

    if (!session) {
      setError("Sign in required.");
      return;
    }

    const code = searchParams.get("code");
    const providerError = searchParams.get("error");

    if (providerError) {
      setError(providerError);
      return;
    }

    if (!code) {
      setError("Missing authorization code.");
      return;
    }

    startedRef.current = true;

    void (async () => {
      try {
        await apiFetch(`/api/integrations/${provider}/connect`, {
          method: "POST",
          body: JSON.stringify({ auth_code: code }),
        });

        router.replace("/settings");
        router.refresh();
      } catch {
        setError("Could not complete the connection.");
      }
    })();
  }, [loading, provider, router, searchParams, session]);

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Panel className="w-full max-w-lg text-center">
        <div className="space-y-4 py-8">
          <p className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)]">
            OAuth Callback
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.06em]">
            {error ? "Connection failed" : `Connecting ${provider === "hubspot" ? "HubSpot" : "Fathom"}`}
          </h1>
          <p className="text-sm leading-7 text-[color:var(--muted)]">
            {error ?? "Finishing token exchange and starting the initial backfill."}
          </p>
        </div>
      </Panel>
    </main>
  );
}

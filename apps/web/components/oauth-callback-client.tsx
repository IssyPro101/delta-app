"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { IntegrationProvider } from "@pipeline-intelligence/shared";

import { Panel } from "./ui";

export function OAuthCallbackClient({ provider }: Readonly<{ provider: IntegrationProvider }>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

    void (async () => {
      const response = await fetch(`/api/integrations/${provider}/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ auth_code: code }),
      });

      if (!response.ok) {
        setError("Could not complete the connection.");
        return;
      }

      router.replace("/settings");
      router.refresh();
    })();
  }, [provider, router, searchParams]);

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

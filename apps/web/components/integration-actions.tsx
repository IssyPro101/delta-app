"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { Integration, IntegrationProvider, SyncStatusResponse } from "@pipeline-intelligence/shared";

import { PrimaryButton, SecondaryButton } from "./ui";

export function IntegrationActions({
  provider,
  integration,
}: Readonly<{
  provider: IntegrationProvider;
  integration?: Integration | undefined;
}>) {
  const router = useRouter();
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse["status"]>("idle");
  const [busy, setBusy] = useState(false);

  const isConnected = integration?.status === "connected";
  const buttonLabel = useMemo(() => {
    if (!isConnected && integration?.status === "error" && !busy) return "Reconnect";
    if (busy && !isConnected) return "Redirecting...";
    if (busy && syncStatus === "running") return "Syncing...";
    return isConnected ? "Sync Now" : "Connect";
  }, [busy, integration?.status, isConnected, syncStatus]);

  async function connect() {
    setBusy(true);
    const response = await fetch(`/api/integrations/${provider}/authorize-url`, { cache: "no-store" });
    const payload = (await response.json()) as { url: string };
    window.location.href = payload.url;
  }

  async function sync() {
    setBusy(true);
    setSyncStatus("running");
    await fetch(`/api/integrations/${provider}/sync`, { method: "POST" });

    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/integrations/${provider}/sync-status`, { cache: "no-store" });
      const payload = (await response.json()) as SyncStatusResponse;
      setSyncStatus(payload.status);

      if (payload.status === "idle" || payload.status === "error") {
        window.clearInterval(interval);
        setBusy(false);
        router.refresh();
      }
    }, 3000);
  }

  async function disconnect() {
    if (!window.confirm(`Disconnect ${provider === "hubspot" ? "HubSpot" : "Fathom"}? Existing data will be kept but no new data will sync.`)) {
      return;
    }

    setBusy(true);
    await fetch(`/api/integrations/${provider}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  if (!isConnected) {
    return <PrimaryButton onClick={connect} disabled={busy}>{buttonLabel}</PrimaryButton>;
  }

  return (
    <div className="flex flex-wrap gap-3">
      <PrimaryButton onClick={sync} disabled={busy}>
        {buttonLabel}
      </PrimaryButton>
      <SecondaryButton onClick={disconnect} disabled={busy}>
        Disconnect
      </SecondaryButton>
    </div>
  );
}

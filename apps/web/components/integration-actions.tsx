"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { Integration, IntegrationProvider, SyncStatusResponse } from "@pipeline-intelligence/shared";

import { apiFetch } from "../lib/api";
import { PrimaryButton, SecondaryButton } from "./ui";

export function IntegrationActions({
  provider,
  integration,
  onChange,
}: Readonly<{
  provider: IntegrationProvider;
  integration?: Integration | undefined;
  onChange?: () => void;
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
    const payload = await apiFetch<{ url: string }>(`/api/integrations/${provider}/authorize-url`);
    window.location.href = payload.url;
  }

  async function sync() {
    setBusy(true);
    setSyncStatus("running");
    await apiFetch(`/api/integrations/${provider}/sync`, { method: "POST" });

    const interval = window.setInterval(async () => {
      const payload = await apiFetch<SyncStatusResponse>(`/api/integrations/${provider}/sync-status`);
      setSyncStatus(payload.status);

      if (payload.status === "idle" || payload.status === "error") {
        window.clearInterval(interval);
        setBusy(false);
        onChange?.();
        router.refresh();
      }
    }, 3000);
  }

  async function disconnect() {
    if (!window.confirm(`Disconnect ${provider === "hubspot" ? "HubSpot" : "Fathom"}? Existing data will be kept but no new data will sync.`)) {
      return;
    }

    setBusy(true);
    await apiFetch(`/api/integrations/${provider}`, { method: "DELETE" });
    setBusy(false);
    onChange?.();
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

"use client";

import { useEffect, useState } from "react";

import type { Integration, IntegrationProvider } from "@pipeline-intelligence/shared";

import { IntegrationActions } from "../../../components/integration-actions";
import { Panel, SectionTitle } from "../../../components/ui";
import { apiFetch, toErrorMessage } from "../../../lib/api";

const providerContent: Record<
  IntegrationProvider,
  {
    title: string;
    syncs: string;
  }
> = {
  hubspot: {
    title: "HubSpot",
    syncs: "Deals (all stages + closed), Contacts, Stage changes, Deal outcomes",
  },
  fathom: {
    title: "Fathom",
    syncs: "Meetings, Transcripts",
  },
};

const providerIcons: Record<IntegrationProvider, React.ReactNode> = {
  hubspot: (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[rgba(255,108,54,0.1)] text-base font-bold text-[#ff6c36]">
      H
    </div>
  ),
  fathom: (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[rgba(14,88,221,0.1)] font-[var(--font-display)] text-base text-[#1d74e7]">
      F
    </div>
  ),
};

function statusText(integration?: Integration) {
  if (!integration) return "Not connected";
  if (integration.status === "error") return "Connection error";
  if (integration.status === "connected") return "Connected";
  return "Not connected";
}

function statusDot(integration?: Integration) {
  if (!integration) return "bg-[color:var(--muted)]";
  if (integration.status === "error") return "bg-[color:var(--danger)]";
  if (integration.status === "connected") return "bg-[color:var(--success)]";
  return "bg-[color:var(--muted)]";
}

export default function SettingsPage() {
  const [integrations, setIntegrations] = useState<Integration[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    setIntegrations(null);
    setError(null);

    void (async () => {
      try {
        const nextIntegrations = await apiFetch<Integration[]>("/api/integrations");

        if (active) {
          setIntegrations(nextIntegrations);
        }
      } catch (error) {
        if (active) {
          setError(toErrorMessage(error));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (!integrations && !error) {
    return (
      <Panel>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--line-strong)] border-t-[color:var(--accent)]" />
          <p className="text-sm text-[color:var(--muted)]">Loading integrations...</p>
        </div>
      </Panel>
    );
  }

  if (!integrations) {
    return (
      <Panel className="border-[rgba(229,72,77,0.12)] bg-[color:var(--danger-soft)]">
        <p className="text-sm text-[color:var(--danger)]">{error ?? "Could not load integrations."}</p>
      </Panel>
    );
  }

  const lookup = new Map<IntegrationProvider, Integration>(integrations.map((integration) => [integration.provider, integration]));

  return (
    <div className="space-y-8">
      <SectionTitle eyebrow="Settings" title="Integrations" />
      <div className="space-y-4">
        {(["hubspot", "fathom"] as const).map((provider) => {
          const integration = lookup.get(provider);

          return (
            <Panel key={provider}>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-4">
                  {providerIcons[provider]}
                  <div className="space-y-2">
                    <div>
                      <h2 className="font-[var(--font-display)] text-2xl tracking-[-0.01em] text-[color:var(--text-strong)]">{providerContent[provider].title}</h2>
                      <p className="mt-1.5 flex items-center gap-2 text-sm text-[color:var(--muted)]">
                        <span className={`h-2 w-2 rounded-full ${statusDot(integration)}`} />
                        <span className="font-medium text-[color:var(--text)]">{statusText(integration)}</span>
                      </p>
                      {integration?.status === "error" ? (
                        <p className="mt-1 text-sm text-[color:var(--danger)]">
                          The last sync failed. Reconnect or run sync again to refresh this integration.
                        </p>
                      ) : null}
                      {integration?.last_synced_at ? (
                        <p className="mt-1 text-sm text-[color:var(--muted)]">
                          Last synced: {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(integration.last_synced_at))}
                        </p>
                      ) : null}
                    </div>
                    <p className="max-w-2xl text-sm leading-relaxed text-[color:var(--muted)]">{providerContent[provider].syncs}</p>
                  </div>
                </div>
                <IntegrationActions provider={provider} integration={integration} onChange={() => setRefreshKey((value) => value + 1)} />
              </div>
            </Panel>
          );
        })}
      </div>
      <Panel>
        <p className="text-sm leading-relaxed text-[color:var(--muted)]">
          Data access is read-only. This app does not send emails or modify your CRM data.
        </p>
      </Panel>
    </div>
  );
}

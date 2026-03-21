import type { Integration, IntegrationProvider } from "@pipeline-intelligence/shared";

import { IntegrationActions } from "../../../components/integration-actions";
import { Panel, SectionTitle } from "../../../components/ui";
import { apiFetch } from "../../../lib/api";

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

function statusText(integration?: Integration) {
  if (!integration) return "⚪ Not connected";
  if (integration.status === "error") return "🔴 Connection error";
  if (integration.status === "connected") return "✅ Connected";
  return "⚪ Not connected";
}

export default async function SettingsPage() {
  const integrations = await apiFetch<Integration[]>("/api/integrations");
  const lookup = new Map<IntegrationProvider, Integration>(integrations.map((integration) => [integration.provider, integration]));

  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="Settings" title="Integrations" />
      <div className="space-y-4">
        {(["hubspot", "fathom"] as const).map((provider) => {
          const integration = lookup.get(provider);

          return (
            <Panel key={provider} className="bg-white/82">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-[-0.05em]">{providerContent[provider].title}</h2>
                    <p className="mt-2 text-sm text-[color:var(--muted)]">
                      Status: <span className="font-medium text-[color:var(--text)]">{statusText(integration)}</span>
                    </p>
                    {integration?.status === "error" ? (
                      <p className="text-sm text-[color:var(--danger)]">
                        The last sync failed. Reconnect or run sync again to refresh this integration.
                      </p>
                    ) : null}
                    {integration?.last_synced_at ? (
                      <p className="text-sm text-[color:var(--muted)]">
                        Last synced: {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(integration.last_synced_at))}
                      </p>
                    ) : null}
                  </div>
                  <p className="max-w-2xl text-sm leading-7 text-[color:var(--muted)]">{providerContent[provider].syncs}</p>
                </div>
                <IntegrationActions provider={provider} integration={integration} />
              </div>
            </Panel>
          );
        })}
      </div>
      <Panel className="bg-white/70">
        <p className="text-sm leading-7 text-[color:var(--muted)]">
          Data access is read-only. This app does not send emails or modify your CRM data.
        </p>
      </Panel>
    </div>
  );
}

import type { AgentToolActionResult } from "@pipeline-intelligence/shared";
import type { Database } from "@pipeline-intelligence/db";

import { assertData, assertMaybeData, assertNoError, supabase } from "./supabase-utils";
import { decryptSecret, encryptSecret } from "../utils/security";

const hubspotApiBase = "https://api.hubapi.com";

type IntegrationRow = Database["public"]["Tables"]["integrations"]["Row"];

type HubSpotTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

type HubSpotAuth = {
  getAccessToken(): string;
  refreshAccessToken(): Promise<string>;
};

type HubSpotDealResponse = {
  id: string;
  properties: Record<string, string | null>;
  associations?: {
    contacts?: {
      results: Array<{
        id: string;
      }>;
    };
  };
};

const associationTypeIds = {
  note: {
    contact: 202,
    deal: 214,
  },
  task: {
    contact: 204,
    deal: 216,
  },
  email: {
    contact: 198,
    deal: 210,
  },
} as const;

function toAssociation(toId: string, associationTypeId: number) {
  return {
    to: {
      id: toId,
    },
    types: [
      {
        associationCategory: "HUBSPOT_DEFINED",
        associationTypeId,
      },
    ],
  };
}

async function refreshHubSpotAccessToken(refreshToken: string): Promise<HubSpotTokenResponse> {
  const response = await fetch(`${hubspotApiBase}/oauth/v3/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.HUBSPOT_CLIENT_ID ?? "",
      client_secret: process.env.HUBSPOT_CLIENT_SECRET ?? "",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh HubSpot access token");
  }

  return (await response.json()) as HubSpotTokenResponse;
}

async function getHubSpotIntegration(userId: string) {
  const row = assertMaybeData(
    await supabase
      .from("integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "hubspot")
      .eq("status", "connected")
      .maybeSingle(),
  );

  if (!row) {
    throw new Error("HubSpot is not connected for this user");
  }

  return row;
}

function createHubSpotAuth(integration: IntegrationRow): HubSpotAuth {
  let accessToken = decryptSecret(integration.access_token);
  let refreshToken = integration.refresh_token ? decryptSecret(integration.refresh_token) : null;

  return {
    getAccessToken() {
      return accessToken;
    },
    async refreshAccessToken() {
      if (!refreshToken) {
        throw new Error("HubSpot refresh token is missing. Reconnect HubSpot and try again.");
      }

      const tokenResponse = await refreshHubSpotAccessToken(refreshToken);
      accessToken = tokenResponse.access_token;

      if (tokenResponse.refresh_token) {
        refreshToken = tokenResponse.refresh_token;
      }

      assertNoError(
        await supabase
          .from("integrations")
          .update({
            access_token: encryptSecret(accessToken),
            refresh_token: refreshToken ? encryptSecret(refreshToken) : null,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", integration.id),
      );

      return accessToken;
    },
  };
}

async function hubspotRequest<T>(path: string, auth: HubSpotAuth, init?: RequestInit): Promise<T> {
  const doFetch = (token: string) =>
    fetch(`${hubspotApiBase}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

  let response = await doFetch(auth.getAccessToken());

  if (response.status === 401) {
    response = await doFetch(await auth.refreshAccessToken());
  }

  if (!response.ok) {
    throw new Error(`HubSpot request failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as T;
}

export async function fetchHubSpotDealForUser(userId: string, dealExternalId: string): Promise<HubSpotDealResponse> {
  const integration = await getHubSpotIntegration(userId);
  const auth = createHubSpotAuth(integration);
  const params = new URLSearchParams({
    associations: "contacts",
    properties: ["dealname", "dealstage", "hubspot_owner_id"].join(","),
  });

  return hubspotRequest<HubSpotDealResponse>(`/crm/v3/objects/deals/${dealExternalId}?${params.toString()}`, auth);
}

export async function createHubSpotNoteForUser(
  userId: string,
  input: {
    body: string;
    dealExternalId: string;
    contactIds?: string[];
  },
): Promise<AgentToolActionResult> {
  const integration = await getHubSpotIntegration(userId);
  const auth = createHubSpotAuth(integration);
  const contactIds = input.contactIds ?? [];

  const response = await hubspotRequest<{ id: string }>("/crm/v3/objects/notes", auth, {
    method: "POST",
    body: JSON.stringify({
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_note_body: input.body,
      },
      associations: [
        toAssociation(input.dealExternalId, associationTypeIds.note.deal),
        ...contactIds.map((contactId) => toAssociation(contactId, associationTypeIds.note.contact)),
      ],
    }),
  });

  return {
    action: "hubspot_note_created",
    target: input.dealExternalId,
    status: "completed",
    summary: "Saved a note to HubSpot for this deal.",
    reference_id: response.id,
  };
}

export async function createHubSpotTaskForUser(
  userId: string,
  input: {
    subject: string;
    body?: string;
    dueAt: string;
    priority?: "LOW" | "MEDIUM" | "HIGH";
    taskType?: "EMAIL" | "CALL" | "TODO";
    dealExternalId: string;
    contactIds?: string[];
  },
): Promise<AgentToolActionResult> {
  const integration = await getHubSpotIntegration(userId);
  const auth = createHubSpotAuth(integration);
  const contactIds = input.contactIds ?? [];

  const response = await hubspotRequest<{ id: string }>("/crm/v3/objects/tasks", auth, {
    method: "POST",
    body: JSON.stringify({
      properties: {
        hs_timestamp: input.dueAt,
        hs_task_subject: input.subject,
        hs_task_body: input.body ?? "",
        hs_task_status: "NOT_STARTED",
        hs_task_priority: input.priority ?? "MEDIUM",
        hs_task_type: input.taskType ?? "TODO",
      },
      associations: [
        toAssociation(input.dealExternalId, associationTypeIds.task.deal),
        ...contactIds.map((contactId) => toAssociation(contactId, associationTypeIds.task.contact)),
      ],
    }),
  });

  return {
    action: "hubspot_task_created",
    target: input.dealExternalId,
    status: "completed",
    summary: "Created a follow-up task in HubSpot.",
    reference_id: response.id,
  };
}

export async function createHubSpotEmailForUser(
  userId: string,
  input: {
    subject: string;
    text: string;
    html?: string;
    dealExternalId: string;
    contactIds?: string[];
  },
): Promise<AgentToolActionResult> {
  const integration = await getHubSpotIntegration(userId);
  const auth = createHubSpotAuth(integration);
  const contactIds = input.contactIds ?? [];

  const response = await hubspotRequest<{ id: string }>("/crm/v3/objects/emails", auth, {
    method: "POST",
    body: JSON.stringify({
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_email_direction: "EMAIL",
        hs_email_status: "SCHEDULED",
        hs_email_subject: input.subject,
        hs_email_text: input.text,
        ...(input.html ? { hs_email_html: input.html } : {}),
      },
      associations: [
        toAssociation(input.dealExternalId, associationTypeIds.email.deal),
        ...contactIds.map((contactId) => toAssociation(contactId, associationTypeIds.email.contact)),
      ],
    }),
  });

  return {
    action: "hubspot_email_logged",
    target: input.dealExternalId,
    status: "completed",
    summary: "Logged the drafted follow-up email to HubSpot.",
    reference_id: response.id,
  };
}

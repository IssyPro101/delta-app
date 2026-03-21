import { env } from "../utils/env";

const hubspotApiBase = "https://api.hubapi.com";
const hubspotAppBase = "https://app.hubspot.com";

const hubspotScopes = [
  "oauth",
  "crm.objects.deals.read",
  "crm.objects.contacts.read",
  "crm.objects.contacts.write"
];

export interface HubSpotTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface HubSpotAuth {
  getAccessToken(): string;
  refreshAccessToken(): Promise<string>;
}

export function createHubSpotAuth(
  initialAccessToken: string,
  initialRefreshToken: string | null,
  onTokenRefreshed?: (tokens: HubSpotTokenResponse) => Promise<void>,
): HubSpotAuth {
  let accessToken = initialAccessToken;
  let refreshToken = initialRefreshToken;

  return {
    getAccessToken() {
      return accessToken;
    },
    async refreshAccessToken() {
      if (!refreshToken) {
        throw new Error("No HubSpot refresh token available — re-authenticate to reconnect");
      }
      const tokenResponse = await refreshHubSpotAccessToken(refreshToken);
      accessToken = tokenResponse.access_token;
      if (tokenResponse.refresh_token) {
        refreshToken = tokenResponse.refresh_token;
      }
      await onTokenRefreshed?.(tokenResponse);
      return accessToken;
    },
  };
}

export interface HubSpotDealResponse {
  id: string;
  properties: Record<string, string | null>;
  propertiesWithHistory?: Record<
    string,
    Array<{
      value: string | null;
      timestamp: string;
      sourceId?: string;
      sourceType?: string;
    }>
  >;
  associations?: {
    contacts?: {
      results: Array<{
        id: string;
      }>;
    };
  };
}

export interface HubSpotContactResponse {
  id: string;
  properties: Record<string, string | null>;
  associations?: {
    deals?: {
      results: Array<{
        id: string;
      }>;
    };
  };
}

function ensureHubSpotEnv() {
  if (!env.hubspotClientId || !env.hubspotClientSecret || !env.hubspotRedirectUri) {
    throw new Error("HubSpot OAuth is not configured");
  }
}

export function getHubSpotAuthorizeUrl(state: string) {
  ensureHubSpotEnv();

  const params = new URLSearchParams({
    client_id: env.hubspotClientId!,
    redirect_uri: env.hubspotRedirectUri!,
    scope: hubspotScopes.join(" "),
    state,
  });

  return `${hubspotAppBase}/oauth/authorize?${params.toString()}`;
}

export async function exchangeHubSpotCode(code: string): Promise<HubSpotTokenResponse> {
  ensureHubSpotEnv();

  const response = await fetch(`${hubspotApiBase}/oauth/v3/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.hubspotRedirectUri!,
      client_id: env.hubspotClientId!,
      client_secret: env.hubspotClientSecret!,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange HubSpot authorization code");
  }

  return (await response.json()) as HubSpotTokenResponse;
}

export async function refreshHubSpotAccessToken(refreshToken: string): Promise<HubSpotTokenResponse> {
  ensureHubSpotEnv();

  const response = await fetch(`${hubspotApiBase}/oauth/v3/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: env.hubspotClientId!,
      client_secret: env.hubspotClientSecret!,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh HubSpot access token");
  }

  return (await response.json()) as HubSpotTokenResponse;
}

async function hubspotRequest<T>(
  path: string,
  auth: HubSpotAuth,
  init?: RequestInit,
): Promise<T> {
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
    const newToken = await auth.refreshAccessToken();
    response = await doFetch(newToken);
  }

  if (!response.ok) {
    console.error(await response.text());
    throw new Error(`HubSpot request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchHubSpotDeal(auth: HubSpotAuth, dealId: string): Promise<HubSpotDealResponse> {
  const params = new URLSearchParams({
    properties: [
      "dealname",
      "dealstage",
      "amount",
      "closedate",
      "pipeline",
      "hubspot_owner_id",
      "createdate",
      "hs_is_closed",
      "hs_is_closed_won",
      "company_name",
    ].join(","),
    propertiesWithHistory: ["dealstage", "amount", "closedate", "hs_is_closed_won"].join(","),
    associations: "contacts",
  });

  return hubspotRequest<HubSpotDealResponse>(`/crm/v3/objects/deals/${dealId}?${params.toString()}`, auth);
}

export async function listHubSpotDeals(
  auth: HubSpotAuth,
  after?: string,
): Promise<{
  results: HubSpotDealResponse[];
  paging?: { next?: { after?: string } };
}> {
  const params = new URLSearchParams({
    limit: "50",
    properties: [
      "dealname",
      "dealstage",
      "amount",
      "closedate",
      "pipeline",
      "hubspot_owner_id",
      "createdate",
      "hs_is_closed",
      "hs_is_closed_won",
      "company_name",
    ].join(","),
    propertiesWithHistory: ["dealstage", "amount", "closedate", "hs_is_closed_won"].join(","),
    associations: "contacts",
  });

  if (after) {
    params.set("after", after);
  }

  return hubspotRequest(`/crm/v3/objects/deals?${params.toString()}`, auth);
}

export async function fetchHubSpotContact(auth: HubSpotAuth, contactId: string) {
  const params = new URLSearchParams({
    properties: ["email", "firstname", "lastname"].join(","),
    associations: "deals",
  });

  return hubspotRequest<HubSpotContactResponse>(`/crm/v3/objects/contacts/${contactId}?${params.toString()}`, auth);
}

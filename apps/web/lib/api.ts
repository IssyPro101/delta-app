import type { AuthSession } from "@pipeline-intelligence/shared";

import { getSupabaseBrowserClient } from "./supabase";

function parseErrorMessage(body: string, status: number) {
  if (!body) {
    return `Request failed: ${status}`;
  }

  try {
    const payload = JSON.parse(body) as { error?: string; message?: string };
    return payload.message ?? payload.error ?? body;
  } catch {
    return body;
  }
}

function toHeaders(init?: RequestInit, accessToken?: string) {
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return headers;
}

export function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}

async function requestWithAccessToken<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: toHeaders(init, accessToken),
    cache: "no-store",
  });

  const body = await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      await getSupabaseBrowserClient().auth.signOut();
    }

    throw new Error(parseErrorMessage(body, response.status));
  }

  return (body ? (JSON.parse(body) as T) : (null as T));
}

async function getAccessToken() {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();

  if (error) {
    throw error;
  }

  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("Missing Supabase access token");
  }

  return accessToken;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return requestWithAccessToken<T>(path, await getAccessToken(), init);
}

export async function fetchAuthSession(accessToken: string) {
  return requestWithAccessToken<AuthSession>("/api/auth/session", accessToken);
}

import { createClient } from "./supabase-server";

const forwardedHeaders = [
  "content-type",
  "cache-control",
  "connection",
  "x-vercel-ai-ui-message-stream",
  "x-accel-buffering",
  "x-agent-conversation-id",
] as const;

function getAgentBaseUrl() {
  return process.env.AGENT_BASE_URL ?? "http://localhost:4100";
}

async function getAccessToken() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    return null;
  }

  return data.session.access_token;
}

export async function proxyAgentRequest(request: Request, path: string, init?: RequestInit) {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return new Response(JSON.stringify({ message: "Authentication required" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${getAgentBaseUrl()}${path}`, {
    method: init?.method ?? request.method,
    headers,
    ...(init?.body !== undefined ? { body: init.body } : {}),
    cache: "no-store",
  });

  const nextHeaders = new Headers();

  for (const header of forwardedHeaders) {
    const value = response.headers.get(header);

    if (value) {
      nextHeaders.set(header, value);
    }
  }

  if (!nextHeaders.has("content-type") && response.headers.get("content-type")) {
    nextHeaders.set("content-type", response.headers.get("content-type")!);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders,
  });
}

import type {
  AgentConversation,
  AgentConversationDetailResponse,
  AgentConversationListResponse,
} from "@pipeline-intelligence/shared";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(parseErrorMessage(body, response.status));
  }

  return body ? (JSON.parse(body) as T) : (null as T);
}

export async function listAgentConversations() {
  return request<AgentConversationListResponse>("/agent-api/conversations");
}

export async function createAgentConversation(title?: string) {
  return request<AgentConversation>("/agent-api/conversations", {
    method: "POST",
    body: JSON.stringify(title ? { title } : {}),
  });
}

export async function getAgentConversation(conversationId: string) {
  return request<AgentConversationDetailResponse>(`/agent-api/conversations/${conversationId}/messages`);
}

import type { AgentConversation, AgentConversationSummary, AgentMessage } from "@pipeline-intelligence/shared";
import type { UIMessage } from "ai";
import type { Database, Json } from "@pipeline-intelligence/db";

import { assertData, assertMaybeData, assertNoError, supabase } from "./supabase-utils";

type ConversationRow = Database["public"]["Tables"]["agent_conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["agent_messages"]["Row"];

function serializeConversation(row: ConversationRow): AgentConversation {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toRecordArray(value: Json): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) =>
    item && typeof item === "object" && !Array.isArray(item) ? [item as Record<string, unknown>] : [],
  );
}

function serializeMessage(row: MessageRow): AgentMessage {
  return {
    id: row.message_id,
    role: row.role,
    parts: toRecordArray(row.parts),
    created_at: row.created_at,
  };
}

function normalizeMessageParts(parts: unknown): Json {
  if (!Array.isArray(parts)) {
    return [];
  }

  return parts.flatMap((part) =>
    part && typeof part === "object" && !Array.isArray(part) ? [part as Record<string, unknown>] : [],
  ) as Json;
}

function getFirstUserText(messages: UIMessage[]) {
  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }

    const text = message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join(" ")
      .trim();

    if (text) {
      return text;
    }
  }

  return null;
}

function buildConversationTitle(messages: UIMessage[]) {
  const text = getFirstUserText(messages);

  if (!text) {
    return "New chat";
  }

  return text.length > 72 ? `${text.slice(0, 69).trimEnd()}...` : text;
}

export async function createConversation(userId: string, title = "New chat"): Promise<AgentConversation> {
  const row = assertData(
    await supabase
      .from("agent_conversations")
      .insert({
        user_id: userId,
        title,
      })
      .select("*")
      .single(),
  );

  return serializeConversation(row);
}

export async function getConversation(userId: string, conversationId: string): Promise<AgentConversation | null> {
  const row = assertMaybeData(
    await supabase
      .from("agent_conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle(),
  );

  return row ? serializeConversation(row) : null;
}

export async function listConversations(userId: string): Promise<AgentConversationSummary[]> {
  const [conversationRows, messageRows] = await Promise.all([
    assertData(
      await supabase
        .from("agent_conversations")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }),
    ),
    assertData(
      await supabase
        .from("agent_messages")
        .select("conversation_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ),
  ]);

  const stats = new Map<string, { message_count: number; last_message_at: string | null }>();

  for (const row of messageRows) {
    const current = stats.get(row.conversation_id);

    if (current) {
      current.message_count += 1;
      continue;
    }

    stats.set(row.conversation_id, {
      message_count: 1,
      last_message_at: row.created_at,
    });
  }

  return conversationRows.map((row) => {
    const stat = stats.get(row.id);

    return {
      ...serializeConversation(row),
      message_count: stat?.message_count ?? 0,
      last_message_at: stat?.last_message_at ?? null,
    };
  });
}

export async function getConversationMessages(userId: string, conversationId: string): Promise<AgentMessage[]> {
  const rows = assertData(
    await supabase
      .from("agent_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .order("position", { ascending: true }),
  );

  return rows.map(serializeMessage);
}

export async function saveConversationMessages(
  userId: string,
  conversationId: string,
  messages: UIMessage[],
): Promise<void> {
  const title = buildConversationTitle(messages);
  const timestamp = new Date().toISOString();

  assertNoError(
    await supabase
      .from("agent_conversations")
      .update({
        title,
        updated_at: timestamp,
      })
      .eq("id", conversationId)
      .eq("user_id", userId),
  );

  if (messages.length === 0) {
    return;
  }

  // Upsert messages using the (conversation_id, message_id) unique constraint.
  // This inserts new messages and updates existing ones in place, avoiding
  // the need to delete and re-insert the entire conversation on every save.
  assertNoError(
    await supabase
      .from("agent_messages")
      .upsert(
        messages.map((message, index) => ({
          conversation_id: conversationId,
          user_id: userId,
          message_id: message.id,
          position: index,
          role: message.role,
          parts: normalizeMessageParts(message.parts),
          created_at: timestamp,
        })),
        { onConflict: "conversation_id,message_id", ignoreDuplicates: false },
      ),
  );
}

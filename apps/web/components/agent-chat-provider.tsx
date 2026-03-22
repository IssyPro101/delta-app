"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { AgentConversationSummary } from "@pipeline-intelligence/shared";

import { createAgentConversation, listAgentConversations } from "../lib/agent-api";
import { toErrorMessage } from "../lib/api";

type AgentChatContextValue = {
  open: boolean;
  loading: boolean;
  error: string | null;
  conversations: AgentConversationSummary[];
  activeConversationId: string | null;
  setOpen: (value: boolean) => void;
  toggleOpen: () => void;
  setActiveConversationId: (value: string) => void;
  refreshConversations: () => Promise<void>;
  createConversation: () => Promise<string>;
};

const AgentChatContext = createContext<AgentChatContextValue | null>(null);

function toConversationSummary(conversation: {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}): AgentConversationSummary {
  const timestamp = new Date().toISOString();

  return {
    ...conversation,
    updated_at: conversation.updated_at ?? timestamp,
    message_count: 0,
    last_message_at: null,
  };
}

export function AgentChatProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AgentConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const refreshConversations = useCallback(async () => {
    setError(null);

    try {
      const payload = await listAgentConversations();
      setConversations(payload.conversations);

      if (payload.conversations.length === 0) {
        const created = await createAgentConversation();
        const summary = toConversationSummary(created);
        setConversations([summary]);
        setActiveConversationId(created.id);
      } else {
        setActiveConversationId((current) => {
          if (current && payload.conversations.some((conversation) => conversation.id === current)) {
            return current;
          }

          return payload.conversations[0]?.id ?? null;
        });
      }
    } catch (nextError) {
      setError(toErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  const createConversation = useCallback(async () => {
    const created = await createAgentConversation();
    const summary = toConversationSummary(created);

    setConversations((current) => [summary, ...current]);
    setActiveConversationId(created.id);
    setOpen(true);

    return created.id;
  }, []);

  const value = useMemo<AgentChatContextValue>(
    () => ({
      open,
      loading,
      error,
      conversations,
      activeConversationId,
      setOpen,
      toggleOpen: () => setOpen((current) => !current),
      setActiveConversationId,
      refreshConversations,
      createConversation,
    }),
    [activeConversationId, conversations, createConversation, error, loading, open, refreshConversations],
  );

  return <AgentChatContext.Provider value={value}>{children}</AgentChatContext.Provider>;
}

export function useAgentChat() {
  const value = useContext(AgentChatContext);

  if (!value) {
    throw new Error("useAgentChat must be used within an AgentChatProvider");
  }

  return value;
}

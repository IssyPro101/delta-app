"use client";

import clsx from "clsx";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { useEffect, useMemo, useState } from "react";

import type { AgentConversationDetailResponse, AgentConversationSummary } from "@pipeline-intelligence/shared";

import { getAgentConversation } from "../lib/agent-api";
import { toErrorMessage } from "../lib/api";
import { useAgentChat } from "./agent-chat-provider";
import { EmptyState, PrimaryButton, SecondaryButton } from "./ui";

function formatTimestamp(value: string | null) {
  if (!value) {
    return "No messages yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatToolName(partType: string, dynamicName?: string) {
  const rawName = partType === "dynamic-tool" ? dynamicName ?? "tool" : partType.replace(/^tool-/, "");
  return rawName
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderStructuredValue(value: unknown) {
  if (!value) {
    return null;
  }

  if (typeof value === "object" && value !== null && "summary" in value && typeof value.summary === "string") {
    return value.summary;
  }

  return JSON.stringify(value, null, 2);
}

function ToolInvocationCard({
  part,
}: Readonly<{
  part: Record<string, unknown> & { type: string };
}>) {
  const state = typeof part.state === "string" ? part.state : "input-available";
  const displayValue =
    state === "output-available"
      ? renderStructuredValue(part.output)
      : state === "output-error"
        ? String(part.errorText ?? "Tool execution failed.")
        : renderStructuredValue(part.input);

  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[rgba(255,255,255,0.03)] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
          {formatToolName(part.type, typeof part.toolName === "string" ? part.toolName : undefined)}
        </p>
        <span className="rounded-full border border-[color:var(--line)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
          {state.replaceAll("-", " ")}
        </span>
      </div>
      {displayValue ? (
        <pre className="mt-2 whitespace-pre-wrap break-words font-[var(--font-mono)] text-[11px] leading-5 text-[color:var(--text)]">
          {displayValue}
        </pre>
      ) : null}
    </div>
  );
}

function MessageBubble({ message }: Readonly<{ message: UIMessage }>) {
  const isUser = message.role === "user";

  return (
    <div className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[88%] space-y-2 rounded-[24px] px-4 py-3 shadow-[var(--shadow)]",
          isUser
            ? "bg-gradient-to-br from-[#0e58dd] to-[#1d74e7] text-white"
            : "border border-[color:var(--line)] bg-[color:var(--panel)] text-[color:var(--text)]",
        )}
      >
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            return (
              <p
                key={`${message.id}-${index}`}
                className={clsx(
                  "whitespace-pre-wrap text-sm leading-6",
                  isUser ? "text-white" : "text-[color:var(--text)]",
                )}
              >
                {part.text}
              </p>
            );
          }

          if (part.type === "step-start") {
            return (
              <p key={`${message.id}-${index}`} className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Working...
              </p>
            );
          }

          if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
            return <ToolInvocationCard key={`${message.id}-${index}`} part={part as Record<string, unknown> & { type: string }} />;
          }

          return null;
        })}
      </div>
    </div>
  );
}

function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
}: Readonly<{
  conversations: AgentConversationSummary[];
  activeConversationId: string | null;
  onSelect: (conversationId: string) => void;
}>) {
  return (
    <div className="space-y-2">
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          onClick={() => onSelect(conversation.id)}
          className={clsx(
            "w-full rounded-2xl border px-3 py-2.5 text-left transition-colors",
            conversation.id === activeConversationId
              ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
              : "border-[color:var(--line)] bg-[rgba(255,255,255,0.02)] hover:border-[color:var(--line-strong)]",
          )}
        >
          <p className="truncate text-sm font-medium text-[color:var(--text-strong)]">
            {conversation.title}
          </p>
          <p className="mt-1 text-[11px] text-[color:var(--muted)]">
            {formatTimestamp(conversation.last_message_at)}
          </p>
        </button>
      ))}
    </div>
  );
}

function AgentConversationThread({
  conversationId,
  initialMessages,
  onRefresh,
}: Readonly<{
  conversationId: string;
  initialMessages: UIMessage[];
  onRefresh: () => Promise<void>;
}>) {
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/agent/chat",
        body: {
          conversation_id: conversationId,
        },
      }),
    [conversationId],
  );
  const { messages, sendMessage, status, error } = useChat<UIMessage>({
    id: conversationId,
    messages: initialMessages,
    transport,
    onFinish: () => {
      void onRefresh();
    },
  });
  const disabled = status === "submitted" || status === "streaming";

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <EmptyState
            title="Ask Delta anything"
            description="Summarize your pipeline, spot deal risks, draft a follow-up email, or save a CRM note or task when you're ready."
          />
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
      </div>
      <form
        className="mt-4 space-y-3 border-t border-[color:var(--line)] pt-4"
        onSubmit={(event) => {
          event.preventDefault();

          if (!input.trim() || disabled) {
            return;
          }

          void sendMessage({ text: input.trim() });
          setInput("");
        }}
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.currentTarget.value)}
          placeholder="Draft a follow-up for Acme, summarize pipeline risk, or save a task to HubSpot..."
          disabled={disabled}
          rows={4}
          className="w-full resize-none rounded-2xl border border-[color:var(--line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-6 text-[color:var(--text-strong)] outline-none transition-colors placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-[color:var(--muted)]">
            {error ? error.message : disabled ? "Delta is responding..." : "Grounded in dashboard and CRM context."}
          </p>
          <PrimaryButton type="submit" disabled={disabled || !input.trim()}>
            Send
          </PrimaryButton>
        </div>
      </form>
    </>
  );
}

export function AgentSidebar() {
  const {
    open,
    toggleOpen,
    setOpen,
    loading,
    error,
    conversations,
    activeConversationId,
    setActiveConversationId,
    refreshConversations,
    createConversation,
  } = useAgentChat();
  const [detail, setDetail] = useState<AgentConversationDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeConversationId) {
      setDetail(null);
      return;
    }

    let active = true;
    setDetailLoading(true);
    setDetailError(null);

    void (async () => {
      try {
        const payload = await getAgentConversation(activeConversationId);

        if (active) {
          setDetail(payload);
        }
      } catch (nextError) {
        if (active) {
          setDetailError(toErrorMessage(nextError));
        }
      } finally {
        if (active) {
          setDetailLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [activeConversationId]);

  return (
    <>
      <button
        onClick={toggleOpen}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-full border border-[color:var(--line-strong)] bg-[rgba(9,9,12,0.9)] px-4 py-3 text-sm font-medium text-[color:var(--text-strong)] shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-transform hover:-translate-y-0.5"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#0e58dd] to-[#1d74e7] text-white">
          Δ
        </span>
        <span>{open ? "Close Delta" : "Ask Delta"}</span>
      </button>

      {open ? (
        <button
          aria-label="Close chat"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-[rgba(0,0,0,0.45)] backdrop-blur-[2px] md:hidden"
        />
      ) : null}

      <aside
        className={clsx(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-[color:var(--line)] bg-[rgba(7,7,10,0.94)] px-4 py-4 shadow-[-16px_0_48px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] pb-4">
          <div>
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted)]">
              Universal Copilot
            </p>
            <h2 className="mt-1 font-[var(--font-display)] text-[28px] text-[color:var(--text-strong)]">
              Delta
            </h2>
          </div>
          <SecondaryButton onClick={() => setOpen(false)}>Close</SecondaryButton>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-[color:var(--muted)]">
            Ask about pipeline health, draft follow-ups, or save CRM actions.
          </p>
          <PrimaryButton
            onClick={() => {
              void createConversation();
            }}
          >
            New chat
          </PrimaryButton>
        </div>

        <div className="mt-4 max-h-44 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-[color:var(--muted)]">Loading conversations...</p>
          ) : error ? (
            <p className="text-sm text-[color:var(--danger)]">{error}</p>
          ) : (
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelect={(conversationId) => {
                setActiveConversationId(conversationId);
              }}
            />
          )}
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          {detailLoading ? (
            <div className="grid flex-1 place-items-center">
              <p className="text-sm text-[color:var(--muted)]">Loading conversation...</p>
            </div>
          ) : detailError ? (
            <div className="grid flex-1 place-items-center">
              <p className="text-sm text-[color:var(--danger)]">{detailError}</p>
            </div>
          ) : detail && activeConversationId ? (
            <AgentConversationThread
              key={activeConversationId}
              conversationId={activeConversationId}
              initialMessages={detail.messages as unknown as UIMessage[]}
              onRefresh={refreshConversations}
            />
          ) : null}
        </div>
      </aside>
    </>
  );
}

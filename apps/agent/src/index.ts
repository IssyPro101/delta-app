import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import {
  pipeAgentUIStreamToResponse,
  type UIMessage,
} from "ai";
import fastify from "fastify";

import type {
  AgentChatRequest,
  AgentConversationDetailResponse,
  AgentConversationListResponse,
} from "@pipeline-intelligence/shared";

import { createSalesAgent, getLatestUserIntentText } from "./services/agent";
import {
  createConversation,
  getConversation,
  getConversationMessages,
  listConversations,
  saveConversationMessages,
} from "./services/conversation-service";
import { authPlugin } from "./plugins/auth";
import { env } from "./utils/env";

function isUiMessageArray(value: unknown): value is UIMessage[] {
  return Array.isArray(value);
}

async function main() {
  const app = fastify({
    logger: true,
  });

  await app.register(sensible);
  await app.register(cors, {
    origin: env.webBaseUrl,
    credentials: true,
    exposedHeaders: ["x-agent-conversation-id"],
  });
  await app.register(authPlugin);

  app.get(
    "/api/agent/conversations",
    {
      preHandler: app.authenticate,
    },
    async (request): Promise<AgentConversationListResponse> => ({
      conversations: await listConversations(request.authUser!.id),
    }),
  );

  app.post(
    "/api/agent/conversations",
    {
      preHandler: app.authenticate,
    },
    async (request) => {
      const body = (request.body ?? {}) as { title?: string };
      return createConversation(request.authUser!.id, body.title?.trim() || "New chat");
    },
  );

  app.get(
    "/api/agent/conversations/:id/messages",
    {
      preHandler: app.authenticate,
    },
    async (request): Promise<AgentConversationDetailResponse> => {
      const params = request.params as { id: string };
      const conversation = await getConversation(request.authUser!.id, params.id);

      if (!conversation) {
        throw app.httpErrors.notFound("Conversation not found");
      }

      return {
        conversation,
        messages: await getConversationMessages(request.authUser!.id, params.id),
      };
    },
  );

  app.post(
    "/api/agent/chat",
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const body = (request.body ?? {}) as AgentChatRequest & {
        messages?: unknown;
        conversationId?: string;
        conversation_id?: string;
      };
      const conversationId = body.conversation_id ?? body.conversationId;

      if (!conversationId) {
        throw app.httpErrors.badRequest("conversation_id is required");
      }

      if (!isUiMessageArray(body.messages)) {
        throw app.httpErrors.badRequest("messages are required");
      }

      const conversation = await getConversation(request.authUser!.id, conversationId);

      if (!conversation) {
        throw app.httpErrors.notFound("Conversation not found");
      }

      const latestUserMessage = getLatestUserIntentText(body.messages as Array<{ role: string; parts: Array<{ type?: string; text?: string }> }>);
      const agent = createSalesAgent({
        userId: request.authUser!.id,
        accessToken: request.accessToken!,
        latestUserMessage,
      });

      const uiMessages = body.messages as UIMessage[];

      reply.hijack();
      reply.raw.setHeader("x-agent-conversation-id", conversationId);

      await pipeAgentUIStreamToResponse({
        response: reply.raw,
        agent,
        uiMessages: uiMessages as any,
        originalMessages: uiMessages as any,
        onFinish: async ({ messages }) => {
          await saveConversationMessages(request.authUser!.id, conversationId, messages);
        },
        onError: (error) => {
          console.error(error);
          request.log.error({ error }, "Agent stream failed");
          return "The agent hit an error while generating the response.";
        },
      });

      return reply;
    },
  );

  app.get("/health", async () => ({ ok: true }));

  await app.listen({
    host: "0.0.0.0",
    port: env.agentPort,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

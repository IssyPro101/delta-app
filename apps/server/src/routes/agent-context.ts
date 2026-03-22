import type { FastifyPluginAsync } from "fastify";

import {
  getAgentDealContext,
  getAgentWorkspaceSummary,
  searchAgentDeals,
} from "../services/agent-context-service";
import { listEvents } from "../services/event-service";

export const agentContextRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/agent-context/summary",
    {
      preHandler: app.authenticate,
    },
    async (request) => getAgentWorkspaceSummary(request.authUser!.id),
  );

  app.get(
    "/api/agent-context/deals",
    {
      preHandler: app.authenticate,
    },
    async (request) => {
      const query = request.query as {
        query?: string;
        stage?: string;
        outcome?: "open" | "won" | "lost";
        limit?: string;
      };

      return searchAgentDeals(request.authUser!.id, {
        ...(query.query ? { query: query.query } : {}),
        ...(query.stage ? { stage: query.stage } : {}),
        ...(query.outcome ? { outcome: query.outcome } : {}),
        ...(query.limit ? { limit: Number(query.limit) } : {}),
      });
    },
  );

  app.get(
    "/api/agent-context/deals/:id",
    {
      preHandler: app.authenticate,
    },
    async (request) => {
      const params = request.params as { id: string };
      const detail = await getAgentDealContext(request.authUser!.id, params.id);

      if (!detail) {
        throw app.httpErrors.notFound("Deal not found");
      }

      return detail;
    },
  );

  app.get(
    "/api/agent-context/recent-activity",
    {
      preHandler: app.authenticate,
    },
    async (request) => {
      const query = request.query as {
        deal_id?: string;
        stage?: string;
        limit?: string;
      };

      return listEvents(request.authUser!.id, {
        ...(query.deal_id ? { deal_id: query.deal_id } : {}),
        ...(query.stage ? { stage: query.stage } : {}),
        limit: query.limit ? Number(query.limit) : 10,
      });
    },
  );
};

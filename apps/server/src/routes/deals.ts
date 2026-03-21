import type { FastifyPluginAsync } from "fastify";

import { getDealById, listDeals } from "../services/deal-service";

export const dealRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/deals",
    {
      preHandler: app.authenticate,
    },
    async (request) => {
      const query = request.query as {
        stage?: string;
        outcome?: "open" | "won" | "lost";
        limit?: string;
        offset?: string;
      };

      return listDeals(request.authUser!.id, {
        ...(query.stage ? { stage: query.stage } : {}),
        ...(query.outcome ? { outcome: query.outcome } : {}),
        limit: query.limit ? Number(query.limit) : 50,
        offset: query.offset ? Number(query.offset) : 0,
      });
    },
  );

  app.get(
    "/api/deals/:id",
    {
      preHandler: app.authenticate,
    },
    async (request) => {
      const params = request.params as { id: string };
      const deal = await getDealById(request.authUser!.id, params.id);

      if (!deal) {
        throw app.httpErrors.notFound("Deal not found");
      }

      return deal;
    },
  );
};

import type { FastifyPluginAsync } from "fastify";

import { getEventById, listEvents } from "../services/event-service";

export const eventRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/events",
    {
      preHandler: app.authenticate,
    },
    async (request) => {
      const query = request.query as {
        source?: "fathom" | "hubspot";
        deal_id?: string;
        stage?: string;
        limit?: string;
        offset?: string;
      };

      return listEvents(request.authUser!.id, {
        ...(query.source ? { source: query.source } : {}),
        ...(query.deal_id ? { deal_id: query.deal_id } : {}),
        ...(query.stage ? { stage: query.stage } : {}),
        limit: query.limit ? Number(query.limit) : 50,
        offset: query.offset ? Number(query.offset) : 0,
      });
    },
  );

  app.get(
    "/api/events/:id",
    {
      preHandler: app.authenticate,
    },
    async (request) => {
      const params = request.params as { id: string };
      const event = await getEventById(request.authUser!.id, params.id);

      if (!event) {
        throw app.httpErrors.notFound("Event not found");
      }

      return event;
    },
  );
};

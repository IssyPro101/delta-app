import type { FastifyPluginAsync } from "fastify";
import { insightCategories, type InsightCategory } from "@pipeline-intelligence/shared";

import { listInsights } from "../services/insight-service";

export const insightsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/insights",
    {
      preHandler: app.authenticate,
    },
    async (request) => {
      const query = request.query as {
        category?: string;
        analyzer?: string;
        stage?: string;
        is_active?: string;
        limit?: string;
        offset?: string;
      };
      const category = query.category
        ? insightCategories.find((value) => value === query.category)
        : undefined;

      if (query.category && !category) {
        throw app.httpErrors.badRequest("Invalid insight category");
      }

      return listInsights(request.authUser!.id, {
        ...(category ? { category: category as InsightCategory } : {}),
        ...(query.analyzer ? { analyzer: query.analyzer } : {}),
        ...(query.stage ? { stage: query.stage } : {}),
        is_active: query.is_active ? query.is_active === "true" : true,
        limit: query.limit ? Number(query.limit) : 50,
        offset: query.offset ? Number(query.offset) : 0,
      });
    },
  );
};

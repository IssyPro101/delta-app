import type { FastifyPluginAsync } from "fastify";

import { getPipelineData } from "../services/pipeline-service";

export const pipelineRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/pipeline",
    {
      preHandler: app.authenticate,
    },
    async (request) => {
      const query = request.query as {
        pipeline_name?: string;
        period?: "last_30_days" | "last_90_days" | "last_180_days" | "all_time";
      };

      return getPipelineData(request.authUser!.id, {
        ...(query.pipeline_name ? { pipeline_name: query.pipeline_name } : {}),
        ...(query.period ? { period: query.period } : {}),
      });
    },
  );
};

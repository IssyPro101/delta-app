import type { FastifyPluginAsync } from "fastify";

import { getDashboardData } from "../services/dashboard-service";

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/dashboard",
    {
      preHandler: app.authenticate,
    },
    async (request) => getDashboardData(request.authUser!.id),
  );
};

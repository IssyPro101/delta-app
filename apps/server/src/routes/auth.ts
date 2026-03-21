import type { FastifyPluginAsync } from "fastify";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/auth/session",
    {
      preHandler: app.authenticate,
    },
    async (request) => ({ user: request.authUser }),
  );
};

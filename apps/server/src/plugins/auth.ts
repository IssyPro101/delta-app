import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import fp from "fastify-plugin";

import { env } from "../utils/env";

export const authPlugin = fp(async (app) => {
  await app.register(cookie);
  await app.register(jwt, {
    secret: env.sessionSecret,
    cookie: {
      cookieName: env.sessionCookieName,
      signed: false,
    },
  });

  app.decorateRequest("authUser", null);
  app.decorate("authenticate", async (request) => {
    try {
      const decoded = await request.jwtVerify<{
        user: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          created_at: string;
        };
      }>();

      request.authUser = decoded.user;
    } catch (error) {
      throw app.httpErrors.unauthorized("Authentication required", { cause: error });
    }
  });
});

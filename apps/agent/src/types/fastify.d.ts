import type { FastifyReply, FastifyRequest } from "fastify";

import type { AppUser } from "@pipeline-intelligence/shared";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    authUser: AppUser | null;
    accessToken: string | null;
  }
}

import crypto from "node:crypto";

import type { FastifyPluginAsync } from "fastify";
import type { IntegrationProvider } from "@pipeline-intelligence/shared";

import { enqueueBackfill } from "../queues";
import { exchangeFathomCode, getFathomAuthorizeUrl } from "../integrations/fathom";
import { exchangeHubSpotCode, getHubSpotAuthorizeUrl } from "../integrations/hubspot";
import {
  deleteIntegration,
  getSyncStatus,
  listIntegrations,
  setSyncStatus,
  upsertIntegration,
} from "../services/integration-service";

function assertProvider(value: string): IntegrationProvider {
  if (value !== "hubspot" && value !== "fathom") {
    throw new Error(`Unsupported provider: ${value}`);
  }

  return value;
}

export const integrationRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/integrations",
    {
      preHandler: app.authenticate,
    },
    async (request) => listIntegrations(request.authUser!.id),
  );

  app.get(
    "/api/integrations/:provider/authorize-url",
    {
      preHandler: app.authenticate,
    },
    async (request) => {
      const params = request.params as { provider: string };
      const provider = assertProvider(params.provider);
      const state = crypto.randomBytes(24).toString("hex");

      return {
        url: provider === "hubspot" ? getHubSpotAuthorizeUrl(state) : getFathomAuthorizeUrl(state),
      };
    },
  );

  app.post(
    "/api/integrations/:provider/connect",
    {
      preHandler: app.authenticate,
    },
    async (request) => {
      const params = request.params as { provider: string };
      const body = request.body as { auth_code?: string };
      const provider = assertProvider(params.provider);

      if (!body.auth_code) {
        throw app.httpErrors.badRequest("auth_code is required");
      }

      const tokenResponse =
        provider === "hubspot"
          ? await exchangeHubSpotCode(body.auth_code)
          : await exchangeFathomCode(body.auth_code);

      const integration = await upsertIntegration(request.authUser!.id, provider, {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token ?? null,
      });

      setSyncStatus(request.authUser!.id, provider, "running");
      await enqueueBackfill(provider, request.authUser!.id);

      return integration;
    },
  );

  app.post(
    "/api/integrations/:provider/sync",
    {
      preHandler: app.authenticate,
    },
    async (request) => {
      const params = request.params as { provider: string };
      const provider = assertProvider(params.provider);

      setSyncStatus(request.authUser!.id, provider, "running");
      const jobId = await enqueueBackfill(provider, request.authUser!.id);

      return {
        status: "started",
        job_id: String(jobId),
      };
    },
  );

  app.get(
    "/api/integrations/:provider/sync-status",
    {
      preHandler: app.authenticate,
    },
    async (request) => {
      const params = request.params as { provider: string };
      return getSyncStatus(request.authUser!.id, assertProvider(params.provider));
    },
  );

  app.delete(
    "/api/integrations/:provider",
    {
      preHandler: app.authenticate,
    },
    async (request) => {
      const params = request.params as { provider: string };
      const provider = assertProvider(params.provider);

      await deleteIntegration(request.authUser!.id, provider);
      setSyncStatus(request.authUser!.id, provider, "idle");

      return { ok: true };
    },
  );
};

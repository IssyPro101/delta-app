import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import fastify from "fastify";
import rawBody from "fastify-raw-body";

import { authPlugin } from "./plugins/auth";
import { authRoutes } from "./routes/auth";
import { dealRoutes } from "./routes/deals";
import { eventRoutes } from "./routes/events";
import { insightsRoutes } from "./routes/insights";
import { integrationRoutes } from "./routes/integrations";
import { internalRoutes } from "./routes/internal";
import { pipelineRoutes } from "./routes/pipeline";
import { webhookRoutes } from "./routes/webhooks";
import { env } from "./utils/env";
import { registerWorkers } from "./workers/register-workers";

async function main() {
  const app = fastify({
    logger: true,
  });

  await app.register(sensible);
  await app.register(cors, {
    origin: env.webBaseUrl,
    credentials: true,
  });
  await app.register(rawBody, {
    field: "rawBody",
    global: true,
    encoding: "utf8",
    runFirst: true,
  });
  await app.register(authPlugin);

  await app.register(authRoutes);
  await app.register(pipelineRoutes);
  await app.register(insightsRoutes);
  await app.register(eventRoutes);
  await app.register(dealRoutes);
  await app.register(integrationRoutes);
  await app.register(internalRoutes);
  await app.register(webhookRoutes);

  app.get("/health", async () => ({ ok: true }));

  const workers = registerWorkers();

  const shutdown = async () => {
    await workers.shutdown();
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen({
    host: "0.0.0.0",
    port: env.serverPort,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

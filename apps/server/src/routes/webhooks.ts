import type { FastifyPluginAsync } from "fastify";

import { enqueueFathomWebhook, enqueueHubSpotWebhook } from "../queues";
import { verifyFathomWebhook } from "../integrations/fathom";
import { verifyHubSpotSignature } from "../webhooks/hubspot";

function getRawBody(request: unknown): string {
  return String((request as { rawBody?: string }).rawBody ?? "");
}

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/webhooks/hubspot", async (request, reply) => {
    const rawBody = getRawBody(request);
    const signature = request.headers["x-hubspot-signature-v3"];
    const timestamp = request.headers["x-hubspot-request-timestamp"];
    const protocol = request.headers["x-forwarded-proto"]?.toString() ?? "http";
    const host = request.headers.host ?? "localhost";

    const isValid = verifyHubSpotSignature({
      method: request.method,
      protocol,
      host,
      url: request.raw.url ?? "/api/webhooks/hubspot",
      rawBody,
      signature: Array.isArray(signature) ? signature[0] : signature,
      timestamp: Array.isArray(timestamp) ? timestamp[0] : timestamp,
    });

    if (!isValid) {
      throw app.httpErrors.unauthorized("Invalid HubSpot webhook signature");
    }

    const payload = request.body;
    const events = Array.isArray(payload) ? payload : [payload];
    const jobId = events
      .map((event) => (event as Record<string, unknown>).eventId ?? (event as Record<string, unknown>).objectId)
      .filter(Boolean)
      .join(":");

    await enqueueHubSpotWebhook(payload, jobId || `${Date.now()}`);
    return reply.send({ ok: true });
  });

  app.post("/api/webhooks/fathom", async (request, reply) => {
    const rawBody = getRawBody(request);

    try {
      await verifyFathomWebhook(
        request.headers as Record<string, string | string[] | undefined>,
        rawBody,
      );
    } catch (error) {
      throw app.httpErrors.unauthorized("Invalid Fathom webhook signature", { cause: error });
    }

    const payload = request.body as Record<string, unknown>;
    const jobId = String(
      payload.eventId ?? payload.event_id ?? payload.meetingId ?? payload.meeting_id ?? Date.now(),
    );

    await enqueueFathomWebhook(payload, jobId);
    return reply.send({ ok: true });
  });
};

import type { FastifyPluginAsync } from "fastify";

import { runPipelineAnalyzers } from "../services/insight-service";
import { assertData, supabase } from "../services/supabase-utils";
import { env } from "../utils/env";

export const internalRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/internal/cron/deal-risk", async (request) => {
    const secret = request.headers["x-cron-secret"];
    const providedSecret = Array.isArray(secret) ? secret[0] : secret;

    if (!providedSecret || providedSecret !== env.cronSecret) {
      throw app.httpErrors.unauthorized("Invalid cron secret");
    }

    const rows = assertData(await supabase.from("deals").select("user_id,pipeline_name"));
    const uniqueTargets = [...new Set(rows.map((row) => `${row.user_id}:${row.pipeline_name}`))]
      .map((value) => {
        const [userId, pipelineName] = value.split(":");
        return { userId, pipelineName };
      })
      .filter(
        (target): target is { userId: string; pipelineName: string } =>
          Boolean(target.userId && target.pipelineName),
      );

    for (const target of uniqueTargets) {
      await runPipelineAnalyzers(target.userId, target.pipelineName, "last_90_days", ["deal_risk"]);
    }

    return {
      ok: true,
      processed: uniqueTargets.length,
    };
  });
};

import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

import { env } from "../utils/env";

export function getAgentModel() {
  if (env.aiProvider === "anthropic") {
    if (!env.anthropicApiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY for AI_PROVIDER=anthropic");
    }

    return anthropic(env.anthropicModel);
  }

  if (!env.openAiApiKey) {
    throw new Error("Missing OPENAI_API_KEY for AI_PROVIDER=openai");
  }

  return openai(env.openAiModel);
}

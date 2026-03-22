import type { PipelinePeriod } from "@pipeline-intelligence/shared";
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { z } from "zod";

import {
  createHubSpotEmailForUser,
  createHubSpotNoteForUser,
  createHubSpotTaskForUser,
  fetchHubSpotDealForUser,
} from "./hubspot";
import { getAgentModel } from "./model";
import {
  findDeals,
  getDealContext,
  getPipelineSummary,
  getRecentActivity,
  getWorkspaceSummary,
  listActiveInsights,
} from "./server-client";

function getLatestUserMessageText(messages: Array<{ role: string; parts: Array<{ type?: string; text?: string }> }>) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (!message || message.role !== "user") {
      continue;
    }

    const text = message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join(" ")
      .trim();

    if (text) {
      return text.toLowerCase();
    }
  }

  return "";
}

async function getHubSpotTargetsForDeal(userId: string, dealId: string, accessToken: string) {
  const detail = await getDealContext(accessToken, dealId);
  const remoteDeal = await fetchHubSpotDealForUser(userId, detail.deal.external_id);

  return {
    deal: detail.deal,
    dealExternalId: detail.deal.external_id,
    contactIds: remoteDeal.associations?.contacts?.results.map((result) => result.id) ?? [],
  };
}

export function createSalesAgent(input: {
  userId: string;
  accessToken: string;
  latestUserMessage: string;
}) {
  const { userId, accessToken, latestUserMessage } = input;

  return new ToolLoopAgent<any, any>({
    model: getAgentModel(),
    instructions: [
      "You are Delta, a sales copilot embedded in a pipeline intelligence dashboard.",
      "Ground every answer in available dashboard or CRM data before making recommendations.",
      "Use tools for facts about deals, pipeline, insights, or recent activity instead of guessing.",
      "When drafting follow-up emails, return a polished draft in the response first.",
      "Only mutate HubSpot when the user explicitly asks to log, save, create, or schedule a CRM action in the current turn.",
      "If the requested deal is ambiguous, stop and ask a clarifying question rather than guessing.",
      "Keep answers concise, practical, and specific to the user's pipeline.",
    ].join(" "),
    stopWhen: stepCountIs(8),
    tools: {
      get_workspace_snapshot: tool({
        description: "Get a compact summary of the user's pipeline, highlighted deals, active insights, and recent activity.",
        inputSchema: z.object({}),
        execute: async () => getWorkspaceSummary(accessToken),
      }),
      get_pipeline_summary: tool({
        description: "Get pipeline conversion and cycle metrics for a pipeline and period.",
        inputSchema: z.object({
          pipeline_name: z.string().min(1).optional(),
          period: z
            .enum(["last_30_days", "last_90_days", "last_180_days", "all_time"] satisfies [PipelinePeriod, ...PipelinePeriod[]])
            .optional(),
        }),
        execute: async ({ pipeline_name, period }) =>
          getPipelineSummary(accessToken, {
            ...(pipeline_name ? { pipeline_name } : {}),
            ...(period ? { period } : {}),
          }),
      }),
      list_active_insights: tool({
        description: "List active insights and risks for the user's deals.",
        inputSchema: z.object({
          category: z.enum(["leak", "pattern", "risk"]).optional(),
          stage: z.string().min(1).optional(),
          limit: z.number().int().min(1).max(20).optional(),
        }),
        execute: async ({ category, stage, limit }) =>
          listActiveInsights(accessToken, {
            ...(category ? { category } : {}),
            ...(stage ? { stage } : {}),
            ...(typeof limit === "number" ? { limit } : {}),
          }),
      }),
      find_deals: tool({
        description: "Search deals by name, company, owner, or pipeline.",
        inputSchema: z.object({
          query: z.string().min(1).optional(),
          stage: z.string().min(1).optional(),
          outcome: z.enum(["open", "won", "lost"]).optional(),
          limit: z.number().int().min(1).max(25).optional(),
        }),
        execute: async ({ query, stage, outcome, limit }) =>
          findDeals(accessToken, {
            ...(query ? { query } : {}),
            ...(stage ? { stage } : {}),
            ...(outcome ? { outcome } : {}),
            ...(typeof limit === "number" ? { limit } : {}),
          }),
      }),
      get_deal_context: tool({
        description: "Get full context for a specific deal, including transitions, related insights, and recent activity.",
        inputSchema: z.object({
          deal_id: z.string().uuid(),
        }),
        execute: async ({ deal_id }) => getDealContext(accessToken, deal_id),
      }),
      get_recent_activity: tool({
        description: "Get recent activity across the workspace or for a specific deal/stage.",
        inputSchema: z.object({
          deal_id: z.string().uuid().optional(),
          stage: z.string().min(1).optional(),
          limit: z.number().int().min(1).max(20).optional(),
        }),
        execute: async ({ deal_id, stage, limit }) =>
          getRecentActivity(accessToken, {
            ...(deal_id ? { deal_id } : {}),
            ...(stage ? { stage } : {}),
            ...(typeof limit === "number" ? { limit } : {}),
          }),
      }),
      log_hubspot_note: tool({
        description: "Create a HubSpot note for a specific deal after the user explicitly asks to save or log it.",
        inputSchema: z.object({
          deal_id: z.string().uuid(),
          note: z.string().min(1),
        }),
        execute: async ({ deal_id, note }) => {
          const targets = await getHubSpotTargetsForDeal(userId, deal_id, accessToken);

          return createHubSpotNoteForUser(userId, {
            body: note,
            dealExternalId: targets.dealExternalId,
            contactIds: targets.contactIds,
          });
        },
      }),
      create_hubspot_task: tool({
        description: "Create a follow-up task in HubSpot for a specific deal after explicit user confirmation.",
        inputSchema: z.object({
          deal_id: z.string().uuid(),
          subject: z.string().min(1),
          body: z.string().optional(),
          due_at: z.string().datetime(),
          priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
          task_type: z.enum(["EMAIL", "CALL", "TODO"]).optional(),
        }),
        execute: async ({ deal_id, subject, body, due_at, priority, task_type }) => {
          const targets = await getHubSpotTargetsForDeal(userId, deal_id, accessToken);

          return createHubSpotTaskForUser(userId, {
            subject,
            ...(body ? { body } : {}),
            dueAt: due_at,
            ...(priority ? { priority } : {}),
            ...(task_type ? { taskType: task_type } : {}),
            dealExternalId: targets.dealExternalId,
            contactIds: targets.contactIds,
          });
        },
      }),
      log_hubspot_email: tool({
        description: "Log a drafted follow-up email to HubSpot after the user explicitly asks to save it to the CRM.",
        inputSchema: z.object({
          deal_id: z.string().uuid(),
          subject: z.string().min(1),
          text: z.string().min(1),
          html: z.string().optional(),
        }),
        execute: async ({ deal_id, subject, text, html }) => {
          const targets = await getHubSpotTargetsForDeal(userId, deal_id, accessToken);

          return createHubSpotEmailForUser(userId, {
            subject,
            text,
            ...(html ? { html } : {}),
            dealExternalId: targets.dealExternalId,
            contactIds: targets.contactIds,
          });
        },
      }),
    },
  });
}

export function getLatestUserIntentText(messages: Array<{ role: string; parts: Array<{ type?: string; text?: string }> }>) {
  return getLatestUserMessageText(messages);
}

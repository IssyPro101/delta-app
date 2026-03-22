import { Worker } from "bullmq";

import { runPipelineAnalyzers } from "../services/insight-service";
import {
  getAnyConnectedIntegration,
  getIntegration,
  readAccessToken,
  readRefreshToken,
  setSyncStatus,
  touchIntegrationSync,
  updateIntegrationStatus,
  upsertIntegration,
} from "../services/integration-service";
import type {
  DealRecord,
  EventRecord,
  IntegrationRecord,
  StageTransitionRecord,
} from "../services/domain-types";
import {
  assertData,
  assertMaybeData,
  assertNoError,
  supabase,
  toDealRecord,
  toJson,
  toStageTransitionRecord,
} from "../services/supabase-utils";
import { connection, type BackfillJobData, type WebhookJobData } from "../queues";
import { env } from "../utils/env";
import {
  createHubSpotAuth,
  fetchHubSpotActivity,
  fetchHubSpotContact,
  fetchHubSpotDeal,
  listHubSpotDeals,
  type HubSpotAuth,
  type HubSpotActivityObjectType,
  type HubSpotActivityResponse,
  type HubSpotDealResponse,
} from "../integrations/hubspot";
import { getFathomTranscript, listFathomMeetings } from "../integrations/fathom";

function hubspotAuthFor(integration: IntegrationRecord): HubSpotAuth {
  return createHubSpotAuth(
    readAccessToken(integration),
    readRefreshToken(integration),
    async (tokens) => {
      await upsertIntegration(integration.user_id, "hubspot", {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
      });
    },
  );
}

function deriveOutcome(stage: string, explicitlyWon?: string | null, explicitlyClosed?: string | null) {
  const normalized = stage.toLowerCase();

  if (explicitlyWon === "true" || normalized.includes("won")) {
    return "won" as const;
  }

  if (explicitlyClosed === "true" || normalized.includes("lost")) {
    return "lost" as const;
  }

  return "open" as const;
}

function centsFromAmount(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function buildStageHistory(rawDeal: HubSpotDealResponse) {
  const history = rawDeal.propertiesWithHistory?.dealstage ?? [];

  return [...history]
    .filter((item) => item.value)
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
    .map((item) => ({
      stage: item.value!,
      timestamp: new Date(item.timestamp),
    }));
}

function buildAmountHistory(rawDeal: HubSpotDealResponse) {
  const history = rawDeal.propertiesWithHistory?.amount ?? [];

  return [...history]
    .filter((item) => item.value && Number.isFinite(Number(item.value)))
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
    .map((item) => ({
      amount: centsFromAmount(item.value),
      timestamp: new Date(item.timestamp),
    }));
}

function uniqueIds(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function toActivitySnippet(value: string | null | undefined, limit = 160) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function parseHubSpotTimestamp(value: string | null | undefined, fallback: Date) {
  if (!value) {
    return fallback;
  }

  const numeric = Number(value);
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function getAssociatedIds(
  associations: HubSpotDealResponse["associations"] | HubSpotActivityResponse["associations"] | undefined,
  associationType: string,
) {
  return associations?.[associationType]?.results.map((result) => result.id) ?? [];
}

function normalizeEmails(emails: string[]) {
  return emails
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

function getMeetingStartTime(meeting: {
  recording_start_time?: string;
  startTime?: string;
}) {
  return meeting.recording_start_time ?? meeting.startTime ?? new Date().toISOString();
}

function getMeetingEndTime(meeting: {
  recording_end_time?: string;
  endTime?: string;
}) {
  return meeting.recording_end_time ?? meeting.endTime ?? null;
}

function buildKeyTopics(text: string | undefined) {
  if (!text) {
    return [];
  }

  const stopWords = new Set([
    "about",
    "after",
    "also",
    "been",
    "from",
    "have",
    "into",
    "that",
    "their",
    "there",
    "they",
    "this",
    "with",
    "would",
  ]);

  const counts = new Map<string, number>();

  for (const token of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (token.length < 5 || stopWords.has(token)) {
      continue;
    }

    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([token]) => token);
}

async function getDealByExternalId(userId: string, externalId: string) {
  const row = assertMaybeData(
    await supabase.from("deals").select("*").eq("user_id", userId).eq("external_id", externalId).maybeSingle(),
  );

  return row ? toDealRecord(row) : null;
}

async function listDealsForUser(userId: string) {
  const rows = assertData(
    await supabase.from("deals").select("*").eq("user_id", userId).order("last_activity", { ascending: false }),
  );

  return rows.map(toDealRecord);
}

async function buildDealEmailLookup(userId: string, integration: IntegrationRecord | null) {
  const lookup = new Map<string, DealRecord>();

  if (!integration) {
    return lookup;
  }

  const auth = hubspotAuthFor(integration);
  const deals = await listDealsForUser(userId);

  for (const deal of deals) {
    const rawDeal = await fetchHubSpotDeal(auth, deal.external_id);
    const contactIds = rawDeal.associations?.contacts?.results.map((result) => result.id) ?? [];

    for (const contactId of contactIds) {
      const contact = await fetchHubSpotContact(auth, contactId);
      const email = contact.properties.email?.trim().toLowerCase();

      if (email && !lookup.has(email)) {
        lookup.set(email, deal);
      }
    }
  }

  return lookup;
}

function matchDealByParticipantEmails(emailLookup: Map<string, DealRecord>, participants: string[]) {
  for (const email of normalizeEmails(participants)) {
    const deal = emailLookup.get(email);

    if (deal) {
      return deal;
    }
  }

  return null;
}

async function getDealForHubSpotContact(userId: string, auth: HubSpotAuth, contactId: string) {
  const contact = await fetchHubSpotContact(auth, contactId);
  const associatedDealIds = contact.associations?.deals?.results.map((result) => result.id) ?? [];

  if (associatedDealIds.length === 0) {
    return null;
  }

  const rows = assertData(
    await supabase.from("deals").select("*").eq("user_id", userId).in("external_id", associatedDealIds),
  );
  const deals = rows.map(toDealRecord).sort((left, right) => right.last_activity.getTime() - left.last_activity.getTime());

  return deals[0] ?? null;
}

async function hasHubSpotActivityEvent(userId: string, activityKey: string) {
  const rows = assertData(
    await supabase
      .from("events")
      .select("id")
      .eq("user_id", userId)
      .eq("source", "hubspot")
      .contains("metadata", { hubspot_activity_id: activityKey })
      .limit(1),
  );

  return rows.length > 0;
}

function formatHubSpotActivity(activityType: HubSpotActivityObjectType, activity: HubSpotActivityResponse) {
  const properties = activity.properties;

  switch (activityType) {
    case "emails": {
      const subject = properties.hs_email_subject ?? "Email";
      const preview = toActivitySnippet(properties.hs_email_text);

      return {
        occurredAt: parseHubSpotTimestamp(properties.hs_timestamp, new Date()),
        title: `HubSpot Email — ${subject}`,
        summary: preview ?? "Email activity was logged in HubSpot.",
        metadata: {
          activity_type: "email",
          subject,
          body_preview: preview,
          status: properties.hs_email_status ?? null,
          direction: properties.hs_email_direction ?? null,
        },
      };
    }
    case "notes": {
      const preview = toActivitySnippet(properties.hs_note_body);

      return {
        occurredAt: parseHubSpotTimestamp(properties.hs_timestamp, new Date()),
        title: "HubSpot Note",
        summary: preview ?? "Note activity was logged in HubSpot.",
        metadata: {
          activity_type: "note",
          body_preview: preview,
        },
      };
    }
    case "calls": {
      const title = properties.hs_call_title ?? "Call";
      const preview = toActivitySnippet(properties.hs_call_body);

      return {
        occurredAt: parseHubSpotTimestamp(properties.hs_timestamp, new Date()),
        title: `HubSpot Call — ${title}`,
        summary: preview ?? "Call activity was logged in HubSpot.",
        metadata: {
          activity_type: "call",
          subject: title,
          body_preview: preview,
          status: properties.hs_call_status ?? null,
          direction: properties.hs_call_direction ?? null,
        },
      };
    }
    case "tasks": {
      const subject = properties.hs_task_subject ?? properties.hs_task_type ?? "Task";
      const preview = toActivitySnippet(properties.hs_task_body);

      return {
        occurredAt: parseHubSpotTimestamp(properties.hs_timestamp, new Date()),
        title: `HubSpot Task — ${subject}`,
        summary: preview ?? "Task activity was logged in HubSpot.",
        metadata: {
          activity_type: "task",
          subject,
          body_preview: preview,
          status: properties.hs_task_status ?? null,
          priority: properties.hs_task_priority ?? null,
          task_type: properties.hs_task_type ?? null,
        },
      };
    }
  }
}

async function syncHubSpotDealActivities(
  userId: string,
  auth: HubSpotAuth,
  deal: DealRecord,
  rawDeal: HubSpotDealResponse,
) {
  const activityTypes: HubSpotActivityObjectType[] = ["emails", "notes", "calls", "tasks"];
  let importedCount = 0;

  for (const activityType of activityTypes) {
    const activityIds = uniqueIds(getAssociatedIds(rawDeal.associations, activityType));

    for (const activityId of activityIds) {
      const activityKey = `${activityType}:${activityId}`;

      if (await hasHubSpotActivityEvent(userId, activityKey)) {
        continue;
      }

      const activity = await fetchHubSpotActivity(auth, activityType, activityId);
      const relatedDealIds = uniqueIds([
        ...getAssociatedIds(activity.associations, "deals"),
        ...getAssociatedIds(rawDeal.associations, "deals"),
        rawDeal.id,
      ]);

      if (!relatedDealIds.includes(deal.external_id)) {
        continue;
      }

      const formatted = formatHubSpotActivity(activityType, activity);
      const relatedContactIds = uniqueIds([
        ...getAssociatedIds(activity.associations, "contacts"),
        ...getAssociatedIds(rawDeal.associations, "contacts"),
      ]);

      await createEvent(userId, "hubspot", deal, {
        eventType: "contact_activity",
        title: formatted.title,
        summary: formatted.summary,
        occurredAt: formatted.occurredAt,
        metadata: {
          ...formatted.metadata,
          hubspot_activity_id: activityKey,
          hubspot_activity_object_id: activity.id,
          hubspot_activity_object_type: activityType,
          related_contact_ids: relatedContactIds,
          contact_email: null,
          contact_name: null,
        },
        rawPayload: activity as unknown as Record<string, unknown>,
      });
      importedCount += 1;
    }
  }

  return importedCount;
}

async function createEvent(
  userId: string,
  source: EventRecord["source"],
  deal: DealRecord | null,
  input: {
    eventType: EventRecord["event_type"];
    title: string;
    summary: string;
    occurredAt: Date;
    metadata: Record<string, unknown>;
    rawPayload: Record<string, unknown>;
  },
) {
  assertNoError(
    await supabase.from("events").insert({
      user_id: userId,
      deal_id: deal?.id ?? null,
      source,
      event_type: input.eventType,
      title: input.title,
      summary: input.summary,
      occurred_at: input.occurredAt.toISOString(),
      metadata: toJson(input.metadata),
      raw_payload: toJson(input.rawPayload),
    }),
  );

  if (deal) {
    assertNoError(
      await supabase
        .from("deals")
        .update({ last_activity: input.occurredAt.toISOString() })
        .eq("id", deal.id)
        .lt("last_activity", input.occurredAt.toISOString()),
    );
  }
}

async function replaceHubSpotBackfillData(userId: string) {
  assertNoError(await supabase.from("events").delete().eq("user_id", userId).eq("source", "hubspot"));
  assertNoError(await supabase.from("stage_transitions").delete().eq("user_id", userId));
}

async function replaceFathomBackfillData(userId: string) {
  assertNoError(await supabase.from("events").delete().eq("user_id", userId).eq("source", "fathom"));
}

async function runAnalyzersForPipelines(
  userId: string,
  pipelineNames: Iterable<string>,
  analyzers?: string[],
) {
  for (const pipelineName of [...new Set([...pipelineNames].filter(Boolean))]) {
    await runPipelineAnalyzers(userId, pipelineName, "last_90_days", analyzers);
  }
}

async function runAnalyzersForAllPipelines(userId: string, analyzers?: string[]) {
  const rows = assertData(await supabase.from("deals").select("pipeline_name").eq("user_id", userId));
  await runAnalyzersForPipelines(
    userId,
    rows.map((row) => row.pipeline_name),
    analyzers,
  );
}

async function upsertDealSnapshot(userId: string, rawDeal: HubSpotDealResponse) {
  const properties = rawDeal.properties;
  const stage = properties.dealstage ?? "Unknown";
  const closedAt = properties.closedate ? new Date(properties.closedate) : null;
  const createdAt = properties.createdate ? new Date(properties.createdate) : new Date();
  const outcome = deriveOutcome(stage, properties.hs_is_closed_won, properties.hs_is_closed);
  const companyName =
    properties.company_name ?? properties.dealname?.split("—")[0]?.trim() ?? properties.dealname ?? "Unknown";

  const row = assertData(
    await supabase
      .from("deals")
      .upsert(
        {
          user_id: userId,
          external_id: rawDeal.id,
          name: properties.dealname ?? `${companyName} Opportunity`,
          stage,
          outcome,
          amount: centsFromAmount(properties.amount),
          close_date: closedAt?.toISOString().slice(0, 10) ?? null,
          closed_at: outcome === "open" ? null : closedAt?.toISOString() ?? null,
          company_name: companyName,
          owner_name: properties.hubspot_owner_id ?? null,
          pipeline_name: properties.pipeline ?? "Default",
          last_activity: new Date().toISOString(),
          created_at: createdAt.toISOString(),
        },
        { onConflict: "user_id,external_id" },
      )
      .select("*")
      .single(),
  );

  const deal = toDealRecord(row);
  const transitionRows = assertData(
    await supabase
      .from("stage_transitions")
      .select("*")
      .eq("deal_id", deal.id)
      .order("transitioned_at", { ascending: true }),
  );
  const existingTransitions = transitionRows.map(toStageTransitionRecord);

  if (existingTransitions.length === 0) {
    let previousStage: string | null = null;
    let previousAt: Date | null = null;

    for (const entry of buildStageHistory(rawDeal)) {
      assertNoError(
        await supabase.from("stage_transitions").insert({
          user_id: userId,
          deal_id: deal.id,
          from_stage: previousStage,
          to_stage: entry.stage,
          transitioned_at: entry.timestamp.toISOString(),
          time_in_stage_hours:
            previousAt && previousStage ? (entry.timestamp.getTime() - previousAt.getTime()) / 3_600_000 : null,
          created_at: new Date().toISOString(),
        }),
      );

      previousStage = entry.stage;
      previousAt = entry.timestamp;
    }
  }

  return deal;
}

async function createHubSpotHistoricalEvents(userId: string, deal: DealRecord, rawDeal: HubSpotDealResponse) {
  await createEvent(userId, "hubspot", deal, {
    eventType: "deal_created",
    title: `New Deal — ${deal.company_name}`,
    summary: `${deal.name} was imported from HubSpot.`,
    occurredAt: deal.created_at,
    metadata: {
      stage: deal.stage,
      amount: deal.amount,
      pipeline: deal.pipeline_name,
    },
    rawPayload: rawDeal as unknown as Record<string, unknown>,
  });

  const stageHistory = buildStageHistory(rawDeal);

  for (let index = 1; index < stageHistory.length; index += 1) {
    const previous = stageHistory[index - 1];
    const current = stageHistory[index];

    if (!previous || !current) {
      continue;
    }

    await createEvent(userId, "hubspot", deal, {
      eventType: "deal_stage_change",
      title: `Deal Stage Change — ${deal.company_name}`,
      summary: `Moved from ${previous.stage} to ${current.stage}.`,
      occurredAt: current.timestamp,
      metadata: {
        previous_stage: previous.stage,
        new_stage: current.stage,
        changed_by: "HubSpot history import",
      },
      rawPayload: rawDeal as unknown as Record<string, unknown>,
    });
  }

  const amountHistory = buildAmountHistory(rawDeal);

  for (let index = 1; index < amountHistory.length; index += 1) {
    const previous = amountHistory[index - 1];
    const current = amountHistory[index];

    if (!previous || !current || previous.amount === current.amount) {
      continue;
    }

    await createEvent(userId, "hubspot", deal, {
      eventType: "deal_amount_change",
      title: `Deal Amount Change — ${deal.company_name}`,
      summary: `Amount changed from ${previous.amount ?? 0} to ${current.amount ?? 0}.`,
      occurredAt: current.timestamp,
      metadata: {
        previous_amount: previous.amount,
        new_amount: current.amount,
      },
      rawPayload: rawDeal as unknown as Record<string, unknown>,
    });
  }

  if (deal.outcome !== "open") {
    await createEvent(userId, "hubspot", deal, {
      eventType: "deal_closed",
      title: `Deal Closed — ${deal.company_name}`,
      summary: `Closed ${deal.outcome} after pipeline progression.`,
      occurredAt: deal.closed_at ?? stageHistory.at(-1)?.timestamp ?? deal.created_at,
      metadata: {
        outcome: deal.outcome,
        final_stage: deal.stage,
        total_days_in_pipeline: Math.round(
          ((deal.closed_at ?? deal.created_at).getTime() - deal.created_at.getTime()) / 86_400_000,
        ),
      },
      rawPayload: rawDeal as unknown as Record<string, unknown>,
    });
  }
}

async function processHubSpotWebhookEvent(payload: Record<string, unknown>, integration: IntegrationRecord) {
  const userId = integration.user_id;
  const objectId = String(payload.objectId ?? payload.object_id ?? "");
  const subscriptionType = String(payload.subscriptionType ?? payload.subscription_type ?? "");
  const propertyName = String(payload.propertyName ?? payload.property_name ?? "");
  const occurredAt = new Date(String(payload.occurredAt ?? payload.occurred_at ?? Date.now()));

  if (!objectId) {
    return;
  }

  if (subscriptionType.startsWith("contact.")) {
    const auth = hubspotAuthFor(integration);
    const contact = await fetchHubSpotContact(auth, objectId);
    const deal = await getDealForHubSpotContact(userId, auth, objectId);

    await createEvent(userId, "hubspot", deal, {
      eventType: "contact_activity",
      title: `Contact Activity — ${contact.properties.firstname ?? contact.properties.email ?? "Contact"}`,
      summary: `${propertyName || "Contact"} activity was captured in HubSpot.`,
      occurredAt,
      metadata: {
        activity_type: propertyName || "contact_activity",
        contact_email: contact.properties.email ?? null,
        contact_name: [contact.properties.firstname, contact.properties.lastname].filter(Boolean).join(" ") || null,
      },
      rawPayload: payload,
    });

    await touchIntegrationSync(userId, "hubspot");

    if (deal) {
      await runPipelineAnalyzers(userId, deal.pipeline_name, "last_90_days", ["deal_risk", "activity_pattern"]);
    }

    return;
  }

  const auth = hubspotAuthFor(integration);
  const rawDeal = await fetchHubSpotDeal(auth, objectId);
  const previousDeal = await getDealByExternalId(userId, objectId);
  const deal = await upsertDealSnapshot(userId, rawDeal);

  if (!previousDeal) {
    await createEvent(userId, "hubspot", deal, {
      eventType: "deal_created",
      title: `New Deal — ${deal.company_name}`,
      summary: `${deal.name} was created in ${deal.pipeline_name}.`,
      occurredAt,
      metadata: {
        stage: deal.stage,
        amount: deal.amount,
        pipeline: deal.pipeline_name,
      },
      rawPayload: payload,
    });
  }

  if (propertyName === "dealstage" && previousDeal?.stage !== deal.stage) {
    const latestTransitionRow = assertMaybeData(
      await supabase
        .from("stage_transitions")
        .select("*")
        .eq("deal_id", deal.id)
        .order("transitioned_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    const latestTransition = latestTransitionRow ? toStageTransitionRecord(latestTransitionRow) : null;

    assertNoError(
      await supabase.from("stage_transitions").insert({
        user_id: userId,
        deal_id: deal.id,
        from_stage: previousDeal?.stage ?? latestTransition?.to_stage ?? null,
        to_stage: deal.stage,
        transitioned_at: occurredAt.toISOString(),
        time_in_stage_hours: latestTransition
          ? (occurredAt.getTime() - latestTransition.transitioned_at.getTime()) / 3_600_000
          : null,
      }),
    );

    await createEvent(userId, "hubspot", deal, {
      eventType: "deal_stage_change",
      title: `Deal Stage Change — ${deal.company_name}`,
      summary: `Moved from ${previousDeal?.stage ?? "Unknown"} to ${deal.stage}.`,
      occurredAt,
      metadata: {
        previous_stage: previousDeal?.stage ?? null,
        new_stage: deal.stage,
        changed_by: String(payload.changeSource ?? payload.changedBy ?? "HubSpot"),
      },
      rawPayload: payload,
    });

    await runPipelineAnalyzers(userId, deal.pipeline_name, "last_90_days", ["stage_leak", "deal_risk"]);
  }

  if (propertyName === "amount" && previousDeal?.amount !== deal.amount) {
    await createEvent(userId, "hubspot", deal, {
      eventType: "deal_amount_change",
      title: `Deal Amount Change — ${deal.company_name}`,
      summary: `Amount changed from ${previousDeal?.amount ?? 0} to ${deal.amount ?? 0}.`,
      occurredAt,
      metadata: {
        previous_amount: previousDeal?.amount ?? null,
        new_amount: deal.amount,
      },
      rawPayload: payload,
    });
  }

  if (deal.outcome !== "open" && previousDeal?.outcome !== deal.outcome) {
    await createEvent(userId, "hubspot", deal, {
      eventType: "deal_closed",
      title: `Deal Closed — ${deal.company_name}`,
      summary: `Closed ${deal.outcome} after pipeline progression.`,
      occurredAt,
      metadata: {
        outcome: deal.outcome,
        final_stage: deal.stage,
        total_days_in_pipeline: Math.round(
          ((deal.closed_at ?? occurredAt).getTime() - deal.created_at.getTime()) / 86_400_000,
        ),
      },
      rawPayload: payload,
    });

    await runPipelineAnalyzers(userId, deal.pipeline_name);
  }

  await touchIntegrationSync(userId, "hubspot");
}

async function runHubSpotBackfill(integration: IntegrationRecord) {
  const auth = hubspotAuthFor(integration);
  let after: string | undefined;
  const pipelines = new Set<string>();

  await replaceHubSpotBackfillData(integration.user_id);

  do {
    const page = await listHubSpotDeals(auth, after);

    for (const rawDeal of page.results) {
      const deal = await upsertDealSnapshot(integration.user_id, rawDeal);
      pipelines.add(deal.pipeline_name);
      await createHubSpotHistoricalEvents(integration.user_id, deal, rawDeal);
    }

    after = page.paging?.next?.after;
  } while (after);

  await touchIntegrationSync(integration.user_id, "hubspot");

  await runAnalyzersForPipelines(integration.user_id, pipelines);
}

async function processFathomWebhookPayload(payload: Record<string, unknown>, integration: IntegrationRecord) {
  const accessToken = readAccessToken(integration);
  const meetingId = String(payload.meetingId ?? payload.meeting_id ?? payload.recordingId ?? payload.recording_id ?? "");
  const page = await listFathomMeetings(accessToken);
  const meeting = page.items.find((item) => item.id === meetingId) ?? null;

  if (!meeting) {
    return;
  }

  const transcript =
    meeting.transcript ||
    !meeting.recording_id
      ? { transcript: meeting.transcript }
      : await getFathomTranscript(accessToken, meeting.recording_id).catch(() => ({ transcript: undefined }));
  const participants = (meeting.calendar_invitees ?? [])
    .map((invitee) => invitee.email)
    .filter((email): email is string => Boolean(email));
  const hubspotIntegration = await getIntegration(integration.user_id, "hubspot");
  const emailLookup = await buildDealEmailLookup(integration.user_id, hubspotIntegration);
  const deal = matchDealByParticipantEmails(emailLookup, participants);
  const startTime = getMeetingStartTime(meeting);
  const endTime = getMeetingEndTime(meeting);
  const summary = meeting.summary ?? transcript.transcript?.slice(0, 180) ?? "Meeting captured by Fathom.";

  await createEvent(integration.user_id, "fathom", deal, {
    eventType: "meeting",
    title: `Fathom Meeting — ${deal?.company_name ?? meeting.title ?? "Meeting"}`,
    summary,
    occurredAt: new Date(startTime),
    metadata: {
      duration_minutes:
        endTime && startTime
          ? Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60_000)
          : 0,
      participants,
      recording_url: meeting.url ?? null,
      transcript_url: meeting.url ?? null,
      fathom_summary: meeting.summary ?? transcript.transcript?.slice(0, 280) ?? "Meeting captured by Fathom.",
      key_topics: buildKeyTopics(`${meeting.summary ?? ""} ${transcript.transcript ?? ""}`),
    },
    rawPayload: meeting as unknown as Record<string, unknown>,
  });

  await touchIntegrationSync(integration.user_id, "fathom");

  if (deal) {
    await runPipelineAnalyzers(integration.user_id, deal.pipeline_name, "last_90_days", ["deal_risk", "activity_pattern"]);
  }
}

async function runFathomBackfill(integration: IntegrationRecord) {
  const accessToken = readAccessToken(integration);
  let cursor: string | undefined;
  const hubspotIntegration = await getIntegration(integration.user_id, "hubspot");
  const emailLookup = await buildDealEmailLookup(integration.user_id, hubspotIntegration);

  await replaceFathomBackfillData(integration.user_id);

  do {
    const page = await listFathomMeetings(accessToken, cursor);

    for (const meeting of page.items) {
      const transcript =
        meeting.transcript ||
        !meeting.recording_id
          ? { transcript: meeting.transcript }
          : await getFathomTranscript(accessToken, meeting.recording_id).catch(() => ({ transcript: undefined }));
      const participants = (meeting.calendar_invitees ?? [])
        .map((invitee) => invitee.email)
        .filter((email): email is string => Boolean(email));
      const deal = matchDealByParticipantEmails(emailLookup, participants);
      const startTime = getMeetingStartTime(meeting);
      const endTime = getMeetingEndTime(meeting);

      await createEvent(integration.user_id, "fathom", deal, {
        eventType: "meeting",
        title: `Fathom Meeting — ${deal?.company_name ?? meeting.title ?? "Meeting"}`,
        summary: meeting.summary ?? transcript.transcript?.slice(0, 180) ?? "Meeting imported from Fathom.",
        occurredAt: new Date(startTime),
        metadata: {
          duration_minutes:
            endTime && startTime
              ? Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60_000)
              : 0,
          participants,
          recording_url: meeting.url ?? null,
          transcript_url: meeting.url ?? null,
          fathom_summary: meeting.summary ?? transcript.transcript?.slice(0, 280) ?? "Meeting imported from Fathom.",
          key_topics: buildKeyTopics(`${meeting.summary ?? ""} ${transcript.transcript ?? ""}`),
        },
        rawPayload: meeting as unknown as Record<string, unknown>,
      });
    }

    cursor = page.next_cursor ?? undefined;
  } while (cursor);

  await touchIntegrationSync(integration.user_id, "fathom");
  await runAnalyzersForAllPipelines(integration.user_id);
}

export function registerWorkers() {
  const hubspotWorker = new Worker<WebhookJobData>(
    "webhook.hubspot",
    async (job) => {
      const integration = await getAnyConnectedIntegration("hubspot");

      if (!integration) {
        return;
      }

      const events = Array.isArray(job.data.payload) ? job.data.payload : [job.data.payload];

      for (const event of events) {
        await processHubSpotWebhookEvent(event as Record<string, unknown>, integration);
      }
    },
    { connection },
  );

  const fathomWorker = new Worker<WebhookJobData>(
    "webhook.fathom",
    async (job) => {
      const integration = await getAnyConnectedIntegration("fathom");

      if (!integration) {
        return;
      }

      await processFathomWebhookPayload(job.data.payload as Record<string, unknown>, integration);
    },
    { connection },
  );

  const backfillWorker = new Worker<BackfillJobData>(
    "backfill",
    async (job) => {
      const integration = await getIntegration(job.data.userId, job.data.provider);

      if (!integration) {
        throw new Error(`No integration found for ${job.data.provider}`);
      }

      setSyncStatus(job.data.userId, job.data.provider, "running");

      try {
        if (job.data.provider === "hubspot") {
          await runHubSpotBackfill(integration);
        } else {
          console.log("Running Fathom backfill");
          await runFathomBackfill(integration);
        }

        await updateIntegrationStatus(job.data.userId, job.data.provider, "connected");
        setSyncStatus(job.data.userId, job.data.provider, "idle");
      } catch (error) {
        await updateIntegrationStatus(job.data.userId, job.data.provider, "error");
        setSyncStatus(job.data.userId, job.data.provider, "error");
        throw error;
      }
    },
    { connection },
  );

  for (const worker of [hubspotWorker, fathomWorker, backfillWorker]) {
    worker.on("failed", (job, error) => {
      console.error(`[worker:${job?.queueName ?? "unknown"}]`, error);
    });
  }

  return {
    hubspotWorker,
    fathomWorker,
    backfillWorker,
    shutdown: async () => {
      await Promise.all([hubspotWorker.close(), fathomWorker.close(), backfillWorker.close()]);
    },
  };
}

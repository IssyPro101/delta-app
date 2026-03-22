import fp from "fastify-plugin";

import { assertData, assertMaybeData, supabase, toUserRecord } from "../services/supabase-utils";

function readBearerToken(authorization?: string) {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function toDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const fullName = user.user_metadata?.full_name;
  const name = user.user_metadata?.name;

  if (typeof fullName === "string" && fullName.trim().length > 0) {
    return fullName;
  }

  if (typeof name === "string" && name.trim().length > 0) {
    return name;
  }

  return user.email ?? "Unknown user";
}

function toAvatarUrl(user: { user_metadata?: Record<string, unknown> }) {
  const avatarUrl = user.user_metadata?.avatar_url;
  const picture = user.user_metadata?.picture;

  if (typeof avatarUrl === "string" && avatarUrl.length > 0) {
    return avatarUrl;
  }

  if (typeof picture === "string" && picture.length > 0) {
    return picture;
  }

  return null;
}

async function resolveAppUser(accessToken: string) {
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user || !data.user.email) {
    throw error ?? new Error("Authenticated user is missing an email");
  }

  const existingUser = assertMaybeData(
    await supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", data.user.id)
      .maybeSingle(),
  );

  const payload = {
    auth_user_id: data.user.id,
    email: data.user.email,
    name: toDisplayName(data.user),
    avatar_url: toAvatarUrl(data.user),
  };

  const user =
    existingUser === null
      ? assertData(
          await supabase
            .from("users")
            .upsert(payload, { onConflict: "email" })
            .select("*")
            .single(),
        )
      : assertData(
          await supabase
            .from("users")
            .update(payload)
            .eq("id", existingUser.id)
            .select("*")
            .single(),
        );

  const userRecord = toUserRecord(user);

  return {
    id: userRecord.id,
    email: userRecord.email,
    name: userRecord.name,
    avatar_url: userRecord.avatar_url,
    created_at: userRecord.created_at.toISOString(),
  };
}

export const authPlugin = fp(async (app) => {
  app.decorateRequest("authUser", null);
  app.decorateRequest("accessToken", null);
  app.decorate("authenticate", async (request) => {
    const accessToken = readBearerToken(request.headers.authorization);

    if (!accessToken) {
      throw app.httpErrors.unauthorized("Missing bearer token");
    }

    try {
      request.authUser = await resolveAppUser(accessToken);
      request.accessToken = accessToken;
    } catch (error) {
      throw app.httpErrors.unauthorized("Authentication required", { cause: error });
    }
  });
});

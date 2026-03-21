import crypto from "node:crypto";

import type { FastifyPluginAsync } from "fastify";

import { env } from "../utils/env";
import { serializeUser } from "../services/serializers";
import { assertData, supabase, toUserRecord } from "../services/supabase-utils";

const googleStateCookie = "pipeline_google_oauth_state";

function getGoogleScopes(): string {
  return ["openid", "email", "profile"].join(" ");
}

function getGoogleAuthorizationUrl(state: string): string {
  const searchParams = new URLSearchParams({
    client_id: env.googleClientId ?? "",
    redirect_uri: env.googleRedirectUri ?? "",
    response_type: "code",
    scope: getGoogleScopes(),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${searchParams.toString()}`;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get("/auth/google/start", async (_request, reply) => {
    if (!env.googleClientId || !env.googleRedirectUri) {
      throw app.httpErrors.serviceUnavailable("Google OAuth is not configured");
    }

    const state = crypto.randomBytes(24).toString("hex");

    reply.setCookie(googleStateCookie, state, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 10,
    });

    return reply.redirect(getGoogleAuthorizationUrl(state));
  });

  app.get("/auth/google/callback", async (request, reply) => {
    if (!env.googleClientId || !env.googleClientSecret || !env.googleRedirectUri) {
      throw app.httpErrors.serviceUnavailable("Google OAuth is not configured");
    }

    const query = request.query as { code?: string; state?: string; error?: string };

    if (query.error) {
      return reply.redirect(`${env.webBaseUrl}/auth/signin?error=${encodeURIComponent(query.error)}`);
    }

    if (!query.code || !query.state) {
      throw app.httpErrors.badRequest("Missing OAuth code or state");
    }

    const expectedState = request.cookies[googleStateCookie];

    if (!expectedState || expectedState !== query.state) {
      throw app.httpErrors.unauthorized("Invalid OAuth state");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: query.code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: env.googleRedirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      throw app.httpErrors.badGateway("Google token exchange failed");
    }

    const token = (await tokenResponse.json()) as { access_token: string };
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      throw app.httpErrors.badGateway("Google profile fetch failed");
    }

    const profile = (await profileResponse.json()) as {
      email: string;
      name?: string;
      picture?: string;
    };

    if (!profile.email) {
      throw app.httpErrors.badGateway("Google profile is missing an email");
    }

    const user = assertData(
      await supabase
        .from("users")
        .upsert(
          {
            email: profile.email,
            name: profile.name ?? profile.email,
            avatar_url: profile.picture ?? null,
          },
          { onConflict: "email" },
        )
        .select("*")
        .single(),
    );

    const serializedUser = serializeUser(
      toUserRecord(user),
    );
    const sessionToken = await reply.jwtSign({ user: serializedUser });

    reply.clearCookie(googleStateCookie, { path: "/" });
    reply.setCookie(env.sessionCookieName, sessionToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });

    return reply.redirect(`${env.webBaseUrl}/pipeline`);
  });

  app.get(
    "/api/auth/session",
    {
      preHandler: app.authenticate,
    },
    async (request) => ({ user: request.authUser }),
  );

  app.post("/auth/signout", async (_request, reply) => {
    reply.clearCookie(env.sessionCookieName, { path: "/" });
    return reply.send({ ok: true });
  });
};

import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  redisUrl: requireEnv("REDIS_URL"),
  serverPort: Number(process.env.SERVER_PORT ?? 4000),
  serverBaseUrl: process.env.SERVER_BASE_URL ?? "http://localhost:4000",
  webBaseUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  tokenEncryptionKey:
    process.env.TOKEN_ENCRYPTION_KEY ?? process.env.SESSION_SECRET ?? "development-key",
  cronSecret: process.env.CRON_SECRET ?? process.env.SESSION_SECRET ?? "development-cron-secret",
  hubspotClientId: optionalEnv("HUBSPOT_CLIENT_ID"),
  hubspotClientSecret: optionalEnv("HUBSPOT_CLIENT_SECRET"),
  hubspotRedirectUri: optionalEnv("HUBSPOT_REDIRECT_URI"),
  hubspotWebhookSecret: optionalEnv("HUBSPOT_WEBHOOK_SECRET"),
  fathomClientId: optionalEnv("FATHOM_CLIENT_ID"),
  fathomClientSecret: optionalEnv("FATHOM_CLIENT_SECRET"),
  fathomRedirectUri: optionalEnv("FATHOM_REDIRECT_URI"),
  fathomWebhookSecret: optionalEnv("FATHOM_WEBHOOK_SECRET"),
};

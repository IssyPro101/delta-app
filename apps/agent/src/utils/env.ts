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
  serverBaseUrl: process.env.SERVER_BASE_URL ?? "http://localhost:4000",
  webBaseUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  agentPort: Number(process.env.AGENT_PORT ?? 4100),
  agentBaseUrl: process.env.AGENT_BASE_URL ?? "http://localhost:4100",
  tokenEncryptionKey:
    process.env.TOKEN_ENCRYPTION_KEY ?? process.env.SESSION_SECRET ?? "development-key",
  aiProvider: process.env.AI_PROVIDER ?? "openai",
  openAiApiKey: optionalEnv("OPENAI_API_KEY"),
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-5",
  anthropicApiKey: optionalEnv("ANTHROPIC_API_KEY"),
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
};

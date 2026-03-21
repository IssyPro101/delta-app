import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

declare global {
  // eslint-disable-next-line no-var
  var __pipelineSupabase__:
    | ReturnType<typeof createClient<Database>>
    | undefined;
}

export const supabase =
  globalThis.__pipelineSupabase__ ??
  createClient<Database>(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__pipelineSupabase__ = supabase;
}

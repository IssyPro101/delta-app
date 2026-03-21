import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Database } from "./database.types";

const currentDir = dirname(fileURLToPath(import.meta.url));

// Load the workspace root env file so package consumers do not need to
// initialize dotenv before importing the shared DB client.
dotenv.config({ path: resolve(currentDir, "../../../.env") });
dotenv.config();

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

import type { SupabaseClient } from "@supabase/supabase-js";
import { publicSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/utils/supabase/client";

let client: SupabaseClient | null | undefined;

export function browserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!publicSupabaseEnv()) {
    client = null;
    return client;
  }
  try {
    client = createClient();
  } catch {
    client = null;
  }
  return client;
}

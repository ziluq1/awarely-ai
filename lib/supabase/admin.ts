import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicSupabaseEnv } from "@/lib/supabase/env";

export function adminSupabase(): SupabaseClient | null {
  const env = publicSupabaseEnv();
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!env || !key) return null;
  if (key === env.key || key.startsWith("sb_publishable_")) return null;
  return createClient(env.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

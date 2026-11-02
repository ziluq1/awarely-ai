import { publicSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/utils/supabase/server";

export async function serverSupabase() {
  if (!publicSupabaseEnv()) return null;
  try {
    return await createClient();
  } catch {
    return null;
  }
}

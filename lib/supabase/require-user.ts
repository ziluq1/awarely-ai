import type { SupabaseClient, User } from "@supabase/supabase-js";
import { privateTextResponse } from "@/lib/private-image";
import { serverSupabase } from "@/lib/supabase/server";

export async function requireVerifiedUser(): Promise<
  { ok: true; supabase: SupabaseClient; user: User } | { ok: false; response: Response }
> {
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, response: privateTextResponse("Supabase is not configured.", 503) };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, response: privateTextResponse("Log in to open this photo.", 401) };
  return { ok: true, supabase, user: data.user };
}

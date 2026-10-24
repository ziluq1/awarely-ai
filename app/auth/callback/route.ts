import { connection, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth";
import { serverSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const failed = new URL("/login?error=callback", url.origin);

  if (url.searchParams.get("error")) {
    return NextResponse.redirect(failed);
  }

  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(failed);

  const supabase = await serverSupabase();
  if (!supabase) return NextResponse.redirect(new URL("/login?error=config", url.origin));

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(failed);

  return NextResponse.redirect(new URL(next, url.origin));
}

import { NextResponse } from "next/server";
import {
  authCallbackDestination,
  authExchangeError,
  authLinkErrorFromProvider,
  isEmailOtpType,
  isEmailVerified,
} from "@/lib/auth";
import { serverSupabase } from "@/lib/supabase/server";

export async function finishAuthCallback(request: Request, forcedNext?: string): Promise<NextResponse> {
  const url = new URL(request.url);
  const next = authCallbackDestination({
    pathname: url.pathname,
    type: url.searchParams.get("type"),
    next: url.searchParams.get("next"),
    forcedNext,
  });

  if (url.searchParams.get("error") || url.searchParams.get("error_code")) {
    const code = authLinkErrorFromProvider(url.searchParams.get("error_code"), url.searchParams.get("error_description"));
    return NextResponse.redirect(new URL(`/login?error=${code}`, url.origin));
  }

  const supabase = await serverSupabase();
  if (!supabase) return NextResponse.redirect(new URL("/login?error=config", url.origin));

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (tokenHash) {
    if (!isEmailOtpType(type)) return NextResponse.redirect(new URL("/login?error=invalid", url.origin));
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return NextResponse.redirect(new URL(`/login?error=${authExchangeError(error.message)}`, url.origin));
    const destination = authCallbackDestination({
      pathname: url.pathname,
      type,
      next: url.searchParams.get("next"),
      forcedNext,
    });
    if (destination !== "/reset-password" && !isEmailVerified(data.user)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?error=unverified", url.origin));
    }
    return NextResponse.redirect(new URL(destination, url.origin));
  }

  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=invalid", url.origin));

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/login?error=${authExchangeError(error.message)}`, url.origin));
  if (next !== "/reset-password" && !isEmailVerified(data.user)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=unverified", url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}

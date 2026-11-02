import { NextResponse } from "next/server";
import { isEmailOtpType, safeNextPath } from "@/lib/auth";
import { serverSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const tokenHash = text(form.get("token_hash"));
  const type = text(form.get("type"));
  const next = safeNextPath(text(form.get("next")) || null);
  const origin = new URL(request.url).origin;

  if (!tokenHash || !isEmailOtpType(type)) {
    return NextResponse.redirect(errorUrl(origin, "This link is invalid."), 303);
  }

  const supabase = await serverSupabase();
  if (!supabase) {
    return NextResponse.redirect(errorUrl(origin, "Supabase is not configured."), 303);
  }

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(errorUrl(origin, confirmErrorMessage(error.message)), 303);
  }

  return NextResponse.redirect(new URL(next, origin), 303);
}

const USED_OR_EXPIRED =
  "This link was already used or has expired. If you already confirmed your email, you can log in. Otherwise sign up again to get a new email.";

function confirmErrorMessage(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("expir") || text.includes("used") || text.includes("invalid") || text.includes("otp")) {
    return USED_OR_EXPIRED;
  }
  return message;
}

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function errorUrl(origin: string, message: string): URL {
  const dest = new URL("/auth/confirm/error", origin);
  dest.searchParams.set("message", message);
  return dest;
}

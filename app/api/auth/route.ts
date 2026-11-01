import { connection, NextResponse } from "next/server";
import { authCallbackUrl, authErrorMessage, isEmail, isEmailVerified } from "@/lib/auth";
import { serverSupabase } from "@/lib/supabase/server";

const MAX_BODY_BYTES = 16_384;
const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 1_024;

type AuthRequest =
  | { flow: "login"; email: string; password: string; turnstileToken: string }
  | { flow: "signup"; email: string; password: string; turnstileToken: string }
  | { flow: "forgot"; email: string; turnstileToken: string }
  | { flow: "resend"; email: string; source: "login" | "signup"; turnstileToken: string }
  | { flow: "oauth"; source: "login" | "signup"; turnstileToken: string };

export async function POST(request: Request) {
  await connection();

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return failure("That request is too large. Refresh the page and try again.", 413);
  }

  const input = await readRequest(request);
  if (!input.ok) return failure(input.message, 400);

  const value = input.value;
  const captchaToken = value.turnstileToken || undefined;

  const supabase = await serverSupabase();
  if (!supabase) return failure("Account access is not configured. Try again later.", 503);

  if (value.flow === "login") {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: value.email,
      password: value.password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    if (error) return failure(authErrorMessage(error.message), 401);
    if (!isEmailVerified(data.user)) {
      await supabase.auth.signOut();
      return failure(authErrorMessage("Email not confirmed"), 403);
    }
    return NextResponse.json({ ok: true, status: "authenticated" });
  }

  if (value.flow === "signup") {
    const { data, error } = await supabase.auth.signUp({
      email: value.email,
      password: value.password,
      options: {
        emailRedirectTo: authCallbackUrl(new URL(request.url).origin, "signup"),
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    if (error) return failure(authErrorMessage(error.message), 400);
    if (!data.session || !isEmailVerified(data.user)) {
      if (data.session) await supabase.auth.signOut();
      return NextResponse.json({ ok: true, status: "confirmation_sent" });
    }
    return NextResponse.json({ ok: true, status: "authenticated" });
  }

  if (value.flow === "forgot") {
    const { error } = await supabase.auth.resetPasswordForEmail(value.email, {
      redirectTo: authCallbackUrl(new URL(request.url).origin, "recovery"),
      ...(captchaToken ? { captchaToken } : {}),
    });
    if (error) return failure(authErrorMessage(error.message), 400);
    return NextResponse.json({ ok: true, status: "reset_sent" });
  }

  if (value.flow === "resend") {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: value.email,
      options: {
        emailRedirectTo: authCallbackUrl(new URL(request.url).origin, "signup"),
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    if (error) return failure(authErrorMessage(error.message), 400);
    return NextResponse.json({ ok: true, status: "confirmation_resent" });
  }

  // Google OAuth does not accept captchaToken.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authCallbackUrl(new URL(request.url).origin, "oauth"),
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) return failure(authErrorMessage(error?.message ?? "OAuth could not start"), 400);
  return NextResponse.json({ ok: true, status: "oauth", url: data.url });
}

async function readRequest(
  request: Request,
): Promise<{ ok: true; value: AuthRequest } | { ok: false; message: string }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, message: "That request could not be read. Refresh the page and try again." };
  }
  if (!body || typeof body !== "object") return { ok: false, message: "Complete the form and try again." };

  const input = body as Record<string, unknown>;
  const flow = input.flow;
  // Turnstile is optional while Supabase CAPTCHA is off. Pass through when present.
  const turnstileToken = text(input.turnstileToken);

  if (flow === "oauth") {
    const source = authSource(input.source);
    return source
      ? { ok: true, value: { flow, source, turnstileToken } }
      : { ok: false, message: "Refresh the page and try again." };
  }

  const email = text(input.email).toLowerCase();
  if (!isEmail(email) || email.length > MAX_EMAIL_LENGTH) {
    return { ok: false, message: "Enter a valid email address." };
  }

  if (flow === "forgot") return { ok: true, value: { flow, email, turnstileToken } };

  if (flow === "resend") {
    const source = authSource(input.source);
    return source
      ? { ok: true, value: { flow, email, source, turnstileToken } }
      : { ok: false, message: "Refresh the page and try again." };
  }

  const password = typeof input.password === "string" ? input.password : "";
  if (flow === "login") {
    if (!password || password.length > MAX_PASSWORD_LENGTH) {
      return { ok: false, message: "Enter your password." };
    }
    return { ok: true, value: { flow, email, password, turnstileToken } };
  }
  if (flow === "signup") {
    if (password.length < 8 || password.length > MAX_PASSWORD_LENGTH) {
      return { ok: false, message: "Use between 8 and 1,024 characters for your password." };
    }
    return { ok: true, value: { flow, email, password, turnstileToken } };
  }
  return { ok: false, message: "Refresh the page and try again." };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function authSource(value: unknown): "login" | "signup" | null {
  return value === "login" || value === "signup" ? value : null;
}

function failure(message: string, status: number, kind = "auth") {
  return NextResponse.json({ ok: false, message, kind }, { status });
}

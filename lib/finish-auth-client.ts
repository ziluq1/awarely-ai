import {
  authCallbackDestination,
  authExchangeError,
  authLinkErrorFromProvider,
  authLinkMessage,
  isEmailOtpType,
  isEmailVerified,
} from "@/lib/auth";
import { browserSupabase } from "@/lib/supabase/browser";

export type FinishAuthResult =
  | { ok: true; next: string }
  | { ok: false; message: string };

/**
 * Completes an auth redirect in the browser.
 * Handles: #access_token (implicit), ?code= (PKCE), ?token_hash=&type= (OTP).
 */
export async function finishAuthFromLocation(forcedNext?: string): Promise<FinishAuthResult> {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const pathname = window.location.pathname;

  const providerError = search.get("error") || search.get("error_code") || hash.get("error") || hash.get("error_code");
  if (providerError) {
    const description = search.get("error_description") || hash.get("error_description");
    const errorCode = search.get("error_code") || hash.get("error_code");
    console.error("[auth] provider redirect error:", { errorCode, description, providerError });
    return {
      ok: false,
      message: authLinkMessage(authLinkErrorFromProvider(errorCode, description)),
    };
  }

  const supabase = browserSupabase();
  if (!supabase) {
    console.error("[auth] Supabase browser client is not configured");
    return { ok: false, message: authLinkMessage("config") };
  }

  const tokenHash = search.get("token_hash");
  const otpType = search.get("type");
  if (tokenHash) {
    if (!isEmailOtpType(otpType)) {
      console.error("[auth] verifyOtp rejected: missing or invalid type", { otpType, hasTokenHash: true });
      return { ok: false, message: authLinkMessage("invalid") };
    }
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
    if (error) {
      console.error("[auth] verifyOtp failed:", error.message, error);
      return { ok: false, message: authLinkMessage(authExchangeError(error.message)) };
    }
    const done = await finishSession(data.user, {
      pathname,
      type: otpType,
      next: search.get("next"),
      forcedNext,
      supabase,
    });
    if (done.ok) clearAuthParamsFromUrl();
    return done;
  }

  const code = search.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth] exchangeCodeForSession failed:", error.message, error);
      return { ok: false, message: authLinkMessage(authExchangeError(error.message)) };
    }
    const done = await finishSession(data.user, {
      pathname,
      type: search.get("type") || hash.get("type"),
      next: search.get("next"),
      forcedNext,
      supabase,
    });
    if (done.ok) clearAuthParamsFromUrl();
    return done;
  }

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      console.error("[auth] setSession failed:", error.message, error);
      return { ok: false, message: authLinkMessage(authExchangeError(error.message)) };
    }
    const done = await finishSession(data.user, {
      pathname,
      type: hash.get("type") || search.get("type"),
      next: search.get("next"),
      forcedNext,
      supabase,
    });
    if (done.ok) clearAuthParamsFromUrl();
    return done;
  }

  console.error("[auth] no usable auth payload in URL", {
    path: pathname,
    search: window.location.search,
    hashKeys: [...hash.keys()],
  });
  return {
    ok: false,
    message:
      "That link is missing its sign-in details. Open the newest email from Awarely, tap the link in that message, and stay in the same browser.",
  };
}

async function finishSession(
  user: { email_confirmed_at?: string | null; confirmed_at?: string | null } | null,
  input: {
    pathname: string;
    type: string | null;
    next: string | null;
    forcedNext?: string;
    supabase: NonNullable<ReturnType<typeof browserSupabase>>;
  },
): Promise<FinishAuthResult> {
  const next = authCallbackDestination({
    pathname: input.pathname,
    type: input.type,
    next: input.next,
    forcedNext: input.forcedNext,
  });
  // Email OTP verify is the confirmation step — do not sign the user out if the
  // returned user object is briefly missing confirmed timestamps.
  const confirmedByOtp = input.type === "email" || input.type === "signup" || input.type === "invite";
  if (next !== "/reset-password" && !isEmailVerified(user) && !confirmedByOtp) {
    console.error("[auth] session established but email is still unverified", { type: input.type, user });
    await input.supabase.auth.signOut();
    return { ok: false, message: authLinkMessage("unverified") };
  }
  return { ok: true, next };
}

function clearAuthParamsFromUrl() {
  window.history.replaceState(null, "", window.location.pathname);
}

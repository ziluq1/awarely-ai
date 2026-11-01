import type { User } from "@supabase/supabase-js";

export type AuthProfile = {
  id: string;
  email: string;
  name: string;
  savedName: string | null;
  hasAvatar: boolean;
  avatarRevision: number;
};

export type SavedIdentity = {
  id: string;
  displayName: string;
  avatarPath: string | null;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

export function profileFromUser(user: User): AuthProfile {
  const meta = user.user_metadata ?? {};
  const email = user.email ?? "";
  const nameValue = meta.full_name ?? meta.name ?? meta.user_name;
  const name = typeof nameValue === "string" && nameValue.trim() ? nameValue.trim() : email || "awarely.ai member";
  return { id: user.id, email, name, savedName: null, hasAvatar: false, avatarRevision: 0 };
}

export function applySavedIdentity(account: AuthProfile, saved: SavedIdentity | null, revision = account.avatarRevision): AuthProfile {
  const next: AuthProfile = { ...account, savedName: null, hasAvatar: false, avatarRevision: revision };
  if (!saved || saved.id !== account.id) return next;
  const displayName = saved.displayName.trim();
  const hasAvatar = Boolean(saved.avatarPath);
  if (!displayName) return { ...next, hasAvatar };
  return { ...next, name: displayName, savedName: displayName, hasAvatar };
}

export function isEmailVerified(user: { email_confirmed_at?: string | null; confirmed_at?: string | null } | null): boolean {
  if (!user) return false;
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

const PRODUCTION_APP_ORIGIN = "https://awarely-ai.vercel.app";

export const SIGNUP_EMAIL_REDIRECT_TO = "https://awarely-ai.vercel.app/auth/callback";
export const PASSWORD_RESET_REDIRECT_TO = "https://awarely-ai.vercel.app/auth/callback/recovery";

export function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function configuredSiteOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== "/" && url.pathname !== "") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function authEmailOrigin(browserOrigin: string): string {
  let origin = "";
  try {
    origin = new URL(browserOrigin).origin;
  } catch {
    return configuredSiteOrigin() ?? PRODUCTION_APP_ORIGIN;
  }
  if (isLocalOrigin(origin) || origin === PRODUCTION_APP_ORIGIN) return origin;
  return configuredSiteOrigin() ?? origin;
}

export function authCallbackUrl(browserOrigin: string, flow: "signup" | "recovery" | "oauth" = "signup"): string {
  if (flow === "signup") return SIGNUP_EMAIL_REDIRECT_TO;
  if (flow === "recovery") return PASSWORD_RESET_REDIRECT_TO;
  const origin = authEmailOrigin(browserOrigin);
  return `${origin}/auth/callback`;
}

export function authCallbackDestination(input: {
  pathname: string;
  type: string | null;
  next: string | null;
  forcedNext?: string;
}): string {
  if (input.forcedNext === "/reset-password" || input.pathname.endsWith("/recovery") || input.type === "recovery") {
    return "/reset-password";
  }
  return safeNextPath(input.next);
}

export type AuthLinkError = "config" | "expired" | "used" | "invalid" | "verifier" | "unverified" | "callback";

export function authLinkErrorFromProvider(errorCode: string | null, description: string | null): AuthLinkError {
  const code = (errorCode ?? "").toLowerCase();
  const text = (description ?? "").toLowerCase();
  if (code === "otp_expired" || text.includes("expired")) return "expired";
  if (text.includes("already") || text.includes("used")) return "used";
  return "invalid";
}

export function authExchangeError(message: string): AuthLinkError {
  const text = message.toLowerCase();
  if (text.includes("code verifier") || text.includes("pkce")) return "verifier";
  if (text.includes("expir")) return "expired";
  if (text.includes("already") || text.includes("used")) return "used";
  return "invalid";
}

export function authLinkMessage(error: string | null): string {
  if (error === "config") return "Supabase is not configured in this app yet.";
  if (error === "expired") return "That link has expired. Request a new email and use the newest link.";
  if (error === "used") return "That link was already used. Log in, or request a new confirmation email if your address is still unconfirmed.";
  if (error === "verifier") {
    return "Open the link in the same browser you used to sign up, or request a new confirmation email.";
  }
  if (error === "unverified") return "Confirm your email before using your account. Use the newest link, or send another one below.";
  if (error === "invalid" || error === "callback") {
    return "That link is not valid. Request a new email and try again.";
  }
  return "";
}

export function isEmailOtpType(value: string | null): value is "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email" {
  return (
    value === "signup" ||
    value === "invite" ||
    value === "magiclink" ||
    value === "recovery" ||
    value === "email_change" ||
    value === "email"
  );
}

export function authErrorMessage(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) {
    return "That email and password do not match. Try again, or use Forgot password.";
  }
  if (text.includes("email not confirmed")) {
    return "Confirm your email before signing in. Use the link in your email, or send another confirmation email below.";
  }
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "An account with that email already exists. Log in instead.";
  }
  if (text.includes("provider") && (text.includes("not enabled") || text.includes("disabled") || text.includes("unsupported"))) {
    return "Google sign-in is turned off in this Supabase project. Enable the Google provider in the Supabase dashboard, then try again.";
  }
  if (text.includes("password") && (text.includes("at least") || text.includes("weak") || text.includes("should be"))) {
    return message;
  }
  if (text.includes("captcha")) {
    return "The bot-protection check failed or expired. Complete it again, then retry.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Too many attempts. Wait a minute, then try again.";
  }
  if (text.includes("network") || text.includes("fetch") || text.includes("failed to fetch")) {
    return "awarely.ai could not reach Supabase. Check your connection and try again.";
  }
  return "Supabase could not complete that request. Try again.";
}

export function safeNextPath(value: string | null): string {
  if (!value) return "/";
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return "/";
    if (url.origin !== PRODUCTION_APP_ORIGIN && !isLocalOrigin(url.origin)) return "/";
    const path = `${url.pathname}${url.search}`;
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/";
    return path === "" ? "/" : path;
  } catch {
    return "/";
  }
}

import type { User } from "@supabase/supabase-js";

export type AuthProfile = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
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
  const avatarValue = meta.avatar_url ?? meta.picture;
  const avatarUrl = typeof avatarValue === "string" && avatarValue.startsWith("https://") ? avatarValue : null;
  return { id: user.id, email, name, avatarUrl };
}

export function authErrorMessage(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) {
    return "That email and password do not match. Try again, or use Forgot password.";
  }
  if (text.includes("email not confirmed")) {
    return "Confirm your email before signing in. The link is in the message from Supabase.";
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
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Too many attempts. Wait a minute, then try again.";
  }
  if (text.includes("network") || text.includes("fetch") || text.includes("failed to fetch")) {
    return "awarely.ai could not reach Supabase. Check your connection and try again.";
  }
  return "Supabase could not complete that request. Try again.";
}

export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

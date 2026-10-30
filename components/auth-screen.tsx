"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { Button, ErrorBlock, PageHeader, cardClass, fieldClass } from "@/components/ui";
import {
  authErrorMessage,
  authLinkMessage,
  isEmail,
  safeNextPath,
} from "@/lib/auth";
import { browserSupabase } from "@/lib/supabase/browser";

type Mode = "login" | "signup" | "forgot" | "reset";

const COPY: Record<Mode, { eyebrow: string; title: string; lead: string }> = {
  login: {
    eyebrow: "Account",
    title: "Log in",
    lead: "Use the email and password for your awarely.ai account, or continue with Google.",
  },
  signup: {
    eyebrow: "Account",
    title: "Sign up",
    lead: "Create an account with email and a password, or continue with Google.",
  },
  forgot: {
    eyebrow: "Account",
    title: "Reset your password",
    lead: "Enter the email on your account. Supabase will send a link if it can.",
  },
  reset: {
    eyebrow: "Account",
    title: "Choose a new password",
    lead: "This page opens from the reset link in your email.",
  },
};

export function AuthScreen({ mode }: { mode: Mode }) {
  const auth = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const formId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<"form" | "google" | "resend" | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  const nextPath = params.get("next");

  useEffect(() => {
    if (mode === "reset" || auth.status !== "signed-in" || !auth.verified) return;
    if (mode === "login" || mode === "signup") {
      reloadPage(mode === "login" ? "/" : safeNextPath(nextPath));
      return;
    }
    router.replace(safeNextPath(nextPath));
  }, [auth.status, auth.verified, mode, nextPath, router]);

  const callbackError = params.get("error");
  const banner = authLinkMessage(callbackError);
  const accountDeleted = params.get("deleted") === "1";
  const canResend =
    (mode === "login" || mode === "signup") &&
    (Boolean(banner) || notice.startsWith("Check your email") || formError.includes("Confirm your email"));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFieldError("");
    setFormError("");
    setNotice("");

    if (mode !== "reset") {
      if (!isEmail(email)) {
        setFieldError("Enter a valid email address.");
        return;
      }
    }

    if (mode === "signup" || mode === "reset") {
      if (password.length < 8) {
        setFieldError("Use at least 8 characters for your password.");
        return;
      }
    } else if (mode === "login" && !password) {
      setFieldError("Enter your password.");
      return;
    }

    if ((mode === "signup" || mode === "reset") && password !== confirm) {
      setFieldError("Those passwords do not match.");
      return;
    }

    if (mode !== "reset" && !turnstileToken) {
      setFormError("Complete the bot-protection check and try again.");
      return;
    }

    setPending("form");

    if (mode === "login") {
      const result = await sendAuthRequest({
        flow: "login",
        email: email.trim(),
        password,
        turnstileToken,
      });
      setPending(null);
      resetTurnstile();
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      reloadPage("/");
      return;
    }

    if (mode === "signup") {
      const result = await sendAuthRequest({
        flow: "signup",
        email: email.trim(),
        password,
        turnstileToken,
      });
      setPending(null);
      resetTurnstile();
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      if (result.status === "confirmation_sent") {
        setNotice("Check your email for a confirmation link. After you confirm, you can log in.");
        return;
      }
      reloadPage("/");
      return;
    }

    if (mode === "forgot") {
      const result = await sendAuthRequest({
        flow: "forgot",
        email: email.trim(),
        turnstileToken,
      });
      setPending(null);
      resetTurnstile();
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      setNotice("If that email can receive mail from Supabase, a reset link is on its way.");
      return;
    }

    const supabase = browserSupabase();
    if (!supabase) {
      setPending(null);
      setFormError("Supabase is not configured. Add the project URL and publishable key, then restart the dev server.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    setPending(null);
    if (error) {
      setFormError(authErrorMessage(error.message));
      return;
    }
    router.replace("/");
  }

  async function continueWithGoogle() {
    if (pending) return;
    setFormError("");
    setNotice("");
    if (!turnstileToken || (mode !== "login" && mode !== "signup")) {
      setFormError("Complete the bot-protection check and try again.");
      return;
    }
    setPending("google");
    const result = await sendAuthRequest({
      flow: "oauth",
      source: mode,
      turnstileToken,
    });
    if (!result.ok || !result.url) {
      resetTurnstile();
      setPending(null);
      setFormError(result.ok ? "Google sign-in could not start. Try again." : result.message);
      return;
    }
    window.location.assign(result.url);
  }

  async function resendConfirmation() {
    if (pending) return;
    const address = email.trim() || auth.user?.email || "";
    if (!isEmail(address)) {
      setFieldError("Enter the email on the account, then send the confirmation email again.");
      return;
    }
    if (!turnstileToken || (mode !== "login" && mode !== "signup")) {
      setFormError("Complete the bot-protection check and try again.");
      return;
    }
    setPending("resend");
    setFormError("");
    const result = await sendAuthRequest({
      flow: "resend",
      email: address,
      source: mode,
      turnstileToken,
    });
    setPending(null);
    resetTurnstile();
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setNotice("Check your email for a new confirmation link. Use the newest one.");
  }

  function resetTurnstile() {
    setTurnstileToken("");
    setTurnstileReset((value) => value + 1);
  }

  const copy = COPY[mode];
  const emailId = `${formId}-email`;
  const passwordId = `${formId}-password`;
  const confirmId = `${formId}-confirm`;
  const errorId = `${formId}-error`;

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title}>
        <p>{copy.lead}</p>
      </PageHeader>

      <div className={`${cardClass} space-y-5 p-6 sm:p-8`}>
        {accountDeleted ? (
          <p className="rounded-2xl bg-sage px-4 py-3 text-sm leading-relaxed text-sage-text" role="status">
            Your account was deleted.
          </p>
        ) : null}
        {banner ? <ErrorBlock title="Sign-in needs another try" message={banner} /> : null}
        {formError ? <ErrorBlock title={errorTitle(mode)} message={formError} /> : null}
        {notice ? (
          <p className="rounded-2xl bg-sage px-4 py-3 text-sm leading-relaxed text-sage-text" role="status">
            {notice}
          </p>
        ) : null}
        {canResend ? (
          <Button
            variant="secondary"
            className="w-full"
            disabled={pending !== null || !turnstileToken}
            onClick={() => void resendConfirmation()}
          >
            {pending === "resend" ? "Sending confirmation email…" : "Resend confirmation email"}
          </Button>
        ) : null}

        {mode === "login" || mode === "signup" ? (
          <Button
            variant="secondary"
            className="w-full"
            disabled={pending !== null || !turnstileToken}
            onClick={() => void continueWithGoogle()}
          >
            <GoogleMark />
            {pending === "google" ? "Opening Google…" : "Continue with Google"}
          </Button>
        ) : null}

        {mode === "login" || mode === "signup" ? (
          <p className="text-center text-xs uppercase tracking-[0.16em] text-muted">or use email</p>
        ) : null}

        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)} aria-busy={pending === "form"} noValidate>
          {mode === "reset" ? null : (
            <div>
              <label htmlFor={emailId} className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id={emailId}
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={`${fieldClass} mt-2`}
                placeholder="name@example.com"
                aria-invalid={fieldError.includes("email") ? true : undefined}
                aria-describedby={fieldError ? errorId : undefined}
              />
            </div>
          )}

          {mode === "forgot" ? null : (
            <PasswordField
              id={passwordId}
              label={mode === "reset" ? "New password" : "Password"}
              value={password}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              visible={showPassword}
              onToggle={() => setShowPassword((current) => !current)}
              onChange={setPassword}
              describedBy={fieldError ? errorId : undefined}
              invalid={Boolean(fieldError) && !fieldError.includes("email")}
            />
          )}

          {mode === "signup" || mode === "reset" ? (
            <PasswordField
              id={confirmId}
              label="Confirm password"
              value={confirm}
              autoComplete="new-password"
              visible={showConfirm}
              onToggle={() => setShowConfirm((current) => !current)}
              onChange={setConfirm}
              describedBy={fieldError ? errorId : undefined}
              invalid={fieldError.includes("match")}
            />
          ) : null}

          {mode === "signup" || mode === "reset" ? (
            <p className="text-sm text-muted">Use at least 8 characters. Supabase may require more if you set a stricter rule.</p>
          ) : null}

          {fieldError ? (
            <p id={errorId} className="text-sm text-danger" role="alert">
              {fieldError}
            </p>
          ) : null}

          {mode === "reset" ? null : (
            <TurnstileWidget
              action={mode}
              resetSignal={turnstileReset}
              onToken={setTurnstileToken}
            />
          )}

          <Button type="submit" className="w-full" disabled={pending !== null || (mode !== "reset" && !turnstileToken)}>
            {submitLabel(mode, pending === "form")}
          </Button>
        </form>

        <div className="flex flex-col gap-2 text-sm">
          {mode === "login" ? (
            <Link className="font-medium text-accent-text underline decoration-line underline-offset-4" href="/forgot-password">
              Forgot password?
            </Link>
          ) : null}
          {mode === "login" ? (
            <p className="text-lg text-foreground">
              New here?{" "}
              <Link className="font-medium text-accent-text underline decoration-line underline-offset-4" href="/signup">
                Sign up
              </Link>
            </p>
          ) : null}
          {mode === "signup" ? (
            <p className="text-muted">
              Already have an account?{" "}
              <Link className="font-medium text-accent-text underline decoration-line underline-offset-4" href="/login">
                Log in
              </Link>
            </p>
          ) : null}
          {mode === "forgot" || mode === "reset" ? (
            <Link className="font-medium text-accent-text underline decoration-line underline-offset-4" href="/login">
              Back to log in
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type AuthRequestBody =
  | { flow: "login" | "signup"; email: string; password: string; turnstileToken: string }
  | { flow: "forgot"; email: string; turnstileToken: string }
  | { flow: "resend"; email: string; source: "login" | "signup"; turnstileToken: string }
  | { flow: "oauth"; source: "login" | "signup"; turnstileToken: string };

type AuthRequestResult =
  | { ok: true; status: string; url?: string }
  | { ok: false; message: string };

async function sendAuthRequest(body: AuthRequestBody): Promise<AuthRequestResult> {
  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as Partial<AuthRequestResult> & { message?: string };
    if (!response.ok || result.ok !== true) {
      return {
        ok: false,
        message: typeof result.message === "string" ? result.message : "Account access could not be completed. Try again.",
      };
    }
    return {
      ok: true,
      status: typeof result.status === "string" ? result.status : "complete",
      url: typeof result.url === "string" ? result.url : undefined,
    };
  } catch {
    return { ok: false, message: "awarely.ai could not complete that request. Check your connection and try again." };
  }
}

function reloadPage(path: string) {
  window.location.replace(path);
}

function errorTitle(mode: Mode): string {
  if (mode === "signup") return "Supabase could not create the account";
  if (mode === "forgot") return "Supabase could not send the reset link";
  if (mode === "reset") return "Supabase could not save the new password";
  return "Supabase could not sign you in";
}

function submitLabel(mode: Mode, pending: boolean): string {
  if (pending) {
    if (mode === "login") return "Logging in…";
    if (mode === "signup") return "Creating account…";
    if (mode === "forgot") return "Sending link…";
    return "Saving password…";
  }
  if (mode === "login") return "Log in";
  if (mode === "signup") return "Create account";
  if (mode === "forgot") return "Send reset link";
  return "Save new password";
}

function PasswordField({
  id,
  label,
  value,
  autoComplete,
  visible,
  invalid,
  describedBy,
  onToggle,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  autoComplete: string;
  visible: boolean;
  invalid: boolean;
  describedBy?: string;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldClass} pr-20`}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="absolute top-1/2 right-2 min-h-9 -translate-y-1/2 rounded-full px-3 text-sm font-medium text-accent-text"
          aria-pressed={visible}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onClick={onToggle}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.74-.07-1.45-.19-2.14H12v4.05h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.43Z"
      />
      <path
        fill="currentColor"
        d="M12 22c2.7 0 4.96-.9 6.62-2.44l-3.23-2.5c-.9.6-2.04.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.05v2.58A10 10 0 0 0 12 22Z"
      />
      <path
        fill="currentColor"
        d="M6.39 13.89A6 6 0 0 1 6.08 12c0-.66.11-1.29.31-1.89V7.53H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.47l3.34-2.58Z"
      />
      <path
        fill="currentColor"
        d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.99 14.7 2 12 2A10 10 0 0 0 3.05 7.53l3.34 2.58C7.18 7.74 9.39 5.98 12 5.98Z"
      />
    </svg>
  );
}

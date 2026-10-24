"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button, ErrorBlock, PageHeader, cardClass, fieldClass } from "@/components/ui";
import { authErrorMessage, isEmail } from "@/lib/auth";
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
  const [pending, setPending] = useState<"form" | "google" | null>(null);

  useEffect(() => {
    if (mode === "reset" || auth.status !== "signed-in") return;
    router.replace("/");
  }, [auth.status, mode, router]);

  const callbackError = params.get("error");
  const banner =
    callbackError === "config"
      ? "Supabase is not configured in this app yet."
      : callbackError === "callback"
        ? "That sign-in link expired or could not be confirmed. Request a new one and try again."
        : "";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFieldError("");
    setFormError("");
    setNotice("");

    const supabase = browserSupabase();
    if (!supabase) {
      setFormError("Supabase is not configured. Add the project URL and publishable key, then restart the dev server.");
      return;
    }

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

    setPending("form");
    const origin = window.location.origin;

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setPending(null);
      if (error) {
        setFormError(authErrorMessage(error.message));
        return;
      }
      router.replace("/");
      return;
    }

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      setPending(null);
      if (error) {
        setFormError(authErrorMessage(error.message));
        return;
      }
      if (!data.session) {
        setNotice("Check your email for a confirmation link from Supabase. After you confirm, you can log in.");
        return;
      }
      router.replace("/");
      return;
    }

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      });
      setPending(null);
      if (error) {
        setFormError(authErrorMessage(error.message));
        return;
      }
      setNotice("If that email can receive mail from Supabase, a reset link is on its way.");
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
    const supabase = browserSupabase();
    if (!supabase) {
      setFormError("Supabase is not configured. Add the project URL and publishable key, then restart the dev server.");
      return;
    }
    setPending("google");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setPending(null);
      setFormError(authErrorMessage(error.message));
    }
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
        {banner ? <ErrorBlock title="Sign-in needs another try" message={banner} /> : null}
        {formError ? <ErrorBlock title={errorTitle(mode)} message={formError} /> : null}
        {notice ? (
          <p className="rounded-2xl bg-sage px-4 py-3 text-sm leading-relaxed text-sage-text" role="status">
            {notice}
          </p>
        ) : null}

        {mode === "login" || mode === "signup" ? (
          <Button variant="secondary" className="w-full" disabled={pending !== null} onClick={() => void continueWithGoogle()}>
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

          <Button type="submit" className="w-full" disabled={pending !== null}>
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
            <p className="text-muted">
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

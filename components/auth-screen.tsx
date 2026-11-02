"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { useAuth } from "@/components/auth-provider";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { Button, ErrorBlock, PageHeader, cardClass, fieldClass } from "@/components/ui";
import { authCallbackUrl, authLinkMessage, isEmail, safeNextPath } from "@/lib/auth";
import { browserSupabase } from "@/lib/supabase/browser";

type Mode = "login" | "signup" | "forgot" | "reset";

const COPY: Record<Mode, { eyebrow: string; title: string; lead: string }> = {
  login: {
    eyebrow: "Account",
    title: "Log in",
    lead: "Use the email and password for your awarely.ai account.",
  },
  signup: {
    eyebrow: "Account",
    title: "Sign up",
    lead: "Create an account with email and a password.",
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
  const [pending, setPending] = useState<"form" | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const needsCaptcha = mode === "login" || mode === "signup" || mode === "forgot";

  const nextPath = params.get("next");

  function clearCaptcha() {
    setCaptchaToken("");
  }

  function resetCaptcha() {
    setCaptchaToken("");
    turnstileRef.current?.reset();
  }

  useEffect(() => {
    if (mode === "reset" || auth.status !== "signed-in") return;
    const dest = mode === "login" ? "/" : safeNextPath(nextPath);
    router.replace(dest === "/login" || dest === "/signup" ? "/" : dest);
    router.refresh();
  }, [auth.status, mode, nextPath, router]);

  const callbackError = params.get("error");
  const banner = authLinkMessage(callbackError);
  const accountDeleted = params.get("deleted") === "1";

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

    if (needsCaptcha && !captchaToken) {
      setFieldError("Complete the bot check before continuing.");
      return;
    }

    setPending("form");

    const supabase = browserSupabase();
    if (!supabase) {
      setPending(null);
      setFormError("Supabase is not configured. Add the project URL and publishable key, then restart the dev server.");
      resetCaptcha();
      return;
    }

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
        options: { captchaToken },
      });
      setPending(null);
      if (error) {
        setFormError(error.message);
        resetCaptcha();
        return;
      }
      router.replace("/");
      router.refresh();
      return;
    }

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: authCallbackUrl(window.location.origin, "signup"),
          captchaToken,
        },
      });
      setPending(null);
      if (error) {
        setFormError(error.message);
        resetCaptcha();
        return;
      }
      if (data.session) {
        router.replace(safeNextPath(nextPath));
        router.refresh();
        return;
      }
      resetCaptcha();
      setNotice("Check your email to confirm your account.");
      return;
    }

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authCallbackUrl(window.location.origin, "recovery"),
        captchaToken,
      });
      setPending(null);
      if (error) {
        setFormError(error.message);
        resetCaptcha();
        return;
      }
      resetCaptcha();
      setNotice("If that email can receive mail from Supabase, a reset link is on its way.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    setPending(null);
    if (error) {
      setFormError(error.message);
      return;
    }
    router.replace("/");
    router.refresh();
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

          {needsCaptcha ? (
            <TurnstileWidget ref={turnstileRef} onSuccess={setCaptchaToken} onClear={clearCaptcha} />
          ) : null}

          <Button type="submit" className="w-full" disabled={pending !== null || (needsCaptcha && !captchaToken)}>
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

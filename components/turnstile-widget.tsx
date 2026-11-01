"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { useEffect, useRef, useState } from "react";

export function TurnstileWidget({
  action,
  resetSignal,
  onToken,
}: {
  action: "login" | "signup" | "forgot";
  resetSignal: number;
  onToken: (token: string) => void;
}) {
  const ref = useRef<TurnstileInstance>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<"compact" | "flexible" | null>(null);
  const [message, setMessage] = useState("");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize((entry?.contentRect.width ?? box.clientWidth) < 300 ? "compact" : "flexible");
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (resetSignal === 0) return;
    ref.current?.reset();
    onToken("");
    queueMicrotask(() => setMessage(""));
  }, [resetSignal, onToken]);

  // Optional: missing site key or a failed widget must never block the form.
  if (!siteKey) return null;

  return (
    <div className="space-y-2">
      <div
        ref={boxRef}
        className={`flex w-full justify-center overflow-hidden rounded-2xl ${size === "compact" ? "min-h-[140px]" : "min-h-[65px]"}`}
      >
        {size ? (
          <Turnstile
            key={size}
            ref={ref}
            siteKey={siteKey}
            options={{ action, size, theme: "auto", responseField: false }}
            onSuccess={(token) => {
              onToken(token);
              setMessage("");
            }}
            onExpire={() => {
              onToken("");
              setMessage("Bot check expired. You can still continue, or wait for it to refresh.");
              ref.current?.reset();
            }}
            onError={() => {
              onToken("");
              setMessage("Bot check could not load. You can still continue without it.");
            }}
            onUnsupported={() => {
              onToken("");
              setMessage("Bot check is unavailable here. You can still continue without it.");
            }}
          />
        ) : null}
      </div>
      {message ? (
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}

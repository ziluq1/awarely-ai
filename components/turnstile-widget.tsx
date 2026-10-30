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
  const [message, setMessage] = useState("Checking your browser…");
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
    queueMicrotask(() => setMessage("Checking your browser…"));
  }, [resetSignal, onToken]);

  if (!siteKey) {
    return (
      <p role="alert" className="rounded-2xl bg-blush px-4 py-3 text-sm leading-relaxed text-blush-text">
        Bot protection is not configured. Add NEXT_PUBLIC_TURNSTILE_SITE_KEY, then restart the app.
      </p>
    );
  }

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
              setMessage("The bot-protection check expired. It is checking again.");
              ref.current?.reset();
            }}
            onError={() => {
              onToken("");
              setMessage("The bot-protection check failed. Refresh the page and try again.");
            }}
          />
        ) : null}
      </div>
      <p role="status" aria-live="polite" className={message ? "text-sm text-muted" : "sr-only"}>
        {message || "Bot-protection check complete."}
      </p>
    </div>
  );
}

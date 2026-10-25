"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      size: "compact" | "flexible";
      theme: "auto";
      "response-field": false;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget({
  action,
  resetSignal,
  onToken,
}: {
  action: "login" | "signup" | "forgot";
  resetSignal: number;
  onToken: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [scriptReady, setScriptReady] = useState(false);
  const [widgetSize, setWidgetSize] = useState<"compact" | "flexible" | null>(null);
  const [message, setMessage] = useState("Checking your browser…");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? container.clientWidth;
      setWidgetSize(width < 300 ? "compact" : "flexible");
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!scriptReady || !siteKey || !widgetSize || !containerRef.current || !window.turnstile || widgetIdRef.current) return;

    const fail = () => {
      onTokenRef.current("");
      setMessage("The bot-protection check needs another try.");
    };
    const refresh = () => {
      onTokenRef.current("");
      setMessage("Checking your browser…");
      const widgetId = widgetIdRef.current;
      if (widgetId) queueMicrotask(() => window.turnstile?.reset(widgetId));
    };
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      size: widgetSize,
      theme: "auto",
      "response-field": false,
      callback(token) {
        onTokenRef.current(token);
        setMessage("");
      },
      "error-callback": fail,
      "expired-callback": refresh,
      "timeout-callback": refresh,
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
      onTokenRef.current("");
    };
  }, [action, scriptReady, siteKey, widgetSize]);

  useEffect(() => {
    if (!widgetIdRef.current || !window.turnstile) return;
    window.turnstile.reset(widgetIdRef.current);
    onTokenRef.current("");
    setMessage("Checking your browser…");
  }, [resetSignal]);

  if (!siteKey) {
    return (
      <p role="alert" className="rounded-2xl bg-blush px-4 py-3 text-sm leading-relaxed text-blush-text">
        Bot protection is not configured. Try again later.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
        onError={() => setMessage("The bot-protection check could not load. Check your connection and try again.")}
      />
      <div
        ref={containerRef}
        className={`flex w-full justify-center overflow-hidden rounded-2xl ${widgetSize === "compact" ? "min-h-[140px]" : "min-h-[65px]"}`}
      />
      {message ? (
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {message}
        </p>
      ) : (
        <p className="sr-only" role="status" aria-live="polite">
          Bot-protection check complete.
        </p>
      )}
    </div>
  );
}

"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef } from "react";

type TurnstileWidgetProps = {
  onSuccess: (token: string) => void;
  onClear: () => void;
};

export const TurnstileWidget = forwardRef<TurnstileInstance, TurnstileWidgetProps>(function TurnstileWidget(
  { onSuccess, onClear },
  ref,
) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (!siteKey) {
    return (
      <p className="rounded-2xl bg-blush px-4 py-3 text-sm text-blush-text" role="alert">
        Turnstile is not configured. Add NEXT_PUBLIC_TURNSTILE_SITE_KEY, then restart the app.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card/60 p-2">
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        options={{ theme: "light", size: "flexible" }}
        onSuccess={onSuccess}
        onExpire={onClear}
        onError={onClear}
      />
    </div>
  );
});

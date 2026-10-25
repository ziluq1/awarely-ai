const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TOKEN_MAX_LENGTH = 4096;
const VERIFY_TIMEOUT_MS = 8_000;
const TEST_SECRETS = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);

type SiteverifyResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "config" | "invalid" | "unavailable" };

export async function verifyTurnstile(input: {
  token: string;
  expectedAction: string;
  expectedHostname: string;
  remoteIp?: string;
}): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim() ?? "";
  if (!secret) return { ok: false, reason: "config" };
  const testing = process.env.NODE_ENV !== "production" && TEST_SECRETS.has(secret);

  const token = input.token.trim();
  if (!token || token.length > TOKEN_MAX_LENGTH) return { ok: false, reason: "invalid" };

  const body = new URLSearchParams({
    secret,
    response: token,
    idempotency_key: crypto.randomUUID(),
  });
  if (input.remoteIp) body.set("remoteip", input.remoteIp);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    const result = (await response.json()) as SiteverifyResponse;
    if (!result.success) {
      const errors = result["error-codes"] ?? [];
      if (errors.includes("missing-input-secret") || errors.includes("invalid-input-secret")) {
        return { ok: false, reason: "config" };
      }
      return { ok: false, reason: response.ok ? "invalid" : "unavailable" };
    }
    if (result.action !== input.expectedAction && !(testing && !result.action)) {
      return { ok: false, reason: "invalid" };
    }
    if (!hostnameMatches(result.hostname, input.expectedHostname, testing)) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

function hostnameMatches(received: string | undefined, expected: string, testing: boolean): boolean {
  if (received === expected) return true;
  return testing && (received === "example.com" || received === "dummy-key-pass");
}

export function requestIp(headers: Headers): string | undefined {
  const cloudflare = headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || undefined;
}

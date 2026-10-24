const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 8;

const buckets = new Map<string, number[]>();

export const RATE_LIMIT_KEY = "process";

export function consumeModelCall(
  key: string,
  now = Date.now(),
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const recent = (buckets.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((recent[0]! + WINDOW_MS - now) / 1000));
    buckets.set(key, recent);
    return { ok: false, retryAfterSeconds };
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 1000) {
    const oldest = buckets.keys().next().value;
    if (oldest) buckets.delete(oldest);
  }
  return { ok: true };
}

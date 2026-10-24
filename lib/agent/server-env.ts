// Dynamic lookup so Next.js does not inline these values during `next build`.
// A direct `process.env.NAME` read can freeze the build-time value into the server bundle.

export function serverEnv(name: string): string {
  const env = process.env;
  const raw = env[name];
  if (typeof raw !== "string") return "";
  let value = raw.trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

export function modelCallsEnabled(): boolean {
  return serverEnv("MODEL_CALLS_ENABLED").toLowerCase() === "true";
}

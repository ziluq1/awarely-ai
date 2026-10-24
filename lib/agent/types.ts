export type ToolReport = {
  name: string;
  status: "completed" | "rejected";
  summary: string;
};

export type SafetyFlag = {
  level: "clear" | "uncertain";
  immediateDanger: boolean;
};

export type CompanionSuccess = {
  ok: true;
  source: "model" | "safety";
  provider?: "groq" | "gemini";
  message: string;
  tool: ToolReport | null;
  safety: SafetyFlag | null;
};

export type CompanionFailureCode =
  | "disabled"
  | "unconfigured"
  | "invalid"
  | "rate_limited"
  | "provider"
  | "timeout";

export type CompanionFailure = {
  ok: false;
  code: CompanionFailureCode;
  message: string;
  tool: ToolReport | null;
  exhausted?: boolean;
};

export type CompanionResponse = CompanionSuccess | CompanionFailure;

export type CompanionStatus =
  | { available: true; model: string; fallback: string | null }
  | { available: false; reason: "disabled" | "unconfigured" };

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

const TOOL_STATUSES = new Set(["completed", "rejected"]);
const FAILURE_CODES = new Set([
  "disabled",
  "unconfigured",
  "invalid",
  "rate_limited",
  "provider",
  "timeout",
]);

function isToolReport(value: unknown): value is ToolReport {
  if (!value || typeof value !== "object") return false;
  const report = value as ToolReport;
  return (
    typeof report.name === "string" &&
    report.name.length > 0 &&
    report.name.length <= 80 &&
    TOOL_STATUSES.has(report.status) &&
    typeof report.summary === "string" &&
    report.summary.length > 0 &&
    report.summary.length <= 2000
  );
}

export function isCompanionResponse(value: unknown): value is CompanionResponse {
  if (!value || typeof value !== "object") return false;
  const body = value as CompanionResponse;
  if (body.tool !== null && !isToolReport(body.tool)) return false;
  if (typeof body.message !== "string" || body.message.length === 0 || body.message.length > 4000) return false;
  if (body.ok === true) {
    if (body.source !== "model" && body.source !== "safety") return false;
    if (body.source === "model" && body.provider !== "groq" && body.provider !== "gemini") return false;
    if (body.source === "safety" && body.provider != null) return false;
    if (body.safety === null) return body.source === "model";
    return (
      !!body.safety &&
      (body.safety.level === "clear" || body.safety.level === "uncertain") &&
      typeof body.safety.immediateDanger === "boolean"
    );
  }
  if (body.ok === false) return FAILURE_CODES.has(body.code);
  return false;
}

export function isCompanionStatus(value: unknown): value is CompanionStatus {
  if (!value || typeof value !== "object") return false;
  const body = value as CompanionStatus;
  if (body.available === true) {
    const fallbackOk = body.fallback === null || (typeof body.fallback === "string" && body.fallback.length > 0 && body.fallback.length <= 80);
    return typeof body.model === "string" && body.model.length > 0 && body.model.length <= 80 && fallbackOk;
  }
  if (body.available === false) return body.reason === "disabled" || body.reason === "unconfigured";
  return false;
}

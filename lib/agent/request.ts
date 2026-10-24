import type { ChatTurn } from "@/lib/agent/types";
import { COMPANION_NOTE_LIMIT } from "@/lib/types";

export const HISTORY_LIMIT = 8;
export const REQUEST_BODY_LIMIT = 12_000;

const IMAGE_DATA = /data:image\/|base64,/i;

export type CompanionInput = {
  message: string;
  history: ChatTurn[];
};

export function parseCompanionRequest(value: unknown): { ok: true; input: CompanionInput } | { ok: false; message: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "Send a message as JSON." };
  }
  const body = value as { message?: unknown; history?: unknown };
  const message = cleanText(body.message, COMPANION_NOTE_LIMIT);
  if (!message) {
    return { ok: false, message: `Write a message of 1 to ${COMPANION_NOTE_LIMIT} characters.` };
  }
  if (IMAGE_DATA.test(message)) {
    return { ok: false, message: "Remove image data from the message. Photos are not sent to the model." };
  }
  if (body.history === undefined) return { ok: true, input: { message, history: [] } };
  if (!Array.isArray(body.history) || body.history.length > HISTORY_LIMIT) {
    return { ok: false, message: `History can include at most ${HISTORY_LIMIT} messages.` };
  }

  const history: ChatTurn[] = [];
  for (const item of body.history) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, message: "Each history item needs a role and text." };
    }
    const turn = item as { role?: unknown; content?: unknown };
    if (turn.role !== "user" && turn.role !== "assistant") {
      return { ok: false, message: "History can include only user and assistant messages." };
    }
    const content = cleanText(turn.content, COMPANION_NOTE_LIMIT);
    if (!content || IMAGE_DATA.test(content)) {
      return { ok: false, message: "History text must be plain words, without image data." };
    }
    history.push({ role: turn.role, content });
  }

  return { ok: true, input: { message, history } };
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > max) return null;
  return text;
}

import type { ChatTurn } from "@/lib/agent/types";

export const LIFELINE_LABEL = "988 Suicide & Crisis Lifeline — Call or text 988 (US)";
export const LIFELINE_URL = "https://988lifeline.org/";

export const CRISIS_MESSAGE =
  "Thank you for telling me. You deserve care, and you do not have to hold this alone. Please contact the 988 Suicide & Crisis Lifeline — Call or text 988 (US). You can also visit https://988lifeline.org/. If you can, tell a person you trust what is happening. If you are in immediate danger, contact local emergency services. awarely.ai cannot monitor you or send emergency help. This notice is fixed text, not a reply from a model.";

export const UNCERTAIN_NOTE =
  "If you meant that you feel low, we can stay with that. If you might hurt yourself, or you are in immediate danger, contact a person you trust or local emergency services.";

export type SafetyLevel = "ordinary" | "uncertain" | "clear";

export type SafetyAssessment = {
  level: SafetyLevel;
  immediateDanger: boolean;
};

const CLEAR_PATTERNS = [
  /\b(kill myself|killing myself|end my life|end myself|take my own life|off myself)\b/,
  /\b(want to die|wanna die|wish i (?:was|were) dead|rather be dead)\b/,
  /\b(suicide|suicidal|sucide|suiside)\b/,
  /\b(self harm|self harming|hurt myself|hurting myself|harm myself|harming myself|cut myself|cutting myself)\b/,
  /\b(do not want to (?:live|be alive|exist)|don't want to (?:live|be alive|exist)|dont want to (?:live|be alive|exist)|better off dead)\b/,
  /\b(no reason to live|no point (?:in )?living|end it all|just end it)\b/,
  /\b(overdose|noose|hang myself|shoot myself|unalive|kms)\b/,
  /\bjump off (?:a |the )?(?:bridge|building|roof)\b/,
  /\bi have a gun\b/,
];

const UNCERTAIN_PATTERNS = [
  /\bhopeless\b/,
  /\b(?:can't|cannot|cant) go on\b/,
  /\b(?:don't|dont|do not) want to be here\b/,
  /\b(?:nobody|no one) would (?:care|miss)\b/,
  /\b(?:can't|cannot|cant) take (?:it|this) anymore\b/,
  /\bwant to disappear\b/,
];

const IMMEDIATE_PATTERNS = [
  /\b(?:being attacked|attacking me|trying to kill me|hurting me right now|in immediate danger)\b/,
  /\bsomeone is (?:hurting|attacking|chasing) me\b/,
];

const HARMFUL_REPLY = [
  /\b(?:how to|ways to|steps to|instructions for)\b[\s\S]{0,80}\b(?:kill yourself|commit suicide|end your life|overdose|cut yourself)\b/i,
  /\b(?:tie|tying) (?:a )?noose\b/i,
  /\bslit (?:your|their) (?:wrists|throat)\b/i,
  /\bhow many (?:pills|tablets)\b/i,
];

const INTERVENTION_CLAIM =
  /\bI (?:can|will|'ll|am able to) (?:monitor|watch over|call (?:emergency|911|the police)|send (?:help|someone)|contact emergency)\b/i;

const MODEL_CONFIRMS = [
  /\b(?:thinking (?:about|of) (?:suicide|killing yourself)|plan to (?:hurt|kill) yourself)\b/i,
  /\b(?:call|contact|text)\b[\s\S]{0,40}\b(?:988|emergency services|crisis line)\b/i,
];

export function assessSafety(message: string, history: ChatTurn[] = []): SafetyAssessment {
  const current = classify(message);
  if (current.level === "clear") return current;

  const prior = history
    .filter((turn) => turn.role === "user")
    .slice(-4)
    .map((turn) => classify(turn.content));
  const priorClear = prior.some((item) => item.level === "clear");
  if (current.level === "uncertain" && priorClear) {
    return {
      level: "clear",
      immediateDanger: current.immediateDanger || prior.some((item) => item.immediateDanger),
    };
  }
  return current;
}

export function modelSignalsCrisis(reply: string): boolean {
  return MODEL_CONFIRMS.some((pattern) => pattern.test(reply));
}

export function guardModelReply(reply: string): { text: string; blocked: boolean } {
  if (HARMFUL_REPLY.some((pattern) => pattern.test(reply))) {
    return { text: CRISIS_MESSAGE, blocked: true };
  }
  if (!INTERVENTION_CLAIM.test(reply)) return { text: reply, blocked: false };
  const kept = reply
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !INTERVENTION_CLAIM.test(sentence))
    .join(" ")
    .trim();
  const text = kept
    ? `${kept} awarely.ai cannot monitor you or send help.`
    : "awarely.ai cannot monitor you or send help.";
  return { text, blocked: false };
}

function classify(raw: string): SafetyAssessment & { level: SafetyLevel } {
  const text = normalize(raw);
  const immediateDanger = IMMEDIATE_PATTERNS.some((pattern) => pattern.test(text));
  if (immediateDanger) return { level: "clear", immediateDanger: true };

  let sawNegatedClear = false;
  for (const pattern of CLEAR_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    if (negated(text, match.index)) {
      sawNegatedClear = true;
      continue;
    }
    return { level: "clear", immediateDanger: false };
  }

  if (sawNegatedClear || UNCERTAIN_PATTERNS.some((pattern) => pattern.test(text))) {
    return { level: "uncertain", immediateDanger: false };
  }
  return { level: "ordinary", immediateDanger: false };
}

function negated(text: string, index: number): boolean {
  const window = text.slice(Math.max(0, index - 28), index);
  return /\b(?:not|never|no|without)\b/.test(window) || /n't\b/.test(window);
}

function normalize(raw: string): string {
  const compact = raw
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/\b(?:[a-z0-9@!]\s+){4,}[a-z0-9@!]\b/g, (spaced) => spaced.replace(/\s+/g, ""))
    .replace(/[a-z0-9@!]{2,}/g, (token) => {
      if (!/[a-z]/.test(token) || !/[0-9@!]/.test(token)) return token;
      return token
        .replace(/0/g, "o")
        .replace(/1/g, "i")
        .replace(/3/g, "e")
        .replace(/4/g, "a")
        .replace(/5/g, "s")
        .replace(/7/g, "t")
        .replace(/@/g, "a")
        .replace(/!/g, "i");
    })
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return compact
    .replace(/\b(?:killing me|this is killing|work is killing)\b/g, " ")
    .replace(/\b(?:died|dying) (?:laughing|of laughter)\b/g, " ")
    .replace(/\bdead (?:tired|exhausted|asleep)\b/g, " ")
    .replace(/\b(?:scared|bored|sick|frightened) to death\b/g, " ")
    .replace(/\bto die for\b/g, " ")
    .replace(/\btake my life back\b/g, " ")
    .replace(/\bmy self\b/g, "myself")
    .replace(/\bselfharming\b/g, "self harming")
    .replace(/\bselfharm\b/g, "self harm")
    .replace(/\s+/g, " ")
    .trim();
}

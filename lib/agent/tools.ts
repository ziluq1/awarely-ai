import type { ChatCompletionTool } from "groq-sdk/resources/chat/completions";
import type { ToolReport } from "@/lib/agent/types";

export const TOOL_NAMES = [
  "guided_grounding",
  "journaling_prompt",
  "break_down_task",
  "mood_reflection",
  "suggest_next_step",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

const GROUNDING_FOCUS = ["breath", "senses", "body", "room"] as const;
const GROUNDING_DURATION = ["brief", "standard"] as const;
const JOURNAL_TONE = ["open", "specific"] as const;
const MOOD_WANT = ["notice", "name_a_need", "gentle_reframe"] as const;
const ENERGY = ["low", "some", "unknown"] as const;

const GROUNDING: Record<(typeof GROUNDING_FOCUS)[number], Record<(typeof GROUNDING_DURATION)[number], string>> = {
  breath: {
    brief: "Optional two-round breath: inhale for a count of four, exhale for a count of six. Stop whenever you want.",
    standard:
      "Optional four-round breath: inhale for a count of four, exhale for a count of six. Stop whenever you want.",
  },
  senses: {
    brief: "Optional: name one thing you can see and one thing you can feel where you are. There is no need to share them.",
    standard:
      "Optional: name one thing you can see, hear, and feel, and one thing you can smell or taste if you want. There is no need to share them.",
  },
  body: {
    brief: "Optional: rest your feet on the floor and unclench your hands. Stop whenever you want.",
    standard:
      "Optional: notice your feet on the floor, loosen your jaw, and drop your shoulders. Move only as much as feels comfortable, and stop whenever you want.",
  },
  room: {
    brief: "Optional: look around and name two ordinary objects you can see. This is about the room, not about you.",
    standard:
      "Optional: look around and name three ordinary objects, then notice one sound in the room. This is about the room, not about you.",
  },
};

export const WELLNESS_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "guided_grounding",
      description:
        "Offer a short optional grounding exercise when the user wants help settling. Do not use it to assess emotion or health.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          focus: { type: "string", enum: [...GROUNDING_FOCUS] },
          duration: { type: "string", enum: [...GROUNDING_DURATION] },
        },
        required: ["focus", "duration"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "journaling_prompt",
      description: "Offer one optional, open-ended reflection question. Do not turn it into advice about a diagnosis.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          theme: { type: "string", maxLength: 80 },
          tone: { type: "string", enum: [...JOURNAL_TONE] },
        },
        required: ["tone"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "break_down_task",
      description: "Divide an everyday task the user named into a few manageable steps.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          task: { type: "string", minLength: 1, maxLength: 120 },
          stepCount: { type: "integer", minimum: 3, maximum: 5 },
        },
        required: ["task", "stepCount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mood_reflection",
      description:
        "Help the user reflect on a feeling they explicitly described. Echo their words. Do not diagnose or infer a feeling they did not state.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          statedFeeling: { type: "string", minLength: 1, maxLength: 80 },
          want: { type: "string", enum: [...MOOD_WANT] },
        },
        required: ["statedFeeling", "want"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_next_step",
      description: "Offer one practical, low-pressure next action for a situation the user described.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          situation: { type: "string", minLength: 1, maxLength: 160 },
          energy: { type: "string", enum: [...ENERGY] },
        },
        required: ["situation", "energy"],
      },
    },
  },
];

export function resolveToolCall(name: string, rawArguments: string): ToolReport {
  const safeName = name.trim().slice(0, 80) || "unknown";
  if (!isToolName(safeName)) {
    return {
      name: safeName,
      status: "rejected",
      summary: "The tool was not run because that tool is not available.",
    };
  }
  if (rawArguments.length > 2000) {
    return rejected(safeName);
  }
  let parsed: unknown;
  try {
    parsed = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    return {
      name: safeName,
      status: "rejected",
      summary: "The tool was not run because its arguments were not valid JSON.",
    };
  }
  return runTool(safeName, parsed);
}

export function toolResultForModel(report: ToolReport, skipped: number): string {
  const extra =
    skipped > 0 ? ` ${skipped} other tool ${skipped === 1 ? "call was" : "calls were"} not executed.` : "";
  if (report.status === "rejected") {
    return `${report.summary}${extra} Do not say that a tool succeeded. Reply directly and briefly.`;
  }
  return `${report.summary}${extra} Use this result in a short, supportive reply. Do not add a diagnosis or a different exercise.`;
}

function runTool(name: ToolName, value: unknown): ToolReport {
  if (!isRecord(value)) return rejected(name);
  if (name === "guided_grounding") {
    const focus = oneOf(value.focus, GROUNDING_FOCUS);
    const duration = oneOf(value.duration, GROUNDING_DURATION);
    if (!focus || !duration || !exactKeys(value, ["focus", "duration"])) return rejected(name);
    return completed(name, GROUNDING[focus][duration]);
  }
  if (name === "journaling_prompt") {
    const tone = oneOf(value.tone, JOURNAL_TONE);
    const theme = optionalText(value.theme, 80);
    const keys = theme === undefined ? ["tone"] : ["theme", "tone"];
    if (!tone || theme === null || !exactKeys(value, keys)) return rejected(name);
    const subject = theme ? `“${theme}”` : "today";
    const summary =
      tone === "specific"
        ? `A question you can answer or skip: What is one concrete detail you remember about ${subject}?`
        : `A question you can answer or skip: What, if anything, feels worth noticing about ${subject}?`;
    return completed(name, summary);
  }
  if (name === "break_down_task") {
    const task = requiredText(value.task, 120);
    const stepCount = integerIn(value.stepCount, 3, 5);
    if (!task || !stepCount || !exactKeys(value, ["task", "stepCount"])) return rejected(name);
    const pool = [
      `Decide the smallest piece of “${task}” that would count as started.`,
      "Gather only what that piece needs.",
      "Spend about ten minutes on that piece, then pause.",
      "Write down what is left without finishing it all.",
      "Choose whether to stop or do one more small piece.",
    ];
    const lines = pool.slice(0, stepCount).map((step, index) => `${index + 1}. ${step}`);
    return completed(name, `A way to split “${task}” into ${stepCount} optional steps:\n${lines.join("\n")}`);
  }
  if (name === "mood_reflection") {
    const statedFeeling = requiredText(value.statedFeeling, 80);
    const want = oneOf(value.want, MOOD_WANT);
    if (!statedFeeling || !want || !exactKeys(value, ["statedFeeling", "want"])) return rejected(name);
    const quoted = `“${statedFeeling}”`;
    const summary =
      want === "notice"
        ? `You described feeling ${quoted}. You can notice that without explaining it. If you want, sense where it shows up in your body, or leave the words as they are.`
        : want === "name_a_need"
          ? `You described feeling ${quoted}. One question you can skip: would rest, food, quiet, company, or a smaller task help right now? You do not have to pick one.`
          : `You described feeling ${quoted}. A feeling can describe this moment. It does not have to define you, and it does not have to be solved right now.`;
    return completed(name, summary);
  }
  const situation = requiredText(value.situation, 160);
  const energy = oneOf(value.energy, ENERGY);
  if (!situation || !energy || !exactKeys(value, ["situation", "energy"])) return rejected(name);
  const quoted = `“${situation}”`;
  const summary =
    energy === "low"
      ? `A low-pressure step for ${quoted}: spend two minutes on a smaller version, such as opening it or writing one line. Stopping after that is enough.`
      : energy === "some"
        ? `A low-pressure step for ${quoted}: do the next visible action for about ten minutes, then decide whether to continue.`
        : `A low-pressure step for ${quoted}: write the next action in one sentence, then do only that. Leave the rest for later.`;
  return completed(name, summary);
}

function completed(name: ToolName, summary: string): ToolReport {
  return { name, status: "completed", summary };
}

function rejected(name: string): ToolReport {
  return {
    name,
    status: "rejected",
    summary: "The tool was not run because its arguments did not match the expected shape.",
  };
}

function isToolName(value: string): value is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function requiredText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  if (!text || text.length > max) return null;
  return text;
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  return requiredText(value, max);
}

function integerIn(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) return null;
  return value;
}

import { assessSafety, CRISIS_MESSAGE } from "@/lib/agent/safety";
import { COMPANION_NOTE_LIMIT } from "@/lib/types";

export type ExerciseId = "breath" | "senses" | "shoulders" | "kind";

export type PreparedReply = {
  kind: "practice" | "support" | "clarify";
  body: string;
  steps: string[];
  exerciseId?: ExerciseId;
  immediateDanger?: boolean;
};

export type Suggestion = {
  id: string;
  label: string;
};

export const SUGGESTED_QUESTIONS: Suggestion[] = [
  { id: "stands-out", label: "What stands out in this moment?" },
  { id: "steady", label: "What feels steady right now?" },
  { id: "remember", label: "What would I like to remember?" },
  { id: "ease", label: "Where do I notice ease?" },
  { id: "support", label: "What is one small support?" },
];

export const EXERCISES: Array<Suggestion & { id: ExerciseId; match: string; summary: string }> = [
  {
    id: "breath",
    label: "Soft breathing pace",
    match: "breath",
    summary: "A slow count of four breaths in and six breaths out.",
  },
  {
    id: "senses",
    label: "Notice five senses",
    match: "sense",
    summary: "Name one thing you can see, hear, touch, smell, and taste.",
  },
  {
    id: "shoulders",
    label: "Unclench and drop",
    match: "shoulder",
    summary: "Relax the jaw and let the shoulders fall.",
  },
  {
    id: "kind",
    label: "A kind sentence",
    match: "kind",
    summary: "Offer yourself one sentence you might offer a friend.",
  },
];

const QUESTION_REPLIES: Record<string, PreparedReply> = {
  "stands-out": {
    kind: "practice",
    body: "Stay with one detail, rather than the whole day. It might be a color, a sound, a sentence, or the fact that you paused.",
    steps: [
      "Name the detail in plain words.",
      "Ask what about it you want to remember.",
      "If you want a record, write it in your reflection. This companion does not save the chat.",
    ],
  },
  steady: {
    kind: "practice",
    body: "Steady can be small. A chair, a routine, a person, or the fact that this minute is already underway.",
    steps: [
      "Choose one thing that is holding.",
      "Notice how you know that, using your own words.",
      "You do not need to explain the rest of the day.",
    ],
  },
  remember: {
    kind: "practice",
    body: "Memory does not have to be a highlight. It can be an ordinary detail you do not want to rush past.",
    steps: [
      "Pick one detail worth keeping.",
      "If a photo would help, add one on the capture page. It will not be interpreted.",
      "Write the detail only if you want it on your timeline.",
    ],
  },
  ease: {
    kind: "practice",
    body: "Ease might show up as a softer jaw, a warmer room, or a slower breath. If you do not notice ease, that is a valid answer too.",
    steps: [
      "Scan without trying to change anything.",
      "If you find ease, name where it is.",
      "If you do not, you can stop here or choose another exercise.",
    ],
  },
  support: {
    kind: "practice",
    body: "Support can be practical: water, a window, a message you already received, or a few quiet minutes.",
    steps: [
      "Name one support that is already available.",
      "Decide whether you want to use it in the next few minutes.",
      "Leave the rest for later.",
    ],
  },
};

const EXERCISE_REPLIES: Record<ExerciseId, PreparedReply> = {
  breath: {
    kind: "practice",
    exerciseId: "breath",
    body: "This is a pacing guide for four rounds: breathe in for 4, then out for 6. Stop if you feel dizzy or uncomfortable. It is not a treatment.",
    steps: [
      "Sit or stand in a way that feels workable.",
      "Follow the count, or ignore it and breathe in your own time.",
      "When the rounds end, notice whether you want to stop or write a line.",
    ],
  },
  senses: {
    kind: "practice",
    exerciseId: "senses",
    body: "Name five nearby details, one for each sense. Skip any sense you do not want to use. This is a noticing exercise, not a test.",
    steps: [
      "See: one thing in view.",
      "Hear: one sound.",
      "Touch: one sensation, such as your feet on the floor.",
      "Smell: one scent, or note that none stands out.",
      "Taste: one taste, or simply notice your mouth.",
    ],
  },
  shoulders: {
    kind: "practice",
    exerciseId: "shoulders",
    body: "A short body check for the jaw and shoulders. Move only as much as you want. Stop if anything hurts.",
    steps: [
      "Unclench the jaw, or notice if it is already soft.",
      "Let the shoulders drop a little.",
      "Rest the hands somewhere comfortable.",
    ],
  },
  kind: {
    kind: "practice",
    exerciseId: "kind",
    body: "Write one sentence you could honestly offer a friend in a similar moment. You do not have to believe it perfectly for it to be useful.",
    steps: [
      "Keep the sentence short.",
      "Avoid advice you would not want to hear.",
      "If you want to keep it, add it to a reflection yourself.",
    ],
  },
};

export function replyToNote(note: string, earlierNotes: string[] = []): PreparedReply {
  const text = note.trim();
  if (!text) {
    throw new Error("Write a note or choose a suggestion first.");
  }
  if (text.length > COMPANION_NOTE_LIMIT) {
    throw new Error("Companion notes can be up to 600 characters. A journal reflection can hold more.");
  }
  const assessment = assessSafety(
    text,
    earlierNotes.map((content) => ({ role: "user" as const, content })),
  );
  if (assessment.level === "clear") return supportReply(assessment.immediateDanger);
  if (assessment.level === "uncertain") return clarifyReply();

  const question = SUGGESTED_QUESTIONS.find((item) => item.label.toLowerCase() === text.toLowerCase());
  if (question) return QUESTION_REPLIES[question.id];

  const exercise = EXERCISES.find((item) => text.toLowerCase().includes(item.match));
  if (exercise) return EXERCISE_REPLIES[exercise.id];

  return mirror(text);
}

export function replyForQuestion(id: string): PreparedReply {
  const reply = QUESTION_REPLIES[id];
  if (!reply) throw new Error("That question is not in the prepared set.");
  return reply;
}

export function replyForExercise(id: ExerciseId): PreparedReply {
  const reply = EXERCISE_REPLIES[id];
  if (!reply) throw new Error("That exercise is not in the prepared set.");
  return reply;
}

export function questionLabel(id: string): string {
  return SUGGESTED_QUESTIONS.find((item) => item.id === id)?.label ?? "Reflection question";
}

export function exerciseLabel(id: ExerciseId): string {
  return EXERCISES.find((item) => item.id === id)?.label ?? "Wellness exercise";
}

function supportReply(immediateDanger: boolean): PreparedReply {
  return {
    kind: "support",
    immediateDanger,
    body: CRISIS_MESSAGE,
    steps: [],
  };
}

function clarifyReply(): PreparedReply {
  return {
    kind: "clarify",
    body: "This is a prepared check-in because the model is not replying. What feels closest to what you meant?",
    steps: [],
  };
}

function mirror(text: string): PreparedReply {
  const snippet = text.length > 160 ? `${text.slice(0, 157)}…` : text;
  return {
    kind: "practice",
    body: `Thank you for putting that in your own words. This companion does not interpret what you wrote, and it cannot see your photos.\n\nYou wrote: “${snippet}”\n\nIf you want to stay with it, you might ask what part you want to remember, and what would feel supportive in the next few minutes. Those answers are yours.`,
    steps: [
      "Notice one detail you can sense from where you are.",
      "If you want a record, write it in a reflection. This chat is not saved.",
    ],
  };
}

export const APPEARANCE_KEY = "mindmate.appearance.v1";
export const APPEARANCE_EVENT = "mindmate-appearance";
export const DEFAULT_ACCENT = "#7c6a9a";

export const APPEARANCES = [
  { id: "light", label: "Light", detail: "Bright paper" },
  { id: "dark", label: "Dark", detail: "Dim surroundings" },
] as const;

export const THEMES = [
  { id: "default", label: "Default", detail: "Warm paper and soft lavender." },
  { id: "cream", label: "Calm Cream", detail: "Warm cream and beige." },
  { id: "sage", label: "Sage", detail: "A quiet green wash." },
  { id: "lavender", label: "Lavender", detail: "A cooler violet palette." },
  { id: "ocean", label: "Ocean", detail: "Soft blue and gray." },
  { id: "custom", label: "Custom", detail: "An accent color you choose." },
] as const;

export type AppearanceChoice = (typeof APPEARANCES)[number]["id"];
export type ThemeId = (typeof THEMES)[number]["id"];
export type ColorMode = "light" | "dark";

export type AppearancePreference = {
  appearance: AppearanceChoice;
  theme: ThemeId;
  accent: string;
};

export const DEFAULT_PREFERENCE: AppearancePreference = {
  appearance: "light",
  theme: "default",
  accent: DEFAULT_ACCENT,
};

type TokenMap = Record<
  | "--background"
  | "--foreground"
  | "--card"
  | "--muted"
  | "--line"
  | "--accent"
  | "--accent-text"
  | "--sage"
  | "--sage-text"
  | "--blush"
  | "--blush-text"
  | "--danger"
  | "--inverse"
  | "--inverse-text"
  | "--camera",
  string
>;

export function normalizePreference(value: unknown): AppearancePreference {
  const record = value && typeof value === "object" ? (value as Partial<AppearancePreference>) : {};
  const appearance = record.appearance === "dark" || record.appearance === "light" ? record.appearance : "light";
  const theme = THEMES.some((item) => item.id === record.theme) ? (record.theme as ThemeId) : "default";
  const accent = normalizeAccent(record.accent);
  return { appearance, theme, accent };
}

export function normalizeAccent(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_ACCENT;
  const match = /^#([0-9a-fA-F]{6})$/.exec(value.trim());
  return match ? `#${match[1].toLowerCase()}` : DEFAULT_ACCENT;
}

export function readPreference(): AppearancePreference {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (!raw) return DEFAULT_PREFERENCE;
    return normalizePreference(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

export function writePreference(preference: AppearancePreference): void {
  const next = normalizePreference(preference);
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(APPEARANCE_EVENT));
}

export function resolveMode(appearance: AppearanceChoice): ColorMode {
  return appearance === "dark" ? "dark" : "light";
}

export function tokensFor(theme: string, mode: string, accent: string): TokenMap {
  const named: Record<string, { light: TokenMap; dark: TokenMap }> = {
    default: {
      light: palette("#f7f3ec", "#241f2b", "#fffcf8", "#4e463f", "#8f8376", "#ebe4f6", "#3f345c", "#e5f0e6", "#1e4634", "#f8e8e2", "#6a332c", "#8a2f3a", "#3f345c", "#fbf8f4", "#241f2b"),
      dark: palette("#121212", "#f6f3ee", "#1e1c22", "#d4cdc4", "#9a90a4", "#3a334c", "#f3e9ff", "#24352d", "#dff3e4", "#3c2a2e", "#ffd8d2", "#ffb4bc", "#efe6ff", "#24182f", "#121212"),
    },
    cream: {
      light: palette("#f6efe6", "#2a2118", "#fffaf4", "#5c4e42", "#8d7b68", "#f0e2cc", "#5a3e24", "#e7efe4", "#1e4634", "#f8e6dc", "#6a332c", "#8a2f3a", "#6b4e32", "#fffaf4", "#2a2118"),
      dark: palette("#121212", "#f6f1ea", "#221e1a", "#ddd4c8", "#a89884", "#3a3228", "#f6e6d0", "#243028", "#dff3e4", "#3a2c28", "#ffd8d0", "#ffb4bc", "#f0e2cc", "#2a2118", "#121212"),
    },
    sage: {
      light: palette("#f2f6f2", "#1a2820", "#fbfdfb", "#3e5248", "#6f8578", "#d5eadc", "#1a4632", "#dceadf", "#1a4632", "#f8e8e2", "#6a332c", "#8a2f3a", "#1e4634", "#f4faf6", "#1a2820"),
      dark: palette("#121212", "#eef5f0", "#1a221e", "#d5e4da", "#8aab98", "#24382e", "#d9f5e4", "#1e3328", "#dff6e8", "#3a2c2e", "#ffd8d2", "#ffb4bc", "#d7f0e2", "#13241c", "#121212"),
    },
    lavender: {
      light: palette("#f5f1f8", "#261f30", "#fcfaff", "#51445f", "#8a7a98", "#e6d9f4", "#4c3568", "#e5f0e6", "#1e4634", "#f8e8e2", "#6a332c", "#8a2f3a", "#4c3568", "#fbf7ff", "#261f30"),
      dark: palette("#121212", "#f4f0f8", "#1e1a24", "#ddd4e8", "#a090b4", "#3a314c", "#f1e4ff", "#24352d", "#dff3e4", "#3c2a2e", "#ffd8d2", "#ffb4bc", "#eadfff", "#2a1c3d", "#121212"),
    },
    ocean: {
      light: palette("#f1f6f8", "#172830", "#f8fcfd", "#3d5560", "#6d8794", "#d3e7f0", "#1a4558", "#e3f0e8", "#1e4634", "#f8e8e2", "#6a332c", "#8a2f3a", "#1a4558", "#f4fafc", "#172830"),
      dark: palette("#121212", "#eef4f6", "#1a2024", "#d2e0e6", "#8aa4b2", "#1e3642", "#d7eef8", "#1e3028", "#dff3e4", "#3a2c2e", "#ffd8d2", "#ffb4bc", "#d4eaf3", "#102832", "#121212"),
    },
  };
  const colorMode = mode === "dark" ? "dark" : "light";
  if (theme === "custom") return customPalette(normalizeAccent(accent), colorMode);
  const choice = named[theme] ? theme : "default";
  return named[choice][colorMode];
}

export function applyAppearance(root: HTMLElement, preference: AppearancePreference): void {
  const mode = resolveMode(preference.appearance);
  const tokens = tokensFor(preference.theme, mode, preference.accent);
  root.dataset.appearance = preference.appearance;
  root.dataset.theme = preference.theme;
  root.dataset.mode = mode;
  root.style.colorScheme = mode;
  for (const key of Object.keys(tokens) as Array<keyof TokenMap>) {
    root.style.setProperty(key, tokens[key]);
  }
  const themeColor = tokens["--background"];
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute("content", themeColor);
  });
}

function palette(
  background: string,
  foreground: string,
  card: string,
  muted: string,
  line: string,
  accent: string,
  accentText: string,
  sage: string,
  sageText: string,
  blush: string,
  blushText: string,
  danger: string,
  inverse: string,
  inverseText: string,
  camera: string,
): TokenMap {
  return {
    "--background": background,
    "--foreground": foreground,
    "--card": card,
    "--muted": muted,
    "--line": line,
    "--accent": accent,
    "--accent-text": accentText,
    "--sage": sage,
    "--sage-text": sageText,
    "--blush": blush,
    "--blush-text": blushText,
    "--danger": danger,
    "--inverse": inverse,
    "--inverse-text": inverseText,
    "--camera": camera,
  };
}

function customPalette(accent: string, mode: "light" | "dark"): TokenMap {
  if (mode === "light") {
    const background = untilLum(mix(accent, "#f7f4ef", 0.9), 0.9, "#ffffff", "min");
    const card = untilLum(mix(accent, "#fffdfb", 0.95), 0.94, "#ffffff", "min");
    const accentSurface = untilLum(mix(accent, "#fffdfb", 0.78), 0.84, "#ffffff", "min");
    const foreground = "#241f2b";
    const inverseText = "#fbf8f4";
    return palette(
      background,
      foreground,
      card,
      mutedFor(foreground, background, card),
      lineFor(foreground, background, card),
      accentSurface,
      readable(accent, [accentSurface, background, card]),
      "#e5f0e6",
      "#1e4634",
      "#f8e8e2",
      "#6a332c",
      "#8a2f3a",
      untilContrast(accent, inverseText, 4.5, "#14110f"),
      inverseText,
      foreground,
    );
  }
  const background = "#121212";
  const card = untilLum(mix("#1a1a1a", accent, 0.22), 0.06, "#161616", "max");
  const accentSurface = untilLum(mix("#1a1a1a", accent, 0.4), 0.12, "#121212", "max");
  const foreground = "#f6f3ee";
  const inverseText = "#1a1614";
  return palette(
    background,
    foreground,
    card,
    mutedFor(foreground, background, card),
    lineFor(foreground, background, card),
    accentSurface,
    readable(accent, [accentSurface, background, card]),
    "#24352d",
    "#dff3e4",
    "#3c2a2e",
    "#ffd8d2",
    "#ffb4bc",
    untilContrast(mix(accent, "#ffffff", 0.78), inverseText, 4.5, "#ffffff"),
    inverseText,
    "#121212",
  );
}

function lin(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function rgb(color: string): [number, number, number] {
  return [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
}

function hex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function luminance(color: string): number {
  const [red, green, blue] = rgb(color);
  return 0.2126 * lin(red) + 0.7152 * lin(green) + 0.0722 * lin(blue);
}

function contrast(first: string, second: string): number {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function mix(first: string, second: string, weight: number): string {
  const [ar, ag, ab] = rgb(first);
  const [br, bg, bb] = rgb(second);
  return hex(ar * (1 - weight) + br * weight, ag * (1 - weight) + bg * weight, ab * (1 - weight) + bb * weight);
}

function untilLum(color: string, bound: number, toward: string, direction: "min" | "max"): string {
  let current = color;
  for (let step = 0; step < 24; step += 1) {
    const level = luminance(current);
    if (direction === "max" && level <= bound) return current;
    if (direction === "min" && level >= bound) return current;
    current = mix(current, toward, 0.22);
  }
  return current;
}

function untilContrast(color: string, text: string, minimum: number, toward: string): string {
  let current = color;
  for (let step = 0; step < 28 && contrast(text, current) < minimum; step += 1) {
    current = mix(current, toward, 0.18);
  }
  return current;
}

function readable(seed: string, backgrounds: string[], minimum = 4.5): string {
  const lighter = walk(seed, "#ffffff", backgrounds, minimum);
  if (lighter) return lighter;
  const darker = walk(seed, "#14110f", backgrounds, minimum);
  if (darker) return darker;
  return contrast("#fbf8f4", backgrounds[0]) >= contrast("#1a1614", backgrounds[0]) ? "#fbf8f4" : "#1a1614";
}

function walk(seed: string, target: string, backgrounds: string[], minimum: number): string | null {
  let color = seed;
  for (let step = 0; step < 32; step += 1) {
    if (backgrounds.every((background) => contrast(color, background) >= minimum)) return color;
    color = mix(color, target, 0.16);
  }
  return backgrounds.every((background) => contrast(color, background) >= minimum) ? color : null;
}

function lineFor(foreground: string, background: string, card: string): string {
  let color = mix(foreground, background, 0.45);
  for (let step = 0; step < 24; step += 1) {
    if (contrast(color, background) >= 3 && contrast(color, card) >= 3) return color;
    color = mix(color, foreground, 0.16);
  }
  return foreground;
}

function mutedFor(foreground: string, background: string, card: string): string {
  let color = mix(foreground, background, 0.35);
  for (let step = 0; step < 24; step += 1) {
    if (contrast(color, background) >= 4.5 && contrast(color, card) >= 4.5) return color;
    color = mix(color, foreground, 0.14);
  }
  return foreground;
}

export const APPEARANCE_BOOT = `(function(){
  var palette = ${palette.toString()};
  var customPalette = ${customPalette.toString()};
  var lin = ${lin.toString()};
  var rgb = ${rgb.toString()};
  var hex = ${hex.toString()};
  var luminance = ${luminance.toString()};
  var contrast = ${contrast.toString()};
  var mix = ${mix.toString()};
  var untilLum = ${untilLum.toString()};
  var untilContrast = ${untilContrast.toString()};
  var readable = ${readable.toString()};
  var walk = ${walk.toString()};
  var lineFor = ${lineFor.toString()};
  var mutedFor = ${mutedFor.toString()};
  var tokensFor = ${tokensFor.toString()};
  var normalizeAccent = ${normalizeAccent.toString()};
  var resolveMode = ${resolveMode.toString()};
  try {
    var raw = localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)});
    var stored = raw ? JSON.parse(raw) : null;
    var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var appearance = stored && stored.appearance === "dark" ? "dark" : stored && stored.appearance === "light" ? "light" : (systemDark ? "dark" : "light");
    if (!stored || stored.appearance !== appearance) {
      var saved = stored && typeof stored === "object" ? stored : {};
      saved.appearance = appearance;
      if (!saved.theme) saved.theme = "default";
      if (!saved.accent) saved.accent = ${JSON.stringify(DEFAULT_ACCENT)};
      localStorage.setItem(${JSON.stringify(APPEARANCE_KEY)}, JSON.stringify(saved));
    }
    var themes = ["default","cream","sage","lavender","ocean","custom"];
    var theme = stored && themes.indexOf(stored.theme) >= 0 ? stored.theme : "default";
    var accent = normalizeAccent(stored && stored.accent);
    var mode = resolveMode(appearance);
    var tokens = tokensFor(theme, mode, accent);
    var root = document.documentElement;
    root.dataset.appearance = appearance;
    root.dataset.theme = theme;
    root.dataset.mode = mode;
    root.style.colorScheme = mode;
    for (var key in tokens) {
      if (Object.prototype.hasOwnProperty.call(tokens, key)) root.style.setProperty(key, tokens[key]);
    }
  } catch (error) {}
})();`;

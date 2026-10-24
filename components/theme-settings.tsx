"use client";

import { useId, useState } from "react";
import type { CSSProperties } from "react";
import { useAppearance } from "@/components/appearance-provider";
import { PageHeader, cardClass } from "@/components/ui";
import {
  APPEARANCES,
  DEFAULT_ACCENT,
  THEMES,
  normalizeAccent,
  tokensFor,
  writePreference,
} from "@/lib/appearance";
import type { AppearanceChoice, ThemeId } from "@/lib/appearance";

export function ThemeSettings() {
  const appearanceName = useId();
  const themeName = useId();
  const { preference } = useAppearance();
  const mode = preference.appearance;

  function update(next: Partial<{ appearance: AppearanceChoice; theme: ThemeId; accent: string }>) {
    writePreference({ ...preference, ...next });
  }

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Settings" title="Appearance">
        <p>
          Light or dark, and the color theme, stay in this browser until you change them. They are not uploaded.
        </p>
      </PageHeader>

      <section aria-labelledby="appearance-heading" className={`${cardClass} p-6 sm:p-8`}>
        <h2 id="appearance-heading" className="font-serif text-3xl text-foreground">
          Light and dark
        </h2>
        <p className="mt-2 leading-relaxed text-muted">
          Showing {mode} mode, chosen here.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-labelledby="appearance-heading">
          {APPEARANCES.map((option) => {
            const selected = preference.appearance === option.id;
            return (
              <label
                key={option.id}
                className={`cursor-pointer rounded-2xl border px-4 py-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-accent-text ${
                  selected ? "border-accent-text bg-accent text-accent-text" : "border-line bg-background text-foreground"
                }`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name={appearanceName}
                  checked={selected}
                  onChange={() => update({ appearance: option.id })}
                />
                <span className="block font-medium">{option.label}</span>
                <span className={`mt-1 block text-sm ${selected ? "" : "text-muted"}`}>{option.detail}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="theme-heading" className="space-y-4">
        <div>
          <h2 id="theme-heading" className="font-serif text-3xl text-foreground">
            Color theme
          </h2>
          <p className="mt-2 max-w-2xl leading-relaxed text-muted">
            Each preview uses the light or dark mode selected above. Choosing one updates the whole site.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-labelledby="theme-heading">
          {THEMES.map((option) => {
            const selected = preference.theme === option.id;
            const tokens = tokensFor(option.id, mode, preference.accent);
            return (
              <label
                key={option.id}
                className={`cursor-pointer rounded-[1.5rem] border p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-accent-text ${
                  selected ? "border-accent-text bg-accent/40" : "border-line bg-card"
                }`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name={themeName}
                  checked={selected}
                  onChange={() => update({ theme: option.id })}
                />
                <ThemePreview tokens={tokens} />
                <span className="mt-3 block font-medium text-foreground">{option.label}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">{option.detail}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="custom-heading" className={`${cardClass} p-6 sm:p-8`}>
        <h2 id="custom-heading" className="font-serif text-3xl text-foreground">
          Custom accent
        </h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          Pick a color for buttons, highlights, and cards. Text stays dark or light enough to read. Choosing a color
          switches the theme to Custom.
        </p>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="block text-sm font-medium text-foreground">
            Accent color
            <input
              type="color"
              value={preference.accent}
              onChange={(event) => update({ theme: "custom", accent: normalizeAccent(event.target.value) })}
              className="mt-2 block h-12 w-full cursor-pointer rounded-2xl border border-line bg-card sm:w-24"
              aria-describedby="accent-help"
            />
          </label>
          <HexField key={preference.accent} accent={preference.accent} onCommit={(accent) => update({ theme: "custom", accent })} />
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-card px-5 text-sm font-medium text-foreground"
            onClick={() => update({ theme: "custom", accent: DEFAULT_ACCENT })}
          >
            Reset color
          </button>
        </div>
        <p id="accent-help" className="mt-3 text-sm text-muted">
          Current accent {preference.accent}. The site uses it while Custom is selected.
        </p>
      </section>
    </div>
  );
}

function ThemePreview({ tokens }: { tokens: Record<string, string> }) {
  return (
    <div
      aria-hidden="true"
      style={tokens as CSSProperties}
      className="rounded-2xl border border-line bg-background p-3 text-foreground"
    >
      <div className="rounded-xl border border-line bg-card p-3">
        <p className="font-serif text-xl">Quiet hour</p>
        <p className="mt-1 text-xs text-muted">A note in this theme</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-inverse px-3 py-1 text-xs font-medium text-inverse-text">Button</span>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-text">Accent</span>
        </div>
        <div className="mt-3 h-8 rounded-xl border border-line bg-background" />
      </div>
    </div>
  );
}

function HexField({ accent, onCommit }: { accent: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(accent);
  return (
    <label className="block min-w-0 flex-1 text-sm font-medium text-foreground">
      Hex
      <input
        type="text"
        value={draft}
        spellCheck={false}
        maxLength={7}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (/^#[0-9a-fA-F]{6}$/.test(next)) onCommit(normalizeAccent(next));
        }}
        className="mt-2 w-full rounded-2xl border border-line bg-card px-4 py-3 font-mono text-base text-foreground"
      />
    </label>
  );
}

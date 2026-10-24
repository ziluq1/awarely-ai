import { LIFELINE_LABEL, LIFELINE_URL, UNCERTAIN_NOTE } from "@/lib/agent/safety";

export function SafetyNotice({
  prominent,
  immediateDanger = false,
}: {
  prominent: boolean;
  immediateDanger?: boolean;
}) {
  if (!prominent) {
    return (
      <aside className="mt-3 rounded-2xl border border-line bg-card px-4 py-3 text-foreground" role="note">
        <p className="text-sm leading-relaxed">{UNCERTAIN_NOTE}</p>
        <a
          className="mt-2 inline-block text-sm font-semibold text-accent-text underline decoration-line underline-offset-4"
          href={LIFELINE_URL}
        >
          {LIFELINE_LABEL}
        </a>
        <p className="mt-2 text-xs leading-relaxed text-muted">awarely.ai cannot monitor you or send emergency help.</p>
      </aside>
    );
  }

  return (
    <aside className="mt-3 rounded-2xl bg-card px-4 py-4 text-foreground" role="note" aria-label="Crisis support">
      <a className="text-lg font-semibold leading-snug text-foreground underline decoration-line underline-offset-4" href={LIFELINE_URL}>
        {LIFELINE_LABEL}
      </a>
      {immediateDanger ? (
        <p className="mt-3 text-sm font-medium leading-relaxed">
          If you are in immediate danger, contact local emergency services.
        </p>
      ) : null}
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Reach a person you trust if you can. awarely.ai cannot monitor you or send emergency help.
      </p>
    </aside>
  );
}

"use client";

/* eslint-disable @next/next/no-img-element -- Private photo links expire, so these images stay on a plain img. */

import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { AccountEntry } from "@/lib/account-journal";
import { formatDay, formatWhen, moodLabel } from "@/lib/format";

export function TimelineCollage({
  entries,
  onOpen,
}: {
  entries: AccountEntry[];
  onOpen: (id: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef({ x: 0, y: 0, moved: false });
  const moments = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    function onWheel(event: WheelEvent) {
      if (!el) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const max = el.scrollWidth - el.clientWidth;
      const next = el.scrollLeft + event.deltaY;
      if ((event.deltaY < 0 && el.scrollLeft <= 0) || (event.deltaY > 0 && el.scrollLeft >= max - 1)) return;
      event.preventDefault();
      el.scrollLeft = next;
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [moments.length]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    drag.current = { x: event.clientX, y: event.clientY, moved: false };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) > 8) {
      drag.current.moved = true;
    }
  }

  function openMoment(id: string) {
    if (drag.current.moved) return;
    onOpen(id);
  }

  return (
    <section className="scrapbook" aria-label="Timeline">
      <div
        ref={scroller}
        className="scrapbook-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <div className="scrapbook-track">
          <ol className="scrapbook-row">
            {moments.map((entry) => (
              <li key={entry.id} data-moment data-id={entry.id} className="scrapbook-moment">
                <button
                  type="button"
                  className="scrapbook-tile"
                  onClick={() => openMoment(entry.id)}
                  aria-label={
                    entry.photoUrl
                      ? `Open ${formatWhen(entry.createdAt)}`
                      : `Journal entry, ${formatWhen(entry.createdAt)}`
                  }
                >
                  {entry.photoUrl ? (
                    <img className="scrapbook-picture" src={entry.photoUrl} alt="" />
                  ) : (
                    <span className="scrapbook-note-card">
                      <strong>Journal entry</strong>
                      <time dateTime={entry.createdAt}>{formatDay(entry.createdAt)}</time>
                      <span>{feelingLine(entry)}</span>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function feelingLine(entry: AccountEntry): string {
  const preset = moodLabel(entry.mood);
  const custom = entry.customFeeling?.trim() || "";
  if (preset && custom) return `${preset}. ${custom}`;
  return preset || custom || "No feeling";
}

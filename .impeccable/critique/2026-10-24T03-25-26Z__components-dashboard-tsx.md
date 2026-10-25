---
target: awarely.ai home
total_score: 19
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 3
p2_count: 2
target_identity: "file:/home/evan/projects/mindmate-ai/components/dashboard.tsx"
target_fingerprint: "sha256:c82aec815561678a95d1259290c83ce4b9abf09a4e541241ccf329f5c3564f8f"
target_path: /home/evan/projects/mindmate-ai/components/dashboard.tsx
timestamp: 2026-10-24T03-25-26Z
slug: components-dashboard-tsx
closed: true
---
Method: dual-agent (A: fef38f5a-5e91-4f94-8a62-bc6cd9da2d61 · B: 0d6c8f5d-d738-41cb-92bd-a2291567b85e)

# Critique: awarely.ai home

The live home is a careful journal sentence inside a wellness-app shell. The structure could be a mood tracker or a notes product without moving a section. What belongs to awarely.ai is the copy, not the composition. There is no photograph on a photo journal.

Templated parts, as they appear on the page:

- An eyebrow, “Home”, then a serif headline, then a gray paragraph. Newsreader for headings, Geist for everything else.
- A hairline rounded card, “Start here”, “Capture This Moment”, and a filled pill, “Open capture”.
- “A gentle order”: three identical cards, “01 Capture”, “02 Reflect”, “03 Revisit”.
- Check-in, companion, history, a saved reflection, and those three steps share one radius and, in the dark theme, the same `#121212` fill as the page.
- Eight equal mood pills, then a seven-row bar chart.
- “AI wellness companion” names `allam-2-7b`, Groq, and `gemini-3.5-flash-lite`.

The sentences that are this product: “Photos are not used to guess how you feel.” “awarely.ai does not pick it for you.” “The camera is requested only when you choose it.” The footer keeps the 988 limit.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | “Home” is current in the tree, but its fill is `#121212` on a `#121212` sidebar, and a pressed “Calm” chip loses its border. |
| 2 | Match System / Real World | 3 | Mood words are plain, then the companion card switches to model ids. |
| 3 | User Control and Freedom | 3 | Chips toggle off, but the whole capture card is one link. |
| 4 | Consistency and Standards | 2 | “AI Companion”, “AI wellness companion”, and “Open the AI companion” name one feature three ways. Dark cards and the page share one fill. |
| 5 | Error Prevention | 2 | “Continue to your reflection” is available beside “No draft label.” One Grateful entry paints a 100% bar. |
| 6 | Recognition Rather Than Recall | 3 | Actions are words. Storage is three phrases the reader has to reconcile. |
| 7 | Flexibility and Efficiency | n/a | Persuade landing. Accelerators are not this page’s job. |
| 8 | Aesthetic and Minimalist Design | 2 | The headline is quiet. After it, equal cards, a zero chart, a model paragraph, and a three-step repeat. |
| 9 | Error Recovery | 2 | No failed state was on screen. Nothing says that pressing a chip again clears it. |
| 10 | Help and Documentation | n/a | Persuade surface. The 988 line is product copy, not a help system. |
| **Total** | | **19/32** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment.** Category-interchangeable structure. The human moment is the headline and a handful of sentences. The rest is the hero-card plus three-feature pattern, pill chips, and a status panel.

**Deterministic scan.** CLI `impeccable detect` on the home markup exited 0 with no findings. The browser overlay on `http://localhost:3000/` injected `detect.js` and reported 4 hits: `hero-eyebrow-chip` on the tracked-caps “Home” above the h1 (`components/dashboard.tsx` line 45), `line-length` on the hero paragraph (~91 characters on 2 of 3 lines), advisory `straggler` on “988lifeline.org.” in `components/site-footer.tsx`, and `overused-font` Geist at 84% of text from `app/layout.tsx`. Visual contrast added nothing. The overlay was visible in the [Human] tab.

Geist is the face the layout already chose, and the brief asks to leave default faces. The eyebrow and the long lede match the review. The footer straggler is advisory.

## Overall Impression

The headline is the only thing that feels like a place to land. Everything under it is a template. The single biggest opportunity is to let the journal be a sheet of paper, with one picture and one action, instead of a stack of equal cards.

## What's Working

- The product boundary is said in human language: photos are not used to guess a feeling, and awarely.ai does not pick the label.
- The 988 notice is specific, present, and scoped to a journaling space.
- Controls are words at 44px, and the draft line updates in place.

## Priority Issues

**[P1] Dark surfaces are one color, so a choice disappears.**
Why it matters: Pressing Calm removes the chip border on `#121212`, and “Home” in the sidebar matches the sidebar. A first visit cannot see where it is.
Fix: On this page, paint the paper, the pressed word, and the current choice in deep green and terracotta. Do not flatten them into the page color.
Suggested command: /impeccable colorize

**[P1] The first screen offers three jobs.**
Why it matters: “Open capture”, eight chips plus “Continue to your reflection”, and “Open the AI companion” compete. “A gentle order” later says the sequence is Capture, then Reflect, then Revisit.
Fix: Keep “Open capture” as the only filled action. Leave the companion as a text link. Keep the mood words, and stop repeating the sequence as three cards.
Suggested command: /impeccable layout

**[P1] The companion card talks like a product status panel.**
Why it matters: “AI wellness companion” plus `allam-2-7b`, Groq, and `gemini-3.5-flash-lite` fights the headline and the “not medical care” line.
Fix: One plain sentence. A message is shared with the provider. Photos and saved entries are not. Model ids leave this page.
Suggested command: /impeccable clarify

**[P2] At 390px the hero button slides under the tab bar.**
Why it matters: “Open capture” ends under the fixed bar, so the action the page names is clipped.
Fix: Put the action high in the first viewport, fully above the bar.
Suggested command: /impeccable adapt

**[P2] Mood history is a chart for a single label, and the steps repeat the hero.**
Why it matters: Grateful is 1 and draws a full bar because the scale is the highest count. The six empty rows are noise. “01 Capture” repeats the hero.
Fix: Show only labels that were used. Fold the order into one sentence. Remove the three cards.
Suggested command: /impeccable distill

## Persona Red Flags

**Jordan (first-timer).** Within one screen they meet “Open capture”, eight equal chips, “Continue to your reflection”, and “Open the AI companion”, with no photo. “No draft label.” assumes they know what a draft is. Model names are the first jargon. They will stall between capture and reflection.

**Riley (stress tester).** One Grateful label paints a 100% bar beside six zeros. “Continue to your reflection” is live while the status says “No draft label.” Pressing Calm clears the chip outline while the live region says it is selected. Storage copy disagrees across the hero, the entry, and step 03.

**Casey (phone).** At 390 the header holds Log in, Sign up, Alerts, and Settings in tight gaps, outside the thumb. “Open capture” is covered by the bottom bar. The mood chips start after a long scroll.

## Minor Observations

- “Home” repeats the nav item above the headline.
- “View timeline” is a small underline beside “Recent reflections”.
- The footer repeats destinations that are already in the nav.
- The page washes are mixed from accent and sage. Both are `#121212` in this theme, so the wash is gone.

## Questions to Consider

- If the home page shows no picture, what on the first screen tells a visitor this is a photo journal?
- If the companion is optional, what is the first screen allowed to say about it?
- A pressed feeling currently looks like ordinary text on black. What should a chosen feeling look like on the page?

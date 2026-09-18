---
name: design-system
description: This project's visual language and UX taste — Tailwind v4 tokens, the form and results layout, the animated loading state, and clean rendering of stripped Podscan metadata. Use whenever building or changing UI in this repo.
paths:
  - src/**/*.svelte
  - src/**/*.css
---

## Why this matters

Design taste is **25%** of the grade (`doc/Requirements.md`). The whole product is one
polished flow: a URL+email form → an animated wait → six podcast cards. Consistency and
restraint win here. This project uses **Tailwind CSS v4** (`@tailwindcss/vite`); define
tokens with `@theme` in the global stylesheet and use utility classes.

## Direction

- **Feel:** clean, confident, editorial. Generous whitespace, one accent color, real type
  hierarchy — not a rainbow of Tailwind defaults.
- Pick one brand accent and expose it as `--color-brand-*` tokens via `@theme`; use
  `brand-*` utilities everywhere, never raw `blue-*`. `gray-*` for text/borders; semantic
  `success` / `warning` / `error` for status.
- Type: bold tight-tracking display headings (`font-bold tracking-tight`), `text-gray-500`
  for secondary, `text-gray-900` for primary.
- Layout: `max-w-2xl mx-auto px-4` for the form, a responsive grid for the six results.
  Cards: `rounded-xl border border-gray-200 bg-white shadow-sm`, subtle lift on hover.

## Reusable components

Build small primitives once in `src/lib/components/ui/` (e.g. `Button`, `Input`, `Alert`,
`Card`, `Badge`) and reuse them — do not re-style raw elements per page. Each clickable
element gets `cursor-pointer`.

## The form (input validation & UX)

- Two fields: URL and email, validated with **Zod** (`design-system` pairs with
  `svelte-conventions`). Auto-prepend `https://` when the user types a bare `domain.com`.
- Show field errors inline under the input; show submit-level errors in an `Alert`.
- Handle graceful states: empty, loading, error, and "narrow niche → fewer than 6"
  (surface the score so the user can judge quality).

## The loading state (required)

The LLM pipeline takes ~8–10 s, so a static spinner reads as broken. Use an **animated
skeleton with rotating status text** — e.g. *"Analyzing profile…" → "Fetching shows…" →
"Scoring matches…" → "Writing your fits…"* Advance the label on a timer; add entrance
animation (`animate-in fade-in slide-in-from-bottom-2`) as results appear. Stagger sibling
cards with `delay-*`.

## Rendering external metadata (required)

Podscan descriptions arrive as messy raw HTML. **Strip tags server-side with Cheerio**
before render — never `{@html}` untrusted Podscan content into the page. Show clean text,
truncated sensibly, with the match score as a `Badge` and the personalized "why it fits"
line as the emphasis.

## Email

The Resend email mirrors the on-page result: a clean HTML template listing the six shows,
score, and fit line, plus a working unsubscribe link (`PUBLIC_BASE_URL` + token/route).
Keep it inline-styled and email-client-safe.

## Icons

Use a Lucide icon set, never inline SVG or emoji for UI (exception: brand logos that need
exact colors). Default `h-4 w-4`.

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

Shipped look is **"Playful pop editorial"** (ported from Lovable). Source of truth is
`src/routes/layout.css` - read it, don't guess tokens.

- **Feel:** cream canvas, ink outlines, one coral primary, hard-offset "pop" shadows.
  Playful but still tidy.
- **Colours:** `cream`, `ink`, `coral` (primary), plus `butter`, `mint`, `sky`, `lilac` as
  accents. Semantic tokens too: `bg-background`, `text-foreground`, `bg-primary`,
  `text-muted-foreground`, `border-border`. Never raw `gray-*` / `blue-*`.
- **Type:** `font-display` (Bricolage Grotesque) for headings, `font-body` (DM Sans) for text.
- **Shape:** `rounded-2xl border-2` (ink border), no blur shadows - use `shadow-pop-xs|sm|md|lg`
  (solid offset). Cards and buttons "press" by dropping the offset on active.
- **Motion:** `animate-rise` for entrances, `animate-floaty` / `animate-wiggle` for
  decoration, `animate-bounce-dot` for loading. Wrap loops in `motion-safe:`;
  `layout.css` already has the reduced-motion opt-out.
- **Layout:** one column, mobile first (checked at 414px). Six results in a responsive grid.

**No shadcn-svelte, no `tw-animate-css`.** Lovable's `components/ui/` folder was unused
scaffold and every animation is defined locally in `@theme` (task `001`). Don't add either -
plain Tailwind utilities over the tokens is the whole system.

## Components

Small primitives in `src/lib/components/ui/` (`Button`, `Field`, `Alert`, `Badge`); feature
components (`InputScreen`, `LoadingScreen`, `ResultsScreen`, `PodcastCard`, `CriteriaPanel`,
`ConfidenceNote`) sit next to them. Reuse, don't re-style raw elements. Clickable = `cursor-pointer`.

## The form (input validation & UX)

- Two fields: URL and email, validated with **Zod** . Auto-prepend `https://` when the user types a bare `domain.com`.
- Show field errors inline under the input; show submit-level errors in an `Alert`.
- Handle graceful states: empty, loading, error, and "narrow niche → fewer than 6"
  (surface the score so the user can judge quality).

## The loading state (required)

The pipeline takes 10-20 s, so a static spinner reads as broken. `LoadingScreen` shows a
status label and 5 progress dots (bounce under `motion-safe`). The label is driven by the
**real stage events** from the NDJSON stream (`src/lib/stages.ts`), not a timer. Results
enter with `animate-rise`, staggered with an inline `animation-delay`.

## Rendering external metadata (required)

Podscan descriptions arrive as messy raw HTML. **Strip tags server-side with Cheerio**
before render — never `{@html}` untrusted Podscan content into the page. Show clean text,
truncated sensibly, with the match score as a `Badge` and the personalised "why it fits"
line as the emphasis.

## Email

The Resend email mirrors the on-page result: a clean HTML template listing the six shows,
score, and fit line, plus a working unsubscribe link (`PUBLIC_BASE_URL` + token/route).
Keep it inline-styled and email-client-safe.

## Icons

Use a Lucide icon set, never inline SVG or emoji for UI (exception: brand logos that need
exact colors). Default `h-4 w-4`.

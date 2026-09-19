# Architecture & Decisions

## 1. Match Quality & Fit Logic (The 90% Threshold)

**Decision:** A 3-step LLM pipeline using OpenRouter with Structured Outputs (JSON schema,
`strict: true`, `provider.require_parameters` so we never route to a provider that ignores
the schema). Model comes from `OPENROUTER_MODEL`, defaulting to `google/gemini-2.5-flash-lite`
— cheap and fast for now, swap it once match quality is being tuned.
**Why:**

1. **Extract:** Extract the user's core persona/industry from their URL.
2. **Fetch candidates:** Query Podscan for ~15-20 broad podcast candidates based on that persona.
3. **Score & explain:** Pass the user persona + the 20 podcast descriptions back to the LLM. The LLM is instructed to score them (0-100), write a 1-sentence personalised explanation addressing the user directly ("As a B2B SaaS founder, you'll find..."), filter for >= 90%, and return exactly the top 6.

## 2. UX Polish & HTML Stripping

**Decision:** Strict Zod validation on the frontend and regex-based HTML sanitization on the backend.
**Why:**

- **Validation:** URLs must be valid, but users often type `domain.com` instead of `https://domain.com`. The UI intercepts this auto appends `https://`, and validates before submitting.
- **HTML striping:** Podscan descriptions often contain messy raw HTML tags (`<p>`, `<a>`, `<br>`). Before passing descriptions to the LLM (which wastes tokens) or the frontend (which breaks layout) I run a standard regex `.replace(/(<([^>]+)>)/gi, "")` to ensure clean, readable text.
- **Latency handling:** Because the LLM pipeline (estimating) that takes ~10sec the frontend uses an animated skeleton loader with dynamic text ("Analysing profile..." -> "Scoring podcasts...") so the user doesn't bounce.

## 3. The LinkedIn Problem

**Decision:** A ladder of fallbacks with an explicit confidence score, ending in the URL slug.
**Why:** LinkedIn strictly blocks scraping (returning 999/403). Rather than failing, or
silently guessing, each rung reports how much we actually learned and we stop at the first
that returns something (`src/lib/server/profile/`):

| Rung | Source                                                                      | Confidence |
| ---- | --------------------------------------------------------------------------- | ---------- |
| 1    | the page itself, read with Cheerio (title, meta/OG, JSON-LD, `<main>` copy) | 0.9        |
| 1    | LinkedIn served OG tags before the auth wall — it sometimes does            | 0.75       |
| 1    | `linkedin.com/company/{slug}` → guess `{slug}.com` and read that            | 0.8        |
| 2    | slug keywords: `jane-doe-b2b-marketing-7a3b21` → `b2b marketing`            | 0.35 / 0.2 |
| 3    | the user's own stated interests — merged into _every_ rung, not a fallback  | +0.3       |

A read that succeeds but returns almost nothing is discounted (×0.6): a fetched page is not
the same as a page that told us something. Final persona confidence is `min(ladder, model)`,
so neither an optimistic scrape nor an optimistic model can talk the other one up.

Below 0.4 we still run the pipeline — the results screen says the list was built from a
thin read and offers to sharpen it (task `007`). The one case we refuse is _zero_ evidence
(no page, no OG, no slug keywords, no interests): asking the LLM there produces a
confident-looking persona built from nothing, so we ask the user for their interests instead.

**Future plan:** For more reliable results there are various approaches:

1. Real Mac or Win machine (not Ubuntu server) and non-headless scraper from domestic IP looks less suspicious. Once in a while do some other stuff in LinkedIn, too (out of scope).
2. Use paid proxies (out of scope).
3. Use paid Linkedin profile scraping service (research out of this short demo scope).
4. API access (research out of this short demo scope).

## 4. Email Setup & Reliability

**Decision:** Resend SDK with graceful degradation.
**Why:** Resend is fast and reliable. The email includes a clean HTML template mapping the 6 podcasts and the unsubscribe link. If the Resend API throws an error (e.g., hard bounce, API down), the backend catches it. Because the primary requirement is _also_ displaying it on-screen, the user still gets their UI result even if the email temporarily fails. Unsubscribing simply toggles an `is_active` boolean in Supabase, excluding them from the weekly Cron.

## 5. Fetching a URL a Stranger Typed (SSRF)

**Decision:** `src/lib/server/profile/safeFetch.ts` is the only outbound fetcher for
user-supplied URLs, and it checks **names and resolved addresses on every redirect hop**.
**Why:** this endpoint takes an arbitrary URL from an anonymous visitor and fetches it from
inside our Vercel function. That is textbook SSRF. Four layers:

1. `normalizeUrl` (task `002`) — https only, no `localhost`, no bare IPs.
2. A hostname blocklist for names that look public but are not: `*.internal`,
   `*.cluster.local`, `*.home.arpa`.
3. **A DNS lookup before every request**: if any A/AAAA answer is private or reserved, we
   refuse. `evil.com A 169.254.169.254` is trivially registrable and defeats layers 1–2 on
   its own — on a cloud host that address is the instance metadata service.
4. `redirect: 'manual'` with a depth cap of 3, re-running 1–3 for each `Location`. A public
   URL that 302s inward is the same attack wearing a hat.

Also: a 3 s request timeout, a 1.5 s DNS timeout, a 500 KB streaming read cap, and fetched
content is only ever LLM input — never re-emitted to the browser, never `{@html}`.

**Residual risk, stated rather than assumed away:** between our lookup and `fetch`'s own,
a hostile resolver can answer differently (DNS rebinding). Closing it needs an undici
dispatcher pinned to the address we validated. Accepted for this scope; revisit if the
endpoint is ever exposed to untrusted volume.

**Runtime constraint this creates:** the app must stay on a **Node** runtime
(`nodejs24.x`, pinned in `vite.config.ts`) — Vercel's Edge runtime has no `node:dns`.
`maxDuration` is pinned to 60 s there too: the platform default of 10 s cannot fit a page
fetch plus several LLM calls.

# Architecture & Decisions

## 1. Match Quality & Fit Logic (The 90% Threshold)

**Decision:** A staged LLM pipeline on OpenRouter with Structured Outputs (JSON schema,
`strict: true`, `provider.require_parameters` so we never route to a provider that ignores
the schema). Model comes from `OPENROUTER_MODEL`.

**Default:** `google/gemini-2.5-flash-lite`. Task 014 had to drop this to a `:free` model
because the key held no credit and every paid call `402`d on the _first_ request (persona);
task 015 put credit on the key and restored it. `OPENROUTER_MODEL` still overrides, but a
`:free` model is demo-only — the whole key gets 50 free requests/day, one submission spends
3-6, and neither free model that honours a JSON schema could put six shows over the 90% bar.

Two constraints that testing against the free tier forced into `llm.ts`, both kept:

- `reasoning: { enabled: false }` — every free model that still honours a JSON schema is a
  reasoning model, and thinking silently spends the whole `max_tokens` before the answer starts.
- **retry only what a retry can fix.** `chatJson` used to retry every failure, so a 402 cost two
  calls and two slots. Now only a timeout, a 429 or a 5xx is retried; 4xx is final. A 402/429
  raises `LlmQuotaError`, whose copy says the model is out of quota instead of blaming a timeout.

**Why the staged pipeline:** a single "score these 20 shows 0-100" prompt is vibes: scores cluster at 85-92 and
the 90% cut means nothing. So the model judges, and our code does the arithmetic.

1. **Persona:** extract who the user is from their page (section 3).
2. **Candidates:** Podscan search, up to 5 terms in parallel, quality floor (10+ episodes,
   posted recently), deduped with the terms that found each show.
3. **Criteria (Stage A):** the LLM writes 4-5 weighted criteria _for this person_, each saying
   what a 95 looks like and what a 60 looks like, so they can be scored and not just felt.
4. **Score (Stage B):** batches of 18, parallel, `temperature: 0`. The model returns one
   0-100 score per criterion, never a total. Shows and criteria are referenced by position
   (`[1]`, `[2]`), not by id, because models mangle long ids. Zod checks the array length.
5. **Select (Stage C):** pure TypeScript, no prompt. `weights.ts` computes the score and
   rounds once; that same rounded number is shown _and_ tested against 90, so a card can
   never read "90%" while below the cut. `select.ts` takes the top 6, preferring different
   standout criteria and max 2 per publisher — but that is a preference: pass 3 drops the
   cap, because "exactly 6" is the requirement.
6. **Too few at 90+:** one expansion round (new search terms, score again). Still short →
   honest shortfall with the next-best shows, never padded (Requirements QA #3).

### What the 90% actually means (task 016)

**The score is a weighted mean over every criterion except the one that show is weakest on.**
Four criteria in, the best three count; five in, the best four.

The requirement says "a 90%+ match score" without defining what the number measures, so this
is a decision, and it is the one thing on this screen a reader could be misled by. Stating it
plainly:

- **It is not** "this show satisfies 90% of everything you care about."
- **It is** "on the things this show is _for_, it is a 90% fit for you."

Why it had to change. The old score was a plain weighted mean over all 4-5 axes, which needs
~90 on _every_ axis to total 90 — and no real podcast is outstanding on four independent axes
at once. Task 015 measured this properly: seven prompt variants, two models and a 2.3× bigger
pool all capped in the low 80s. "The SaaS Podcast" is a textbook match for a bootstrapped
founder (95 fundamentals, 95 operator, 80 pricing) and totalled **84** purely because it does
not _also_ cover sales-team building. The ceiling was the arithmetic, not the judgement, and
no prompt wording fixes it.

What is deliberately preserved:

- **Every surviving number is still the model's per-criterion judgement.** Nothing is
  invented, curved or normalised against the pool. A show is never scored relative to how
  good its competition happened to be, so a 94% means the same thing for every user.
- **The dropped axis is the show's own weakest, not one we chose in advance.** We are not
  quietly deleting a criterion from the user's list — all of them are still scored, still
  shown, and still shape the ranking.
- **Only one axis is ever set aside**, and never below three counted (`MIN_AXES`). A show
  weak on _two_ axes still fails: 95/95/60/60 scores 83, not 90.
- **Covering everything is the job of the set of six, not of any one show.** That is exactly
  what the standout-diversity pass in `select.ts` is for — it spreads the six across
  different winning criteria, so the axis one show drops is one another show leads on.

The alternative considered and rejected was normalising the pool so the best matches always
map onto 90-100. It guarantees six every time and it is what most "match %" products do, but
a 94% that means "best of 49" is a different claim from one that means "a 94% fit", and the
pool is whatever Podscan's text search happened to return. Honest per-criterion judgement was
worth more than a guaranteed six.

The results screen says this in one line under the criteria, so the meaning is not buried in
this file.

Each pick carries a one-sentence "why" written to the user directly, and the criteria are
shown next to the cards so the user can see what "90%" was measured against.

## 2. UX Polish, HTML Stripping & Streaming

**Decision:** Zod validation on the client, Cheerio sanitising on the server, NDJSON streaming
for progress.
**Why:**

- **Validation:** users type `domain.com`, not `https://domain.com`. The UI adds `https://`
  and validates before submit; the server validates again (never trust the client).
- **HTML stripping:** Podscan descriptions are raw HTML. Cheerio strips them server-side
  (block tags are separated first, so `<p>a</p><p>b</p>` gives `a b`, not `ab`). Cheaper for
  the LLM and it means nothing untrusted ever reaches `{@html}`.
- **Latency:** the pipeline is ~10-20 s. A timer-driven fake loader lies, and worse it can't
  handle a slow run. `POST /api/match` streams NDJSON (`stage` / `persona` / `result` /
  `error`) with a blank-line heartbeat every 10 s, and the loading screen follows the real
  stage. If the stream ends without a `result` the store shows an error, not a stuck spinner.
  Worst-case call ceilings add up to more than `maxDuration: 60`; typical runs are far below,
  and the streamed error path covers the rest.

## Podscan (task 004)

Endpoints: `GET /podcasts/search` (candidates) and `GET /podcasts/{id}/latest/episode`
(weekly cron). Trial tier is 100 req/day and 10 req/min, so each submission is hard-capped at
5 searches (a 6th term is dropped), one jittered retry on 429/5xx, and auth errors are never
retried (an unpaid plan stays unpaid). A fixture mode (`PODSCAN_FIXTURES=1`) exists for dev
only. **Status:** the key currently gets `403 requires a paid plan`, so match quality against
real shows is unmeasured.

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

**Decisions worth knowing (task 009):**

- **Headers:** every mail carries `List-Unsubscribe` (the POST endpoint) and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, which Gmail/Yahoo want for bulk senders.
- **Unsubscribe:** the link in the mail opens a confirm page, it never acts on GET (mail scanners prefetch links). The `List-Unsubscribe-Post` one-click header points at `POST /api/unsubscribe`, which acts straight away. Unknown tokens get the same answer as real ones, so there is no way to probe for emails.
- **CSRF:** `csrf.trustedOrigins: ['*']` in `vite.config.ts`. Mail providers send the one-click POST with no `Origin` header and SvelteKit would 403 it. There are no cookies or sessions, the token is the only credential, so the origin check protects nothing here.
- **Bounces:** an invalid address sets `is_active = false`, so the weekly cron stops writing to it. Transient errors (429/5xx) retry once, then `sends.status = 'failed'`.
- **Idempotency key:** kind + signup + ISO week + hash of the show URLs. Resend rejects a reused key with a different body, so a refined re-submit in the same week needs a new key.
- **DMARC:** links use `PUBLIC_BASE_URL` (podmatch.e-stonia.co.uk) but mail is sent from `RESEND_VERIFIED_DOMAIN` (ezysmart.cc). Different domains, so link and From are not aligned. Fine for a demo, use one domain in production.

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

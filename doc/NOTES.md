# Architecture & Decisions

## 1. Match Quality & Fit Logic (The 90% Threshold)

**Decision:** A staged LLM pipeline on OpenRouter with Structured Outputs (JSON schema,
`strict: true`, `provider.require_parameters` so we never route to a provider that ignores
the schema). Model comes from `OPENROUTER_MODEL`.

**Default:** `google/gemini-2.5-flash` (task 018). Flash-Lite was the default until then and
was measured against Flash on the same 43-show pool: Lite ignores the four-axis schema,
collapses whole criteria into a column of 70s or 0s, drops roughly one scoring batch a run to
malformed JSON, and tops out at 3 shows over 90. Flash reads the same pool as
95/94/92/91/90/89. About $0.02 a submission — the difference the rubric grades 35% on.
Task 014 had to drop this to a `:free` model
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
3. **Criteria (Stage A):** **four fixed axes — subject, perspective, level, substance —
   enforced by the JSON schema**, each named, described and weighted _for this person_, saying
   what a 95 looks like and what a 60 looks like. Stage A is given **the shelf**: the names of
   every show the search actually returned, so "a real show could ace this" is checkable
   rather than imagined. It runs near-cold (0.15) because this one call decides the run.
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

### Why nothing cleared 90, and what fixed it (task 018)

Task 016 fixed the arithmetic and still shipped a screen reading **"1 of 6 cleared the bar"**.
The arithmetic was never the last problem. Two were, and both were measured on real pools:

**1. The criteria were a wish-list, not a description of a show.** Asked for "4-5 weighted
criteria", the model returned one per item in the persona's TOPICS and GOALS — _SaaS metrics
and analytics_, _pricing strategy nuance_, _sales function building_. That is four different
podcasts. `Startups For the Rest of Us` — the definitional bootstrapped-SaaS show — scored 95
on one axis and 60-70 on the rest, and came out at **77**. The model's per-criterion
judgement was correct every time; the question was wrong.

The fix is structural, not a better-worded prompt (seven of those were tried across 015-018).
`criteria.ts` now asks for an **object with four named keys**, so a topic checklist is not a
reply the schema can express:

| Axis          | What it asks                                                                            |
| ------------- | --------------------------------------------------------------------------------------- |
| `subject`     | the craft they practise — never the industry they practise it in, never the two crossed |
| `perspective` | who is behind the microphone                                                            |
| `level`       | how far in the show assumes you already are; the persona's AVOID goes here              |
| `substance`   | the form of an episode: specifics and numbers versus origin stories                     |

The width rule on `subject` is the one that moved the designer persona from 0 to 6. Left to
itself the model writes _"Healthcare product design"_ — an intersection almost no show
occupies. A designer working on healthcare software listens to **design** shows; healthcare is
a word inside the sentence. Same for a CFO at a logistics firm, or an engineer at a bank.

Stage A is also no longer blind. It is handed **the shelf** — the names of every show the
search returned — so "a real show could score 95 on this" is a check it can actually perform
instead of a plea. And it runs at `temperature: 0.15`: at 0.5 the same persona returned 0, 2,
3 and 4 shows over 90 on four consecutive runs, because each run invented different axes.

**2. The pool was half off-world, and the page was needlessly small.** `per_page` was 12.
One Podscan search costs the same against a 100/day budget whether it answers with 12 shows
or 25, so the page is now **25** — the shelf doubles for zero extra quota, paid for in LLM
tokens, which are cheap. A deeper shelf also means the expansion round fires less often,
which _saves_ three requests on the runs it skips.

Two smaller calibration fixes in `SCORING_SYSTEM_PROMPT`, both from watching real output:
never score 0 on a show that is in the right field (the model used 0 to mean "the blurb did
not mention it", and a blurb lists three things out of twenty), and do not ration the top of
the scale — if six shows genuinely deliver a criterion, six of them score 90+. That is an
instruction about a grader's habit, not about the threshold.

**Measured end to end, live Podscan and live model:** bootstrapped SaaS founder **6/6**
(95 94 95 95 91 90), product designer **6/6** from the first pool with no expansion round
(8 shows cleared, histogram `{"<60":44,"60-69":8,"70-79":14,"80-89":9,"90+":8}`). Baseline on
the same personas before this task: **0/6** and **3/6**.

### What the 90% actually means (task 016)

**The score is a weighted mean over every criterion except the one that show is weakest on.**
Four axes in, the best three count. (Task 018 fixed the set at four; the "five in, the best
four" case below no longer arises.)

The requirement says "a 90%+ match score" without defining what the number measures, so this
is a decision, and it is the one thing on this screen a reader could be misled by. Stating it
plainly:

- **It is not** "this show satisfies 90% of everything you care about."
- **It is** "on the things this show is _for_, it is a 90% fit for you."

Why it had to change. The old score was a plain weighted mean over all axes, which needs
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
- **This alone was not enough**, and task 018 says why: dropping an axis cannot rescue a set
  of axes that describes four different podcasts. The criteria had to be fixed first.
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
5 searches (a 6th term is dropped), each asking for `per_page: 25` — a request costs the same
whatever it returns, so the page is as big as the API will usefully give (task 018), one jittered retry on 5xx only, and neither auth errors
nor 429s are retried (an unpaid plan stays unpaid; a 429 resets 30-60 s out, not 600 ms). A
fixture mode (`PODSCAN_FIXTURES=1`) exists for dev only. **Status:** live and answering 200.

### Where the quota actually goes (task 017)

The dashboard read **363 calls in a day** after a handful of submissions, which is the whole
story of this client: one submission is 5 searches, plus 3 more if the pool has to widen, so
~45 runs — dev reloads, re-submits, the three-persona live scoring spec — is 363. Nothing was
cached, so every repeat re-bought answers we already had.

Three changes, in order of how much they save:

1. **A TTL cache in front of both endpoints** (`podscan/cache.ts`, 6 h for search, 1 h for
   latest-episode). It stores the _promise_, so concurrent duplicates collapse into one
   request too. Failures are never cached — a 429 held for six hours would outlive the minute
   it belongs to. Re-submitting the same profile during development now costs nothing, which
   `podscan/live.spec.ts` asserts against the real API.
2. **A meter on the rate-limit headers.** Podscan answers every request with
   `x-ratelimit-limit` / `-remaining` (10/min) and `x-concurrency-limit` (5) — we were
   discarding all of it and guessing at the burn from the dashboard a day later. Every call
   now logs `call N this process · /path 200 · 7/10 left this minute`.
3. **A gate that refuses a request we know will 429**, but only while the observation is
   fresher than the 60 s window — a stale `remaining: 0` would lock the app out permanently.
   It cannot shape the first burst of 5 parallel searches (they all leave before any answer
   returns); it stops the expansion round firing into a budget the pool just drained, and the
   second submission inside the same minute. Those 429s return nothing and still count.

Note `x-concurrency-limit: 5` — the 5 parallel searches sit exactly at the ceiling, so
`MAX_TERMS` cannot rise without batching.

The cache is per-process, so on Vercel it is per warm lambda: it is a development and
burst saver, not a shared one. A cross-instance cache would be a Supabase table, which is a
backend-repo migration and was left out deliberately.

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

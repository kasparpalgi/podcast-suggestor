# PodMatch — podcast suggestor

**Live:** https://podmatch.e-stonia.co.uk

Enter a website or LinkedIn URL and an email. You get exactly 6 podcasts at a 90%+
match, each with a personal "why it's a fit" line. Same list lands in your inbox, with
a working unsubscribe link. A weekly cron sends a fresh list.

## How it works (60 sec)

1. **Read** - we fetch the page (Cheerio) and build a persona with the LLM. LinkedIn is
   blocked, so there is a fallback ladder ending in the URL slug, with a confidence score.
2. **Fetch** - Podscan gives ~20 candidate shows for that persona.
3. **Score** - the LLM scores each one on weighted criteria, keeps >= 90%, returns 6.
4. **Deliver** - streamed to the page (NDJSON), emailed via Resend, signup saved in Supabase.
5. **Weekly** - `/api/cron/weekly` resends, only when there are new episodes.

Decisions and reasons: [`doc/NOTES.md`](doc/NOTES.md). Spec: [`doc/Requirements.md`](doc/Requirements.md).

## Stack

SvelteKit 2 + Svelte 5, Tailwind v4, Vercel, Supabase, Podscan, OpenRouter, Resend.

## Env vars

Copy `.env.example` to `.env`. Set all of them in Vercel (Production and Preview).

| Var                                                      | Use                                        |
| -------------------------------------------------------- | ------------------------------------------ |
| `PUBLIC_BASE_URL`                                        | Real domain. Unsubscribe links use it      |
| `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase                      |
| `SUPABASE_SECRET_API`                                    | Server only - writes and cron              |
| `RESEND_API_KEY`, `RESEND_VERIFIED_DOMAIN`               | Email, domain must be verified in Resend   |
| `PODSCAN_API_KEY`                                        | Candidate shows                            |
| `PODSCAN_FIXTURES`                                       | Dev only - keep empty in production        |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`                 | LLM                                        |
| `CRON_SECRET`                                            | Bearer for the weekly cron and signups CSV |

## Develop

```sh
pnpm install
pnpm dev
pnpm check && pnpm test:unit && pnpm lint
```

The database (schema, migrations, pg_cron) lives in the sibling repo `podcast-suggestor-be`.

## Known limits

- **Podscan needs a paid plan.** The API returns 403 without it - no matches without it.
- **LinkedIn cannot be scraped.** Expect a thin read for profiles; the results say so
  (low-confidence chip) and the persona comes mostly from the URL slug.
- **Free OpenRouter models** have daily caps and are weaker at scoring.
- Function timeout is 60 s (`/api/match`) - needs a Vercel plan that allows it.

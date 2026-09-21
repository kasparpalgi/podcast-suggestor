---
name: supabase-integration
description: How THIS project wires Supabase — client files, env keys, server vs browser keys, RLS stance, the backend repo and the weekly resend cron. Thin and project-specific; general Supabase/Postgres guidance comes from the vendored `supabase` and `supabase-postgres-best-practices` skills. Use when touching Supabase client/server code, schema, or the cron.
paths:
  - src/lib/supabase/**
  - src/lib/server/**
  - src/routes/**/+*.server.ts
  - src/routes/**/+server.ts
---

## Scope

This skill covers only **how this repo uses Supabase**. For anything general — RLS
patterns, migrations, indexing, Edge Functions, query performance, pgvector, pg_cron — use
the auto-loaded vendor skills **`supabase`** and **`supabase-postgres-best-practices`**
(vendored under `.agents/`, pinned in `skills-lock.json`). Do not restate them here.

## One client, one key

| File                   | Key (env)             | Where it may run                                                          |
| ---------------------- | --------------------- | ------------------------------------------------------------------------- |
| `$lib/supabase/server` | `SUPABASE_SECRET_API` | server only (`+*.server.ts`, `+server.ts`, `$lib/server/*`); bypasses RLS |

- Uses `PUBLIC_SUPABASE_URL`. Secrets come through `$lib/server/env.ts` (`$env/dynamic`) -
  never import them into a `.svelte` or client module. A browser client (publishable key)
  is not built; add one only if something really needs it.
- No auth in this product, so no `@supabase/ssr` / cookie session. Plain `createClient`.

## Data model (app side)

Three tables, migration in the backend repo (`20260921133405_initial_schema.sql`):

- `signups` - url, url kind, email, persona (jsonb), `is_active`, unsubscribe `token`
  (DB default, 32-byte base64url), timestamps.
- `matches` - the six shows per signup (replaced on each save).
- `sends` - audit trail: `kind` (`initial`|`weekly`), `status` (`sent`|`failed`). The weekly
  cutoff is the last `sent` row.

RLS is on with **zero policies** and anon/authenticated are revoked, so the server secret key
is the only reader/writer (anon select returns 401). There is no browser client - nothing
needs one. Env is read via `$env/dynamic` in `src/lib/server/env.ts`. Data access lives in
`src/lib/server/db/`.

## Unsubscribe & weekly resend

- Unsubscribe sets `is_active = false`; link is `PUBLIC_BASE_URL` + token, GET shows a
  confirm page, only POST acts (see `doc/NOTES.md` section 4).
- Weekly resend runs as a **Vercel cron** (`vercel.json`, Mondays 09:00 UTC) hitting
  `GET /api/cron/weekly`, guarded by bearer `CRON_SECRET`. It is not pg_cron / Edge Function.
  Skips (no new episodes) are not written to `sends`, else the cutoff moves and episodes get lost.

## Backend repo & CLI

Schema, migrations, and any Edge Functions live in the sibling repo
**`../podcast-suggestor-be`**, managed with the **Supabase CLI** (`supabase` — install and
`supabase login` if missing; not installed globally yet). Do not scatter migrations into
this frontend repo. Project ref: `zckypmomsxrllqlresyt` (also in `.mcp.json`). The
**supabase MCP** is connected for docs/DB/migrations/debugging — prefer it over guessing.

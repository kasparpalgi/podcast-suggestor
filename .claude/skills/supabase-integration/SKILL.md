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

## Two clients, two keys

| File                       | Key (env)                         | Where it may run                          |
| -------------------------- | --------------------------------- | ----------------------------------------- |
| `$lib/supabase/client`     | `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | anywhere (browser + server); RLS applies  |
| `$lib/supabase/server`     | `SUPABASE_SECRET_API`             | server only (`+*.server.ts`, `+server.ts`, `$lib/server/*`) — bypasses RLS |

- Both use `PUBLIC_SUPABASE_URL`. Import env via `$env/static/public` (public) and
  `$env/static/private` (secret) so SvelteKit fails the build if a secret leaks client-side.
- No auth in this product (out of scope), so **no `@supabase/ssr` / cookie session** is
  needed — plain `createClient` from `@supabase/supabase-js` is correct. Do not add
  `@supabase/ssr` unless login is introduced.

## Data model (app side)

Signups live in one table (e.g. `signups`): the submitted URL/email, extracted persona,
the six results (or a child table), `is_active` for unsubscribe, timestamps. Writes from
the public form go through the **server** client (users are anonymous). Keep RLS on and
deny anonymous direct writes — the server key is the only writer.

## Unsubscribe & weekly resend

- Unsubscribe toggles `is_active = false` (see `NOTES.md`); the link is `PUBLIC_BASE_URL` +
  a token route, handled by a server endpoint.
- Weekly resend selects `is_active = true` signups and re-runs the email step. Implement it
  as a scheduled endpoint (Vercel cron hitting a protected `+server.ts`) **or** a Supabase
  Edge Function + `pg_cron` in the backend repo — pick one, keep the secret guarded.

## Backend repo & CLI

Schema, migrations, and any Edge Functions live in the sibling repo
**`../podcast-suggestor-be`**, managed with the **Supabase CLI** (`supabase` — install and
`supabase login` if missing; not installed globally yet). Do not scatter migrations into
this frontend repo. Project ref: `zckypmomsxrllqlresyt` (also in `.mcp.json`). The
**supabase MCP** is connected for docs/DB/migrations/debugging — prefer it over guessing.

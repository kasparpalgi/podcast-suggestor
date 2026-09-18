## Project Configuration

### About Project

**Podcast Suggestor** — a user enters a website or LinkedIn URL and their email; an LLM
pipeline builds a persona, fetches candidate shows from Podscan, scores them, and returns
**exactly 6 podcasts at a 90%+ match** with a personalized "why it's a fit" line. Results
render on-page and are emailed via Resend (with a working unsubscribe link). Signups are
stored in Supabase and a weekly cron resends a fresh list. See `doc/Requirements.md` and
`doc/NOTES.md` for the grading rubric and the architecture decisions.

IMPORTANT: **never commit or push on this project.** When work is done, hand back a
proposed branch name + a Conventional Commit message for the user to run after code review. Flag out parts that could need most the code review. Do not ask for
permission for routine build/test/edit steps. Read `doc/Requirements.md` and `doc/NOTES.md` first, follow the spec strictly, and flag any drift from the original requirements immediately.

- **Language**: TypeScript
- **Package Manager**: pnpm (`engine-strict`)
- **Frontend**: SvelteKit 2 + Svelte 5 (runes), Tailwind CSS v4, adapter-vercel
- **Backend**: Supabase (Postgres, RLS, Edge Functions, cron) — DB repo: `../podcast-suggestor-be`
- **External**: Podscan (candidates), OpenRouter (LLM), Resend (email)
- **Libraries**: `zod` (validation), `cheerio` (scrape/strip HTML), `@supabase/supabase-js`, `resend`

## How work happens here

Every request becomes **one markdown file in `.claude/todo/`** holding the original prompt at the top and the outcome (`## Results`) at the bottom. That folder is the prompt history — never rewrite the top of a file.

| Step                                  | Command            |
| ------------------------------------- | ------------------ |
| Turn a request into a task file       | `/plan <request>`  |
| Execute task file number N            | `/todo N`          |
| Check a change                        | `/verify`          |
| Audit auth / secrets / input handling | `/security-review` |

`/todo N` opens `.claude/todo/NNN-*.md`, does the work, appends `## Results`, and **renames** the file to `-DONE.md` (or `-BLOCKED.md` if a human must finish). The rename is the state — a file left `-TODO.md` means "not run yet".

These commands come from the **`dev-kit` plugin** (repo: `klarity-claude-kit`).
`.claude/settings.json` already enables it; install once per machine:

```bash
claude plugin marketplace add kasparpalgi/klarity-claude-kit
claude plugin install dev-kit@klarity
```

Improve the workflow by editing skills in that repo and bumping its `plugin.json` — every project picks it up, no copy-paste.

Durable preferences and corrections go in the session memory directory, not in this file.

## Project skills (auto-load by path)

Project-specific knowledge lives in `.claude/skills/` and loads only when you touch
matching files — keep them lean and non-overlapping:

- **`svelte-conventions`** — Svelte 5 store factory, optimistic updates, Supabase data
  access, logging, user feedback, critical runtime rules.
- **`design-system`** — visual language, Tailwind v4 tokens, the animated loading state,
  clean rendering of stripped Podscan metadata.
- **`supabase-integration`** — how *this* project wires Supabase (client files, env keys,
  server vs browser keys, RLS stance, the `../podcast-suggestor-be` repo, weekly cron).

For **general** Supabase and Postgres guidance, two vendor skills auto-load from `.agents/`
(tracked via `skills-lock.json`): `supabase` and `supabase-postgres-best-practices`. Do
**not** duplicate their content in project skills — defer to them.

## Development Workflow

1. **Plan** — use the task file in `.claude/todo/`; leave the original requirement at the top.
2. **Implement** — golden rule: *simplicity is GENIUS*. Files ~100 lines, 200 max.
3. **Research** — the `research-first` skill: check the repo, then the `svelte` MCP / docs
   before writing unfamiliar API code. Never invent a config key or import path.
4. **Verify** — run `/verify` (only the checks the change touches). No global formatters
   (`prettier --write .` is banned — per-file only; the plugin auto-formats on save).
5. **Clean up** — remove debug `console.log`; record results in the task file.

## MCP Servers

Run `claude mcp list` and confirm these are connected:

| Server       | Use                                                                                     |
| ------------ | --------------------------------------------------------------------------------------- |
| **supabase** | Docs, database, migrations, Edge Functions, branching, debugging (project already set)  |
| **svelte**   | Svelte 5 / SvelteKit docs + `svelte-autofixer`. Mandatory for Svelte work.              |

## Directory Structure

```
src/
├── routes/            # +page.svelte (form + results), +page.server.ts (actions), api/
├── lib/
│   ├── components/     # ui/ + feature components
│   ├── stores/         # *.svelte.ts — factory pattern, single $state
│   ├── server/         # LLM pipeline, Podscan, Resend, Supabase service client
│   └── supabase/       # browser + server client factories
doc/
├── Requirements.md     # spec + grading rubric
├── NOTES.md            # architecture decisions
└── todo/               # prompt + outcome history (one file per request)
.claude/skills/         # project-specific, path-scoped knowledge
.agents/skills/         # vendored Supabase skills (skills-lock.json)
```

Backend (schema, migrations, Edge Functions, pg_cron) lives in the sibling repo
`../podcast-suggestor-be`, managed with the Supabase CLI.

## Scripts Reference (pnpm)

| Script                | Purpose                                       |
| --------------------- | --------------------------------------------- |
| `pnpm dev`            | Vite dev server                               |
| `pnpm build`          | Production build (adapter-vercel)             |
| `pnpm preview`        | Preview the production build                  |
| `pnpm check`          | `svelte-kit sync` + `svelte-check` type-check |
| `pnpm test:unit`      | Vitest                                        |
| `pnpm test:e2e`       | Playwright                                    |
| `pnpm lint`           | `prettier --check` + eslint                   |

## Environment

Copy `.env.example` → `.env` and fill it. `PUBLIC_*` vars reach the browser; everything else is server-only (Resend, Podscan, OpenRouter, the Supabase **secret** key). Never import a server key into a `.svelte`/client module. `SUPABASE_DB_PASSWORD` is only needed by the Supabase CLI in the backend repo, not by this app.

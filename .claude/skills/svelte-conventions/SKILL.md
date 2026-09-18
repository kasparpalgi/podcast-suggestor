---
name: svelte-conventions
description: This project's code conventions — Svelte 5 store factory, optimistic updates, Supabase data access, logging, user feedback and the critical runtime rules. Use whenever writing or changing Svelte/TypeScript code in this repo.
paths:
  - src/**/*.svelte
  - src/**/*.ts
---

## Store Pattern (CRITICAL)

Svelte 5 runes, factory function, single `$state` object, getters for external reads.

```typescript
import { browser } from '$app/environment';

function createStore() {
	const state = $state({ items: [], loading: false, error: null });

	async function load() {
		if (!browser) return;
		state.loading = true;
		state.error = null;
		try {
			const { data, error } = await supabase.from('signups').select('*');
			if (error) throw error;
			state.items = data ?? [];
		} catch (e) {
			state.error = e instanceof Error ? e.message : 'Failed';
		} finally {
			state.loading = false; // always reset in finally
		}
	}

	return {
		get items() { return state.items; },
		get loading() { return state.loading; },
		get error() { return state.error; },
		load
	};
}

export const store = createStore();
```

Rules: single `$state` object · `browser` guard · loading reset in `finally` · getters
prevent external mutation · async actions return `{ success, message, data? }`.

## Data access (Supabase, not GraphQL)

- **Reads/writes that need the browser client** go through `$lib/supabase/client` (the
  publishable key). RLS is enforced.
- **Privileged server work** (insert a signup, toggle `is_active` on unsubscribe, the
  weekly cron) uses the **secret** key via `$lib/supabase/server` inside `+page.server.ts`,
  `+server.ts`, or `$lib/server/*` only — never a client module.
- External calls (Podscan, OpenRouter, Resend) live in `$lib/server/*` and are invoked
  from server load/actions/endpoints. Keys never reach the client.
- Validate every external input with **Zod** at the boundary; strip Podscan HTML with
  **Cheerio** (`load(html).text()`) before it touches the LLM or the UI.

## SvelteKit data flow

- Form submit → form **action** in `+page.server.ts` (`fail()` for validation, typed
  `ActionData`). The URL/email form is progressively enhanced with `use:enhance`.
- Long LLM work (~10 s): stream or show the animated loading state (see `design-system`);
  never block the page with no feedback.

## Logging & user feedback

- Production logs: a `loggingStore` / structured logger — not raw `console.log`.
- User-facing messages: a `displayMessage()` helper (error vs success), not `alert`.
- Remove debug `console.log` before finishing.

## Critical Rules

- `if (!browser) return;` before any DOM/`localStorage`/window access.
- Never put a **server/secret** key or `SUPABASE_SECRET_API` in a client module.
- Never store sensitive data in `localStorage`.
- Factory pattern for all stores; single `$state`; expose via getters.
- Every clickable element (`<button>`, `<a>`, `onclick`, `role="button"`) includes
  `cursor-pointer`.
- Icons: use a Lucide/icon library, never inline SVG (exception: brand logos needing exact
  colors).
- After Svelte edits, run `svelte-autofixer` (svelte MCP) until clean, then `pnpm check`.

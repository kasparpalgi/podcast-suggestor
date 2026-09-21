// Thin typed wrapper over the Podscan REST API. Every response is Zod-parsed: the shape
// below is what we read, not what the docs promise, and Premium-only fields (reach.email,
// itunes ratings) are simply absent on lower tiers rather than null.

import { z } from 'zod';
import { PODSCAN_API_KEY } from '../env';
import { cached } from './cache';

const BASE = 'https://podscan.fm/api/v1';
const TIMEOUT_MS = 8000;
const RETRY_BASE_MS = 600;
/** Podcast search results move on the order of days, not minutes — six hours is free quota. */
const SEARCH_TTL_MS = 6 * 60 * 60 * 1000;
/** The weekly cron asks the same show for its latest episode once per signup that picked it. */
const EPISODE_TTL_MS = 60 * 60 * 1000;

/** 401/403 — including the "API usage requires a paid plan" 403 the whole task is blocked on. */
export class PodscanAuthError extends Error {
	name = 'PodscanAuthError';
}
/** 429, per-minute — clears on its own within the minute. */
export class PodscanRateLimitError extends Error {
	name = 'PodscanRateLimitError';
}
/**
 * 429, per-day. A separate class because the honest thing to tell the user is completely
 * different: the per-minute cap clears while they wait, the daily one does not clear until
 * tomorrow, and telling them to "try again in a minute" sends them into a retry loop that
 * cannot succeed. Trial tier is 100 req/day and 10 req/min.
 */
export class PodscanDailyLimitError extends PodscanRateLimitError {
	name = 'PodscanDailyLimitError';
}
/** Timeout, 5xx, or a body that does not match the contract. */
export class PodscanUnavailableError extends Error {
	name = 'PodscanUnavailableError';
}

const text = z
	.string()
	.nullish()
	.transform((value) => value ?? '');

const categorySchema = z.object({ category_id: text, category_name: text });

export const podcastSchema = z.object({
	podcast_id: z.string().min(1),
	podcast_name: z.string().min(1),
	podcast_url: text,
	podcast_description: text,
	podcast_image_url: text,
	publisher_name: text,
	last_posted_at: text,
	podcast_categories: z
		.array(categorySchema)
		.nullish()
		.transform((value) => value ?? []),
	// Absent on a partial response; a show we cannot prove is dead gets the benefit of the doubt
	is_active: z
		.boolean()
		.nullish()
		.transform((value) => value ?? true),
	episode_count: z.number().nullish(),
	reach: z
		.object({ audience_size: z.number().nullish() })
		.nullish()
		.transform((value) => value ?? null)
});

export type Podcast = z.infer<typeof podcastSchema>;

export const searchResponseSchema = z.object({ podcasts: z.array(podcastSchema) });

export type SearchParams = {
	query: string;
	per_page?: number;
	language?: string;
	order_by?: 'best_match' | 'audience_size' | 'episode_count' | 'rating' | 'last_posted_at';
	order_dir?: 'asc' | 'desc';
	min_episode_count?: number;
	min_last_episode_posted_at?: string;
};

/**
 * Podscan answers every request with its own accounting — `x-ratelimit-limit` / `-remaining`
 * for the per-minute window and `x-concurrency-limit` (5). We were throwing those away and
 * guessing at the burn from the dashboard the next day. Counting them here is what turns
 * "why is it 363?" into a number you can watch while a run happens.
 */
export const quota = {
	/** Requests this process has actually sent — cache hits are not calls. */
	calls: 0,
	/** Per-minute allowance left as of `at`, or null before the first answer. */
	remaining: null as number | null,
	limit: null as number | null,
	at: 0
};

const WINDOW_MS = 60_000;

/**
 * True only while we hold a *fresh* report of an empty budget. The window resets every
 * minute, so an observation older than that is worthless — treating a stale 0 as real would
 * lock the app out long after the budget came back.
 *
 * The five parallel searches of a first submission all leave before any answer returns, so
 * this cannot shape that burst. What it does stop is the request we already know will 429:
 * the expansion round firing into a budget the pool just drained, and a second submission in
 * the same minute. Those 429s return nothing but still count against the 100/day.
 */
const budgetSpent = (): boolean =>
	quota.remaining !== null && quota.remaining <= 0 && Date.now() - quota.at < WINDOW_MS;

/** Tests only — module state otherwise lives for the life of the instance. */
export function resetQuota(): void {
	Object.assign(quota, { calls: 0, remaining: null, limit: null, at: 0 });
}

function meter(path: string, status: number, headers: Headers): void {
	quota.calls++;
	const remaining = headers.get('x-ratelimit-remaining');
	const limit = headers.get('x-ratelimit-limit');
	if (remaining !== null) {
		quota.remaining = Number(remaining);
		quota.at = Date.now();
	}
	if (limit !== null) quota.limit = Number(limit);
	console.info(
		`[podscan] call ${quota.calls} this process · ${path} ${status} · ` +
			`${quota.remaining ?? '?'}/${quota.limit ?? '?'} left this minute`
	);
}

async function request<T>(
	path: string,
	query: Record<string, string | number | undefined>,
	schema: z.ZodType<T>
): Promise<T> {
	if (!PODSCAN_API_KEY) throw new PodscanAuthError('PODSCAN_API_KEY is not set');
	// Same outcome as sending it and reading the 429 back, minus the spent request
	if (budgetSpent()) {
		throw new PodscanRateLimitError('Podscan per-minute budget is spent — request not sent.');
	}

	const url = new URL(BASE + path);
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined) url.searchParams.set(key, String(value));
	}

	let response: Response;
	try {
		response = await fetch(url, {
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: { authorization: `Bearer ${PODSCAN_API_KEY}`, accept: 'application/json' }
		});
	} catch {
		throw new PodscanUnavailableError('Podscan did not answer in time.');
	}
	meter(path, response.status, response.headers);

	if (!response.ok) {
		const body = (await response.text()).slice(0, 200);
		if (response.status === 401 || response.status === 403) {
			throw new PodscanAuthError(`Podscan ${response.status}: ${body}`);
		}
		// Podscan names which cap was hit in the body: `daily_limit_exceeded` (retry_after
		// ~83000) or `per_minute_limit_exceeded` (retry_after 30-60). They need different copy
		if (response.status === 429) {
			throw body.includes('daily_limit_exceeded')
				? new PodscanDailyLimitError(`Podscan daily limit reached: ${body}`)
				: new PodscanRateLimitError(`Podscan per-minute limit reached: ${body}`);
		}
		throw new PodscanUnavailableError(`Podscan ${response.status}: ${body}`);
	}

	const parsed = schema.safeParse(await response.json().catch(() => null));
	if (!parsed.success) {
		throw new PodscanUnavailableError(
			`Podscan returned an unexpected shape: ${parsed.error.message.slice(0, 200)}`
		);
	}
	return parsed.data;
}

/**
 * One retry, jittered — but only for what a retry can actually fix (the same rule `llm.ts`
 * follows). An unpaid plan stays unpaid, and a 429 answers `retry-after: 30-60`, so retrying
 * it 600 ms later cannot succeed. It can only double our burn: five parallel terms plus
 * three expansion terms is 8 requests against a 10/min trial tier, and retrying each one
 * made it 16 — the run rate-limited itself and every later submission for the next minute.
 */
async function retrying<T>(
	path: string,
	query: Record<string, string | number | undefined>,
	schema: z.ZodType<T>
): Promise<T> {
	try {
		return await request(path, query, schema);
	} catch (error) {
		if (error instanceof PodscanAuthError || error instanceof PodscanRateLimitError) throw error;
		await new Promise((resolve) =>
			setTimeout(resolve, RETRY_BASE_MS + Math.random() * RETRY_BASE_MS)
		);
		return request(path, query, schema);
	}
}

export async function searchPodcasts(params: SearchParams): Promise<Podcast[]> {
	// Key order is fixed by the single call site, so this is stable across runs
	const { podcasts } = await cached(`search:${JSON.stringify(params)}`, SEARCH_TTL_MS, () =>
		retrying('/podcasts/search', params, searchResponseSchema)
	);
	return podcasts;
}

const episodeSchema = z.object({
	episode: z
		.object({ episode_title: text, posted_at: text })
		.nullish()
		.transform((value) => value ?? null)
});

/** Newest episode of a show, or null when it has none. Response shape is not yet checked live */
export async function getLatestEpisode(
	podcastId: string
): Promise<{ title: string; postedAt: Date } | null> {
	const { episode } = await cached(`latest:${podcastId}`, EPISODE_TTL_MS, () =>
		retrying(`/podcasts/${encodeURIComponent(podcastId)}/latest/episode`, {}, episodeSchema)
	);
	const postedAt = episode ? new Date(episode.posted_at) : null;
	return episode && postedAt && !isNaN(+postedAt)
		? { title: episode.episode_title, postedAt }
		: null;
}

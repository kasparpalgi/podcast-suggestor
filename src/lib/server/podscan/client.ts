// Thin typed wrapper over the Podscan REST API. Every response is Zod-parsed: the shape
// below is what we read, not what the docs promise, and Premium-only fields (reach.email,
// itunes ratings) are simply absent on lower tiers rather than null.

import { z } from 'zod';
import { PODSCAN_API_KEY } from '../env';

const BASE = 'https://podscan.fm/api/v1';
const TIMEOUT_MS = 8000;
const RETRY_BASE_MS = 600;

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

async function request<T>(
	path: string,
	query: Record<string, string | number | undefined>,
	schema: z.ZodType<T>
): Promise<T> {
	if (!PODSCAN_API_KEY) throw new PodscanAuthError('PODSCAN_API_KEY is not set');

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
	const { podcasts } = await retrying('/podcasts/search', params, searchResponseSchema);
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
	const { episode } = await retrying(
		`/podcasts/${encodeURIComponent(podcastId)}/latest/episode`,
		{},
		episodeSchema
	);
	const postedAt = episode ? new Date(episode.posted_at) : null;
	return episode && postedAt && !isNaN(+postedAt)
		? { title: episode.episode_title, postedAt }
		: null;
}

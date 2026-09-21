// Step 2 of the pipeline: persona.searchTerms -> one deduped pool of live, sanitized shows.

import type { Persona } from '../profile/persona';
import { PodscanAuthError, searchPodcasts, type Podcast } from './client';
import { fixtureSearch, usingFixtures } from './fixtures';
import { sanitizeDescription } from './sanitize';

// The trial tier allows 10 req/min. Five parallel searches leaves headroom for a retry
// and for the two LLM calls that bracket this step.
const MAX_TERMS = 5;
// One search request costs the same against a 100/day budget whether it returns 12 shows
// or 25, and the pool was the binding constraint on "six at 90%+" (task 018): half of a
// 45-show pool is off-world, so the right shelf is only ~10 deep. Doubling the page
// doubles the shelf for zero extra quota - it buys LLM tokens instead, which are cheap
const PER_PAGE = 25;
const MIN_EPISODES = 10;
const FRESH_MONTHS = 9; // a show silent since last winter is never a 90% fit
/** Below this, task 005 cannot honestly find six 90s — it has to widen instead. */
const HEALTHY_POOL = 35;

export type Candidate = {
	id: string;
	name: string;
	url: string;
	imageUrl: string;
	publisher: string;
	description: string;
	categories: string[];
	audienceSize: number | null;
	episodeCount: number | null;
	lastPostedAt: string;
	/** Which of the persona's terms surfaced this show — a real relevance signal for scoring. */
	matchedTerms: string[];
};

export type CandidatePool = {
	candidates: Candidate[];
	termsUsed: string[];
	degraded: boolean;
};

/**
 * Podscan lists the same show under several `podcast_id`s (re-ingested feeds), so an
 * id-only dedupe let one title appear three times in a single list. The name is the thing
 * a user would call a duplicate, so that is what we key on — punctuation, case and the
 * "The " that half the feeds carry and half do not all stripped.
 */
export const candidateKey = (name: string, id: string): string => {
	const normalized = name
		.toLowerCase()
		.replace(/^the\s+/, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
	return normalized || `id:${id}`;
};

function freshnessCutoff(): string {
	const date = new Date();
	date.setMonth(date.getMonth() - FRESH_MONTHS);
	return date.toISOString().slice(0, 10);
}

/** The API filters too, but fixtures and partial responses do not — so re-check locally. */
function isLive(podcast: Podcast, cutoff: number): boolean {
	if (!podcast.is_active) return false;
	if ((podcast.episode_count ?? 0) < MIN_EPISODES) return false;
	const posted = Date.parse(podcast.last_posted_at);
	// An unparseable date is missing data, not proof the show is dead
	return Number.isNaN(posted) ? true : posted >= cutoff;
}

function toCandidate(podcast: Podcast, term: string): Candidate {
	return {
		id: podcast.podcast_id,
		name: podcast.podcast_name,
		url: podcast.podcast_url,
		imageUrl: podcast.podcast_image_url,
		publisher: sanitizeDescription(podcast.publisher_name),
		description: sanitizeDescription(podcast.podcast_description),
		categories: podcast.podcast_categories.map((category) => category.category_name),
		audienceSize: podcast.reach?.audience_size ?? null,
		episodeCount: podcast.episode_count ?? null,
		lastPostedAt: podcast.last_posted_at,
		matchedTerms: [term]
	};
}

function searchTerm(term: string): Promise<Podcast[]> {
	if (usingFixtures()) return fixtureSearch(term, PER_PAGE);
	return searchPodcasts({
		query: term,
		per_page: PER_PAGE,
		language: 'en',
		order_by: 'audience_size',
		order_dir: 'desc',
		min_episode_count: MIN_EPISODES,
		min_last_episode_posted_at: freshnessCutoff()
	});
}

export async function buildCandidatePool(
	persona: Persona,
	terms: string[] = persona.searchTerms
): Promise<CandidatePool> {
	if (usingFixtures()) {
		console.warn('[podscan] FIXTURES ACTIVE — results are hand-built, not from the live API');
	}

	const termsUsed = terms.slice(0, MAX_TERMS);
	const results = await Promise.allSettled(termsUsed.map(searchTerm));

	// An unpaid plan 403s every term; surfacing that beats reporting an empty pool
	for (const result of results) {
		if (result.status === 'rejected' && result.reason instanceof PodscanAuthError) {
			throw result.reason;
		}
	}

	const cutoff = Date.parse(freshnessCutoff());
	const byShow = new Map<string, Candidate>();
	results.forEach((result, index) => {
		if (result.status !== 'fulfilled') return;
		for (const podcast of result.value) {
			if (!isLive(podcast, cutoff)) continue;
			const key = candidateKey(podcast.podcast_name, podcast.podcast_id);
			const existing = byShow.get(key);
			// A second term finding the same show is signal; a second *copy* of it is not
			if (existing) {
				const term = termsUsed[index];
				if (!existing.matchedTerms.includes(term)) existing.matchedTerms.push(term);
			} else {
				byShow.set(key, toCandidate(podcast, termsUsed[index]));
			}
		}
	});

	const candidates = [...byShow.values()];
	const failed = results.filter((result) => result.status === 'rejected').length;
	const degraded = candidates.length < HEALTHY_POOL || failed > 0;

	console.info(
		`[podscan] ${termsUsed.length} terms, ${failed} failed -> ${candidates.length} unique candidates${degraded ? ' (degraded)' : ''}`
	);

	// Every term failing is an outage, not a person with no matching shows. Returning an
	// empty pool here renders as "0 of 6 cleared the bar" — blaming the user's niche for our
	// rate limit. The trial tier is 10 req/min and one submission spends up to 8, so two
	// submissions in the same minute land exactly here
	if (termsUsed.length && failed === termsUsed.length) {
		const [first] = results.filter((result) => result.status === 'rejected');
		throw first.reason;
	}

	return { candidates, termsUsed, degraded };
}

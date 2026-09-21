import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Persona } from '../profile/persona';
import {
	PodscanAuthError,
	PodscanRateLimitError,
	PodscanUnavailableError,
	type Podcast
} from './client';
import { buildCandidatePool } from './candidates';

vi.mock('./client', async (importOriginal) => ({
	...(await importOriginal<typeof import('./client')>()),
	searchPodcasts: vi.fn()
}));
// Force the live path; the fixture path has its own spec
vi.mock('./fixtures', () => ({ usingFixtures: () => false, fixtureSearch: vi.fn() }));

const { searchPodcasts } = await import('./client');
const search = vi.mocked(searchPodcasts);

const persona = {
	searchTerms: ['b2b saas', 'product management', 'startup growth', 'founder stories']
} as Persona;

const yesterday = new Date(Date.now() - 86_400_000).toISOString();

function podcast(id: string, overrides: Partial<Podcast> = {}): Podcast {
	return {
		podcast_id: id,
		podcast_name: `Show ${id}`,
		podcast_url: `https://example.test/${id}`,
		podcast_description: `<p>About <b>${id}</b>.</p>`,
		podcast_image_url: '',
		publisher_name: 'Publisher',
		last_posted_at: yesterday,
		podcast_categories: [{ category_id: 'business', category_name: 'Business' }],
		is_active: true,
		episode_count: 120,
		reach: { audience_size: 5000 },
		...overrides
	};
}

beforeEach(() => {
	search.mockReset();
	vi.spyOn(console, 'info').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('buildCandidatePool', () => {
	it('caps the request count at the trial-tier budget', async () => {
		search.mockResolvedValue([]);
		await buildCandidatePool({ searchTerms: ['a', 'b', 'c', 'd', 'e', 'f'] } as Persona);
		expect(search).toHaveBeenCalledTimes(5);
	});

	it('dedupes by podcast_id and records every term that matched', async () => {
		search
			.mockResolvedValueOnce([podcast('1'), podcast('2')])
			.mockResolvedValueOnce([podcast('2'), podcast('3')])
			.mockResolvedValue([]);

		const pool = await buildCandidatePool(persona);

		expect(pool.candidates.map((c) => c.id)).toEqual(['1', '2', '3']);
		expect(pool.candidates[1].matchedTerms).toEqual(['b2b saas', 'product management']);
		expect(pool.termsUsed).toEqual(persona.searchTerms);
	});

	it('dedupes re-ingested feeds that share a name under different ids', async () => {
		// Task 015 saw one title three times in a single "next best" list
		search
			.mockResolvedValueOnce([
				podcast('a', { podcast_name: 'The Marketing Millennials' }),
				podcast('b', { podcast_name: 'Marketing Millennials' }),
				podcast('c', { podcast_name: 'the  marketing millennials!' })
			])
			.mockResolvedValue([]);

		const pool = await buildCandidatePool(persona);

		expect(pool.candidates).toHaveLength(1);
		expect(pool.candidates[0].name).toBe('The Marketing Millennials');
	});

	it('records a term once even when a feed is listed twice under it', async () => {
		search
			.mockResolvedValueOnce([
				podcast('a', { podcast_name: 'Acquired' }),
				podcast('b', { podcast_name: 'Acquired' })
			])
			.mockResolvedValue([]);

		const pool = await buildCandidatePool(persona);

		expect(pool.candidates[0].matchedTerms).toEqual(['b2b saas']);
	});

	it('keeps shows apart when Podscan sends a blank name', async () => {
		search
			.mockResolvedValueOnce([
				podcast('a', { podcast_name: '' }),
				podcast('b', { podcast_name: '   ' })
			])
			.mockResolvedValue([]);

		const pool = await buildCandidatePool(persona);

		expect(pool.candidates.map((c) => c.id)).toEqual(['a', 'b']);
	});

	it('drops dead, thin and inactive shows', async () => {
		search.mockResolvedValue([
			podcast('live'),
			podcast('inactive', { is_active: false }),
			podcast('thin', { episode_count: 4 }),
			podcast('stale', { last_posted_at: '2020-01-01T00:00:00Z' })
		]);

		const pool = await buildCandidatePool(persona);
		expect(pool.candidates.map((c) => c.id)).toEqual(['live']);
	});

	it('keeps a show whose last_posted_at is unusable rather than guessing it is dead', async () => {
		search.mockResolvedValue([podcast('undated', { last_posted_at: '' })]);
		const pool = await buildCandidatePool(persona);
		expect(pool.candidates).toHaveLength(1);
	});

	it('sanitizes descriptions before they leave this step', async () => {
		search.mockResolvedValue([
			podcast('x', { podcast_description: '<p>Clean <a href="http://x.test">me</a>.</p>' })
		]);
		const [candidate] = (await buildCandidatePool(persona)).candidates;
		expect(candidate.description).toBe('Clean me.');
	});

	it('flags a thin pool as degraded so scoring knows to widen', async () => {
		search.mockResolvedValue([podcast('1'), podcast('2')]);
		const pool = await buildCandidatePool(persona);
		expect(pool.candidates).toHaveLength(2);
		expect(pool.degraded).toBe(true);
	});

	it('is not degraded once the pool clears the floor', async () => {
		const many = Array.from({ length: 25 }, (_, i) => podcast(`p${i}`));
		search.mockResolvedValue(many);
		const pool = await buildCandidatePool(persona);
		expect(pool.candidates).toHaveLength(25);
		expect(pool.degraded).toBe(false);
	});

	it('survives one failing term but reports the pool as degraded', async () => {
		const many = Array.from({ length: 25 }, (_, i) => podcast(`p${i}`));
		search.mockRejectedValueOnce(new PodscanUnavailableError('down')).mockResolvedValue(many);

		const pool = await buildCandidatePool(persona);
		expect(pool.candidates).toHaveLength(25);
		expect(pool.degraded).toBe(true);
	});

	it('rethrows an auth error instead of reporting an empty pool', async () => {
		search.mockRejectedValue(new PodscanAuthError('Podscan 403: API usage requires a paid plan'));
		await expect(buildCandidatePool(persona)).rejects.toBeInstanceOf(PodscanAuthError);
	});

	it('rethrows when every term fails, rather than returning nothing to score', async () => {
		// An empty pool renders as "0 of 6 cleared the bar" — an outage dressed up as a
		// verdict on the user's niche. The rate-limit copy is the honest one
		search.mockRejectedValue(new PodscanRateLimitError('Podscan rate limit reached.'));
		await expect(buildCandidatePool(persona)).rejects.toBeInstanceOf(PodscanRateLimitError);
	});

	it('still returns a pool when at least one term answered', async () => {
		search
			.mockResolvedValueOnce([podcast('survivor')])
			.mockRejectedValue(new PodscanRateLimitError('Podscan rate limit reached.'));

		const pool = await buildCandidatePool(persona);
		expect(pool.candidates.map((c) => c.id)).toEqual(['survivor']);
		expect(pool.degraded).toBe(true);
	});
});

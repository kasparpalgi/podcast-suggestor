import { describe, expect, it } from 'vitest';
import { fixtureSearch } from './fixtures';

describe('fixtureSearch', () => {
	it('parses the recorded file with the live response schema', async () => {
		// `.parse` inside fixtureSearch throws if the fixture drifts from the contract
		await expect(fixtureSearch('b2b saas', 12)).resolves.toHaveLength(12);
	});

	it('is deterministic per term', async () => {
		const first = await fixtureSearch('product management', 12);
		const again = await fixtureSearch('product management', 12);
		expect(first.map((p) => p.podcast_id)).toEqual(again.map((p) => p.podcast_id));
	});

	it('returns different windows for different terms', async () => {
		const a = await fixtureSearch('b2b saas', 8);
		const b = await fixtureSearch('developer tooling', 8);
		expect(a.map((p) => p.podcast_id)).not.toEqual(b.map((p) => p.podcast_id));
	});

	it('holds enough live shows to clear the pool floor', async () => {
		const all = await fixtureSearch('anything', 100);
		const live = all.filter((p) => p.is_active && (p.episode_count ?? 0) >= 10);
		expect(live.length).toBeGreaterThanOrEqual(20);
	});
});

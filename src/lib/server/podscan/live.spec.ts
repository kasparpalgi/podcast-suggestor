// Real Podscan call. Skipped by default so `pnpm test:unit` stays offline and free:
//   LIVE_PODSCAN=1 pnpm vitest --project server --run podscan/live
// Costs 5 requests of the 100/day trial budget — the second pool below must cost 0.

import { describe, expect, it } from 'vitest';
import { buildCandidatePool } from './candidates';
import { quota } from './client';
import type { Persona } from '../profile/persona';

const persona = {
	searchTerms: ['b2b saas founders', 'product management', 'startup growth', 'venture capital']
} as Persona;

describe.skipIf(!process.env.LIVE_PODSCAN)('live candidate pool', () => {
	it('builds a pool from real search results, and the repeat is free', async () => {
		const pool = await buildCandidatePool(persona);
		const spent = quota.calls;
		console.info(
			`\n── pool: ${pool.candidates.length} shows, degraded: ${pool.degraded}, ` +
				`${spent} requests spent, ${quota.remaining}/${quota.limit} left this minute`
		);
		console.info(JSON.stringify(pool.candidates.slice(0, 3), null, 2));
		expect(pool.candidates.length).toBeGreaterThan(0);
		expect(spent).toBeLessThanOrEqual(persona.searchTerms.length);

		// The 363-calls-a-day bug in one assertion: asking the same thing twice used to cost
		// twice. Re-running a submission during development must now spend nothing.
		const again = await buildCandidatePool(persona);
		expect(quota.calls).toBe(spent);
		expect(again.candidates.length).toBe(pool.candidates.length);
	}, 60_000);
});

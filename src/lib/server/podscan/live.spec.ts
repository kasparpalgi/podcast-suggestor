// Real Podscan call. Skipped by default so `pnpm test:unit` stays offline and free:
//   LIVE_PODSCAN=1 pnpm vitest --project server --run podscan/live
// Expected to fail with PodscanAuthError until the account has an active plan —
// that failure IS the check that the blocker is still standing.

import { describe, expect, it } from 'vitest';
import { buildCandidatePool } from './candidates';
import type { Persona } from '../profile/persona';

const persona = {
	searchTerms: ['b2b saas founders', 'product management', 'startup growth', 'venture capital']
} as Persona;

describe.skipIf(!process.env.LIVE_PODSCAN)('live candidate pool', () => {
	it('builds a pool from real search results', async () => {
		const pool = await buildCandidatePool(persona);
		console.info(`\n── pool: ${pool.candidates.length} shows, degraded: ${pool.degraded}`);
		console.info(JSON.stringify(pool.candidates.slice(0, 3), null, 2));
		expect(pool.candidates.length).toBeGreaterThan(0);
	}, 60_000);
});

// e2e check against real internet and real OR (OpenRouter) call. 
// Skipped by default so `pnpm test:unit` stays offline and free:
// LIVE_PROFILE=1 pnpm vitest --project server --run live
// Override targets with LIVE_SITE / LIVE_LINKEDIN.

import { describe, expect, it } from 'vitest';
import { extractProfile } from './extract';
import { buildPersona } from './persona';

const SITE = process.env.LIVE_SITE ?? 'https://simonowen.com';
const LINKEDIN = process.env.LIVE_LINKEDIN ?? 'https://www.linkedin.com/in/kasparpalgi';

describe.skipIf(!process.env.LIVE_PROFILE)('live profile extraction', () => {
	it.each([
		['website', SITE],
		['linkedin', LINKEDIN]
	])(
		'%s',
		async (label, url) => {
			const profile = await extractProfile({ url });
			const persona = await buildPersona(profile);
			console.info(`\n── ${label}: ${url}`);
			console.info(
				`ladder: ${profile.source} @ ${profile.confidence} (${profile.text.length} chars)`
			);
			console.info(JSON.stringify(persona, null, 2));
			expect(persona.searchTerms.length).toBeGreaterThanOrEqual(4);
		},
		60_000
	);
});

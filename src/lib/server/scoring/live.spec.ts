// Real LLM run over three deliberately different people. Skipped by default so
// `pnpm test:unit` stays offline and free:
//   PODSCAN_FIXTURES=1 LIVE_SCORING=1 pnpm vitest --project server --run scoring/live
// This is the check that cannot be automated. It PRINTS the criteria, the score histogram
// and the six "why" lines so a human reads them. If they are generic - the prompt is not
// done — no assertion here can tell you that!

import { describe, expect, it } from 'vitest';
import { buildCandidatePool } from '../podscan/candidates';
import { buildPersona } from '../profile/persona';
import type { Profile } from '../profile/types';
import { rankPodcasts } from './index';

const profiles: { label: string; profile: Profile }[] = [
	{
		label: 'bootstrapped B2B SaaS founder',
		profile: {
			url: 'https://example.test/founder',
			source: 'website',
			confidence: 0.9,
			lowConfidence: false,
			text: 'I run a bootstrapped B2B SaaS doing analytics for mid-market ecommerce teams. Twelve people, no outside capital, profitable. I am hiring our first two account executives and moving us off seat-based pricing onto usage-based. Most of my week is pricing, positioning and sales process.'
		}
	},
	{
		label: 'product designer',
		profile: {
			url: 'https://example.test/designer',
			source: 'website',
			confidence: 0.85,
			lowConfidence: false,
			text: 'Product designer, eight years in. I work on design systems and complex data-heavy interfaces for healthcare software. Interested in accessibility, how design teams are structured, and getting better at arguing for design work with executives.'
		}
	},
	{
		label: 'narrow niche — marine survey',
		profile: {
			url: 'https://example.test/niche',
			source: 'linkedin-slug',
			confidence: 0.35,
			lowConfidence: true,
			text: 'marine survey hydrographic sonar'
		}
	}
];

describe.skipIf(!process.env.LIVE_SCORING)('live scoring run', () => {
	it.each(profiles)(
		'$label',
		async ({ label, profile }) => {
			const persona = await buildPersona(profile);
			const pool = await buildCandidatePool(persona);
			const result = await rankPodcasts(persona, pool);

			console.info(`\n${'═'.repeat(78)}\n${label.toUpperCase()}`);
			console.info(
				`persona: ${persona.role} · ${persona.industry} · confidence ${persona.confidence}`
			);
			console.info(`search terms: ${persona.searchTerms.join(' | ')}`);
			console.info('\nCRITERIA');
			for (const criterion of result.criteria) {
				console.info(
					`  ${(criterion.weight * 100).toFixed(0).padStart(3)}%  ${criterion.name} — ${criterion.description}`
				);
			}
			console.info(`\nHISTOGRAM ${JSON.stringify(result.stats.histogram)}`);
			console.info(
				`pool ${result.stats.poolSize} · scored ${result.stats.scored} · 90+ ${result.stats.qualified} · ` +
					`expanded ${result.stats.expanded} · ${result.stats.llmCalls} LLM calls`
			);
			console.info(`\nPICKS (${result.picks.length}${result.shortfall ? ' — SHORTFALL' : ''})`);
			for (const pick of result.picks) {
				console.info(`  ${pick.total}%  ${pick.candidate.name}  [${pick.standout}]`);
				console.info(`        ${pick.why}`);
				console.info(`        ${pick.perCriterion.map((c) => `${c.name} ${c.score}`).join(' · ')}`);
			}
			if (result.shortfall) {
				console.info('\nNEXT BEST');
				for (const next of result.nextBest) {
					console.info(`  ${next.total}%  ${next.candidate.name} — ${next.why}`);
				}
			}

			expect(result.picks.every((pick) => pick.total >= 90)).toBe(true);
			expect(result.picks.length).toBeLessThanOrEqual(6);
		},
		180_000
	);
});

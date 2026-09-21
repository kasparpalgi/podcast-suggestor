// The one expansion round. Fewer than six cleared 90 so ask for three new search terms —
// aimed at whichever criterion the near-misses actually lost points on, not at "more".
// Capped at one round - a second is ~25 s of extra latency for a case that should be rare
// and if one well aimed round did not find six, the pool builder is too narrow

import { z } from 'zod';
import { chatJson } from '../llm';
import { EXPANSION_SYSTEM_PROMPT, expansionUserPrompt } from '../prompts/scoring';
import { buildCandidatePool, candidateKey } from '../podscan/candidates';
import type { Persona } from '../profile/persona';
import type { Criterion, ScoredCandidate } from './types';
import { batchCount, scoreCandidates } from './score';

const NEAR_MISS_FLOOR = 80;
const NEAR_MISS_SAMPLE = 8;
const WEAK_CRITERIA = 2;

// JSON schema asks for exactly 3 - Zod accepts 1-3 so a model that returns two useful
// terms instead of three plus filler still gives us a round
const termsSchema = z.object({ searchTerms: z.array(z.string().min(2).max(60)).min(1).max(3) });

const termsJsonSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['searchTerms'],
	properties: {
		searchTerms: {
			type: 'array',
			minItems: 3,
			maxItems: 3,
			items: { type: 'string', maxLength: 60 },
			description: 'Two to four words each, aimed at the weak criteria, none already tried.'
		}
	}
};

/** Criteria the near-misses lost the most points on, worst first */
function weakestCriteria(nearMisses: ScoredCandidate[], criteria: Criterion[]): string[] {
	if (!nearMisses.length) return criteria.slice(0, WEAK_CRITERIA).map((c) => c.name);
	const averages = criteria.map((criterion, index) => ({
		name: criterion.name,
		mean:
			nearMisses.reduce((total, miss) => total + (miss.perCriterion[index]?.score ?? 0), 0) /
			nearMisses.length
	}));
	return averages
		.sort((a, b) => a.mean - b.mean)
		.slice(0, WEAK_CRITERIA)
		.map((entry) => entry.name);
}

export async function expandPool(input: {
	persona: Persona;
	criteria: Criterion[];
	scored: ScoredCandidate[];
	termsUsed: string[];
}): Promise<{ scored: ScoredCandidate[]; llmCalls: number; terms: string[] }> {
	const nearMisses = [...input.scored]
		.filter((candidate) => candidate.total >= NEAR_MISS_FLOOR)
		.sort((a, b) => b.total - a.total)
		.slice(0, NEAR_MISS_SAMPLE);

	const { searchTerms } = await chatJson({
		name: 'expansion_terms',
		system: EXPANSION_SYSTEM_PROMPT,
		user: expansionUserPrompt({
			persona: input.persona,
			weakest: weakestCriteria(nearMisses, input.criteria),
			alreadyTried: input.termsUsed,
			nearMisses: nearMisses.map((miss) => `${miss.candidate.name} (${miss.total})`)
		}),
		jsonSchema: termsJsonSchema,
		schema: termsSchema,
		temperature: 0.5
	});

	// Term we already searched returns shows we already scored — spend the budget elsewhere
	const tried = new Set(input.termsUsed.map((term) => term.toLowerCase().trim()));
	const terms = searchTerms.filter((term) => !tried.has(term.toLowerCase().trim()));
	if (!terms.length) return { scored: [], llmCalls: 1, terms: [] };

	const pool = await buildCandidatePool(input.persona, terms);
	// By name, not id - the widening round is exactly where Podscan hands back the shows we
	// already scored under a second podcast_id, and re-scoring them costs a batch for nothing
	const known = new Set(
		input.scored.map((scored) => candidateKey(scored.candidate.name, scored.candidate.id))
	);
	const novel = pool.candidates.filter(
		(candidate) => !known.has(candidateKey(candidate.name, candidate.id))
	);

	console.info(`[scoring] expansion: ${terms.join(', ')} -> ${novel.length} new shows`);
	if (!novel.length) return { scored: [], llmCalls: 1, terms };

	return {
		scored: await scoreCandidates(input.persona, input.criteria, novel),
		llmCalls: 1 + batchCount(novel.length),
		terms
	};
}

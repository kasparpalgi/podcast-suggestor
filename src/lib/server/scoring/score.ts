// Stage B - score the whole pool against the criteria in parallel batches
// Two choices:
// - Batches of 18. One 60-show prompt degrades badly - the model starts pattern matching its
//   own earlier answers and the back half of the list converges on one score.
// - Shows are referenced by their position in the batch ([1], [2]) and the criteria by
//   position too. Model echoing a long opaque podcast_id gets it wrong often enough to
//   matter - small integer it cannot

import { z } from 'zod';
import { chatJson, LlmQuotaError } from '../llm';
import { SCORING_SYSTEM_PROMPT, scoringUserPrompt } from '../prompts/scoring';
import type { Persona } from '../profile/persona';
import type { Candidate } from '../podscan/candidates';
import type { Criterion, ScoredCandidate } from './types';
import { matchScore, standoutOf } from './weights';

export const BATCH_SIZE = 18;
// Batch prompt is ~4k tokens in and ~1.5k out - several times the persona call the
// default 20 s was tuned for. Batches run in parallel so this is one wait (not one per batch)
// Not retried - 35 s twice would not fit the 60 s function ceiling and losing one batch of a
// 40-show pool is survivable in a way that losing the whole request is not
const BATCH_TIMEOUT_MS = 35_000;

export class ScoringError extends Error {
	name = 'ScoringError';
}

export const batchCount = (poolSize: number): number => Math.ceil(poolSize / BATCH_SIZE);

const replySchema = (batchSize: number, criteriaCount: number) =>
	z.object({
		results: z
			.array(
				z.object({
					ref: z.number().int().min(1).max(batchSize),
					scores: z.array(z.number().min(0).max(100)).length(criteriaCount),
					why: z.string().min(10).max(260)
				})
			)
			.max(batchSize)
	});

const replyJsonSchema = (batchSize: number, criteriaCount: number) => ({
	type: 'object',
	additionalProperties: false,
	required: ['results'],
	properties: {
		results: {
			type: 'array',
			maxItems: batchSize,
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['ref', 'scores', 'why'],
				properties: {
					ref: {
						type: 'integer',
						description: `The bracketed number of the show, 1 to ${batchSize}. One entry per show.`
					},
					scores: {
						type: 'array',
						minItems: criteriaCount,
						maxItems: criteriaCount,
						items: { type: 'number' },
						description: `0-100 for each criterion, in the order the criteria were listed.`
					},
					why: { type: 'string', maxLength: 260, description: 'One sentence, 22 words or fewer.' }
				}
			}
		}
	}
});

async function scoreBatch(
	persona: Persona,
	criteria: Criterion[],
	batch: Candidate[]
): Promise<ScoredCandidate[]> {
	const { results } = await chatJson({
		name: 'fit_scores',
		system: SCORING_SYSTEM_PROMPT,
		user: scoringUserPrompt(persona, criteria, batch),
		jsonSchema: replyJsonSchema(batch.length, criteria.length),
		schema: replySchema(batch.length, criteria.length),
		temperature: 0,
		maxTokens: 6000,
		timeoutMs: BATCH_TIMEOUT_MS,
		retry: false
	});

	const seen = new Set<number>();
	const scored: ScoredCandidate[] = [];
	for (const result of results) {
		// A repeated ref means the model scored one show twice; the first answer stands
		if (seen.has(result.ref)) continue;
		seen.add(result.ref);
		scored.push({
			candidate: batch[result.ref - 1],
			perCriterion: criteria.map((criterion, index) => ({
				name: criterion.name,
				score: Math.round(result.scores[index])
			})),
			total: matchScore(criteria, result.scores),
			why: result.why.trim(),
			standout: standoutOf(criteria, result.scores)
		});
	}
	return scored;
}

/** A batch that fails costs us its shows - not the run. Every batch failing is a real error. */
export async function scoreCandidates(
	persona: Persona,
	criteria: Criterion[],
	candidates: Candidate[]
): Promise<ScoredCandidate[]> {
	if (!candidates.length) return [];

	const batches = Array.from({ length: batchCount(candidates.length) }, (_, index) =>
		candidates.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE)
	);
	const settled = await Promise.allSettled(
		batches.map((batch) => scoreBatch(persona, criteria, batch))
	);

	const scored = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
	const failed = settled.filter((result) => result.status === 'rejected');
	if (failed.length) {
		console.warn(`[scoring] ${failed.length}/${batches.length} batches failed:`, failed[0].reason);
	}
	if (!scored.length) {
		// A quota failure is the same for every batch, and its copy is the honest one
		if (failed[0]?.reason instanceof LlmQuotaError) throw failed[0].reason;
		throw new ScoringError('Every scoring batch failed.');
	}

	return scored;
}

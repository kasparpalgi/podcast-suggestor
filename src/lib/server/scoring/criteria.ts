// Stage A - persona in 4-5 named weighted criteria out. One LLM call
// This is what makes the score legible instead of asserted: the same criteria are shown to
// the user next to every card (TODO) so "92%" has something behind it

import { z } from 'zod';
import { chatJson } from '../llm';
import { CRITERIA_SYSTEM_PROMPT, criteriaUserPrompt } from '../prompts/scoring';
import type { Persona } from '../profile/persona';
import type { Criterion } from './types';
import { normalizeWeights } from './weights';

export const criteriaSchema = z.object({
	criteria: z
		.array(
			z.object({
				name: z.string().min(3).max(60),
				description: z.string().min(10).max(300),
				// Deliberately loose - model that answers in percentages (40/30/20/10) is a
				// normalisation job not a failed call - `normalizeWeights` rescales whatever arrives
				weight: z.number().min(0).max(100)
			})
		)
		.min(4)
		.max(5)
});

// Written out rather than generated from Zod - providers differ on the JSON schema dialect
// they accept under `strict` and the descriptions are part of prompt
const criteriaJsonSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['criteria'],
	properties: {
		criteria: {
			type: 'array',
			minItems: 4,
			maxItems: 5,
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['name', 'description', 'weight'],
				properties: {
					name: { type: 'string', maxLength: 60, description: 'Two to five words.' },
					description: {
						type: 'string',
						maxLength: 300,
						description: 'One sentence: what a 95 looks like and what a 60 looks like.'
					},
					weight: {
						type: 'number',
						description: 'Share of the total score, 0.05-0.6. All weights sum to about 1.0.'
					}
				}
			}
		}
	}
};

/** Warmer than the scoring calls on purpose - criteria are creative act and a cold model
 * returns the sme four generic axes for every persona. The scoring that uses them is
 * still `temperature: 0`.
 */
export async function deriveCriteria(persona: Persona): Promise<Criterion[]> {
	const { criteria } = await chatJson({
		name: 'fit_criteria',
		system: CRITERIA_SYSTEM_PROMPT,
		user: criteriaUserPrompt(persona),
		jsonSchema: criteriaJsonSchema,
		schema: criteriaSchema,
		temperature: 0.5
	});

	const normalized = normalizeWeights(criteria);
	console.info(
		`[scoring] criteria: ${normalized.map((c) => `${c.name} (${c.weight.toFixed(2)})`).join(', ')}`
	);
	return normalized;
}

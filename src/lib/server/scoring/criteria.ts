// Stage A - persona in, four named weighted criteria out. One LLM call.
// This is what makes the score legible instead of asserted: the same criteria are shown to
// the user next to every card, so "92%" has something behind it.
//
// The four axes are FIXED and enforced by the JSON schema, not asked for in prose. Every
// earlier version asked for "4-5 criteria" and got back a checklist of the person's topics
// - pricing, analytics, sales hiring - which is four different podcasts. The single best
// show for that person then scores 95 on one axis and 70 on the rest, and nothing clears
// 90. Four fixed ways ONE show can be right for ONE person is the whole fix (task 018).

import { z } from 'zod';
import { chatJson } from '../llm';
import { CRITERIA_SYSTEM_PROMPT, criteriaUserPrompt } from '../prompts/scoring';
import type { Candidate } from '../podscan/candidates';
import type { Persona } from '../profile/persona';
import type { Criterion } from './types';
import { normalizeWeights } from './weights';

export const AXES = ['subject', 'perspective', 'level', 'substance'] as const;

const axisSchema = z.object({
	name: z.string().min(3).max(60),
	description: z.string().min(10).max(300),
	// Deliberately loose - a model that answers in percentages (40/30/20/10) is a
	// normalisation job, not a failed call; `normalizeWeights` rescales whatever arrives
	weight: z.number().min(0).max(100)
});

export const criteriaSchema = z.object({
	subject: axisSchema,
	perspective: axisSchema,
	level: axisSchema,
	substance: axisSchema
});

const axisJsonSchema = (guidance: string) => ({
	type: 'object',
	additionalProperties: false,
	required: ['name', 'description', 'weight'],
	properties: {
		name: { type: 'string', maxLength: 60, description: `Two to five words. ${guidance}` },
		description: {
			type: 'string',
			maxLength: 300,
			description: 'One sentence: what a 95 looks like, then what a 60 looks like.'
		},
		weight: {
			type: 'number',
			description: 'Share of the total score, 0.05-0.6. The four weights sum to about 1.0.'
		}
	}
});

// Written out rather than generated from Zod - providers differ on the JSON Schema dialect
// they accept under `strict`, and these descriptions are the load-bearing part of the prompt
const criteriaJsonSchema = {
	type: 'object',
	additionalProperties: false,
	required: [...AXES],
	properties: {
		subject: axisJsonSchema(
			'The field they practise. Usually the heaviest weight. See the width rule.'
		),
		perspective: axisJsonSchema(
			'Who is behind the microphone - operators, researchers, journalists, practitioners - and why that is who this person learns from.'
		),
		level: axisJsonSchema(
			'How far in the show assumes you already are - beginner, practitioner, or someone running the thing. The persona AVOID list goes here. Say it as the level the show is pitched at, never as a topic it skips.'
		),
		substance: axisJsonSchema(
			'The FORM of an episode, never its subject: specifics and real numbers versus origin stories, how long it goes, who it puts in front of the microphone, how consistently it publishes. Name no topic in this one - a topic here makes it a second subject axis and every show loses the same points twice.'
		)
	}
};

/** Near-cold. This one call decides the whole run - at 0.5 the same person got 0, 2, 3 and
 * 4 shows over 90 on four consecutive runs, because each run invented a different set of
 * axes. The axes themselves are fixed by the schema now, so the warmth was only buying
 * wording variance on the one call that can least afford it. */
export async function deriveCriteria(
	persona: Persona,
	pool: Candidate[] = []
): Promise<Criterion[]> {
	const answer = await chatJson({
		name: 'fit_criteria',
		system: CRITERIA_SYSTEM_PROMPT,
		user: criteriaUserPrompt(persona, pool),
		jsonSchema: criteriaJsonSchema,
		schema: criteriaSchema,
		temperature: 0.15
	});

	const normalized = normalizeWeights(AXES.map((axis) => answer[axis]));
	console.info(
		`[scoring] criteria: ${normalized.map((c) => `${c.name} (${c.weight.toFixed(2)})`).join(', ')}`
	);
	return normalized;
}

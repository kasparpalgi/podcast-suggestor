// Step 1: ladder evidence --> structured persona.

import { z } from 'zod';
import { chatJson } from '../llm';
import { PERSONA_SYSTEM_PROMPT, personaUserPrompt } from '../prompts/persona';
import type { Profile } from './types';

// Item counts match spec — provider enforces them under `strict` and reply with wrong number
export const personaSchema = z.object({
	role: z.string().min(2).max(200),
	seniority: z.enum(['junior', 'mid', 'senior', 'lead', 'executive', 'founder', 'unknown']),
	industry: z.string().min(2).max(200),
	audience: z.string().min(2).max(400),
	topics: z.array(z.string().min(2).max(160)).min(5).max(8),
	goals: z.array(z.string().min(3).max(300)).min(2).max(3),
	avoid: z.array(z.string().min(2).max(160)).max(3),
	confidence: z.number().min(0).max(1),
	searchTerms: z.array(z.string().min(2).max(160)).min(4).max(6)
});

export type Persona = z.infer<typeof personaSchema>;

const list = (description: string, minItems: number, maxItems: number, maxLength = 60) => ({
	type: 'array',
	description,
	minItems,
	maxItems,
	items: { type: 'string', maxLength }
});

// Written out rather than generated from Zod: providers accept slightly different JSON
// Schema dialects under `strict` & descriptions are part of the prompt
const personaJsonSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		role: { type: 'string', maxLength: 80, description: 'Their job in three or four words.' },
		seniority: {
			type: 'string',
			enum: ['junior', 'mid', 'senior', 'lead', 'executive', 'founder', 'unknown'],
			description: 'Use "unknown" rather than guessing.'
		},
		industry: { type: 'string', maxLength: 80, description: 'The market they work in.' },
		audience: { type: 'string', maxLength: 160, description: 'Who they sell to, serve or lead.' },
		topics: list('Subjects a great show for them would cover.', 5, 8),
		goals: list('What they are trying to achieve right now.', 2, 3, 140),
		avoid: list('Topically close but wrong for them — usually the wrong level.', 0, 3),
		confidence: {
			type: 'number',
			description: 'Your own honest 0-1 read of how well the evidence describes this person.'
		},
		searchTerms: list('Diverse podcast search queries — see rule 4.', 4, 6)
	},
	required: [
		'role',
		'seniority',
		'industry',
		'audience',
		'topics',
		'goals',
		'avoid',
		'confidence',
		'searchTerms'
	]
};

/**
 * One case honest degradation cannot cover: no page, no OG tags, no slug keywords and
 * no stated interests. Asking the model anyway produces a confident-looking persona built
 * from nothing - TODO: #006 catch this and ask the user for their interests instead.
 */
export class NoEvidenceError extends Error {
	constructor() {
		super('We could not read anything from that URL.');
		this.name = 'NoEvidenceError';
	}
}

/**
 * Final confidence is `min(ladder, model)`: neither an optimistic model nor an optimistic
 * scrape can talk the other one up
 */
export async function buildPersona(profile: Profile): Promise<Persona> {
	if (!profile.text.trim()) throw new NoEvidenceError();

	const persona = await chatJson({
		name: 'listener_persona',
		system: PERSONA_SYSTEM_PROMPT,
		user: personaUserPrompt(profile),
		jsonSchema: personaJsonSchema,
		schema: personaSchema
	});
	return { ...persona, confidence: Math.min(profile.confidence, persona.confidence) };
}

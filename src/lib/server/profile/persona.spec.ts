import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../llm', () => ({ chatJson: vi.fn() }));

import { chatJson } from '../llm';
import { buildPersona, NoEvidenceError, personaSchema } from './persona';
import type { Profile } from './types';

// Recorded from openai/gpt-4o-mini via OpenRouter for LI slug
const RECORDED = {
	role: 'B2B marketing lead',
	seniority: 'senior',
	industry: 'B2B SaaS',
	audience: 'Marketing and revenue teams at growing software companies',
	topics: [
		'demand generation',
		'marketing attribution',
		'content strategy',
		'sales and marketing alignment',
		'positioning'
	],
	goals: ['Generate more qualified pipeline', 'Prove marketing ROI to the board'],
	avoid: ['influencer marketing basics'],
	confidence: 0.3,
	searchTerms: [
		'b2b demand generation',
		'marketing attribution',
		'marketing leadership',
		'saas go to market',
		'positioning and messaging'
	]
};

const PROFILE: Profile = {
	source: 'linkedin-slug',
	text: 'b2b marketing',
	url: 'https://linkedin.com/in/jane-doe-b2b-marketing',
	confidence: 0.35,
	lowConfidence: true
};

describe('personaSchema', () => {
	it('accepts a recorded model reply', () => {
		expect(personaSchema.parse(RECORDED)).toMatchObject({ role: 'B2B marketing lead' });
	});

	it('rejects counts outside the spec ranges', () => {
		expect(
			personaSchema.safeParse({ ...RECORDED, topics: RECORDED.topics.slice(0, 4) }).success
		).toBe(false);
		expect(personaSchema.safeParse({ ...RECORDED, searchTerms: ['ai'] }).success).toBe(false);
		expect(personaSchema.safeParse({ ...RECORDED, avoid: ['a', 'b', 'c', 'd'] }).success).toBe(
			false
		);
	});

	it('rejects an out-of-range confidence and an invented seniority', () => {
		expect(personaSchema.safeParse({ ...RECORDED, confidence: 1.4 }).success).toBe(false);
		expect(personaSchema.safeParse({ ...RECORDED, seniority: 'wizard' }).success).toBe(false);
	});
});

describe('buildPersona', () => {
	beforeEach(() => {
		vi.mocked(chatJson).mockReset();
	});

	it('never lets the model talk its confidence above the ladder', async () => {
		vi.mocked(chatJson).mockResolvedValue({ ...RECORDED, confidence: 0.95 });
		const persona = await buildPersona(PROFILE);
		expect(persona.confidence).toBe(0.35);
	});

	it('keeps the model’s own confidence when it is the lower of the two', async () => {
		vi.mocked(chatJson).mockResolvedValue(RECORDED);
		const persona = await buildPersona(PROFILE);
		expect(persona.confidence).toBe(0.3);
	});

	it('refuses to invent a persona out of nothing', async () => {
		await expect(buildPersona({ ...PROFILE, text: '', confidence: 0 })).rejects.toBeInstanceOf(
			NoEvidenceError
		);
		expect(chatJson).not.toHaveBeenCalled();
	});
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persona } from './testData';

vi.mock('../llm', () => ({ chatJson: vi.fn(), LlmError: class extends Error {} }));

const { chatJson } = await import('../llm');
const { criteriaSchema, deriveCriteria } = await import('./criteria');
const chat = vi.mocked(chatJson);

const reply = (...weights: number[]) => ({
	criteria: weights.map((weight, index) => ({
		name: `Criterion ${index}`,
		description: 'A 95 looks like this; a 60 looks like that.',
		weight
	}))
});

beforeEach(() => {
	chat.mockReset();
	vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('deriveCriteria', () => {
	it('normalizes weights that do not sum to 1.0', async () => {
		chat.mockResolvedValue(reply(4, 3, 2, 1));
		const criteria = await deriveCriteria(persona);
		expect(criteria.map((c) => c.weight)).toEqual([0.4, 0.3, 0.2, 0.1]);
	});

	it('runs warmer than scoring — the same four generic axes every time is the failure mode', async () => {
		chat.mockResolvedValue(reply(0.25, 0.25, 0.25, 0.25));
		await deriveCriteria(persona);
		expect(chat.mock.calls[0][0].temperature).toBeGreaterThan(0);
	});

	it('sends the goals and the avoid list — the criteria are built from them', async () => {
		chat.mockResolvedValue(reply(0.25, 0.25, 0.25, 0.25));
		await deriveCriteria(persona);
		const prompt = chat.mock.calls[0][0].user;
		expect(prompt).toContain('hire the first AEs');
		expect(prompt).toContain('intro explainers');
	});
});

describe('criteriaSchema', () => {
	it('rejects fewer than four criteria', () => {
		expect(criteriaSchema.safeParse(reply(0.5, 0.5, 0.5)).success).toBe(false);
	});

	it('rejects more than five', () => {
		expect(criteriaSchema.safeParse(reply(1, 1, 1, 1, 1, 1)).success).toBe(false);
	});

	it('accepts four and five', () => {
		expect(criteriaSchema.safeParse(reply(0.4, 0.3, 0.2, 0.1)).success).toBe(true);
		expect(criteriaSchema.safeParse(reply(0.3, 0.3, 0.2, 0.1, 0.1)).success).toBe(true);
	});

	it('accepts weights expressed as percentages', () => {
		expect(criteriaSchema.safeParse(reply(40, 30, 20, 10)).success).toBe(true);
	});

	it('rejects a one-word name', () => {
		const bad = reply(1, 1, 1, 1);
		bad.criteria[0].name = 'x';
		expect(criteriaSchema.safeParse(bad).success).toBe(false);
	});
});

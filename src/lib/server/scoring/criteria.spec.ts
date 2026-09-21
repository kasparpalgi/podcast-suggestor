import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persona, pool } from './testData';

vi.mock('../llm', () => ({ chatJson: vi.fn(), LlmError: class extends Error {} }));

const { chatJson } = await import('../llm');
const { AXES, criteriaSchema, deriveCriteria } = await import('./criteria');
const chat = vi.mocked(chatJson);

const axis = (weight: number, name: string) => ({
	name,
	description: 'A 95 looks like this; a 60 looks like that.',
	weight
});

/** The four axes are fixed by the schema — a reply is one object, not a list */
const reply = (...weights: number[]) =>
	Object.fromEntries(AXES.map((name, index) => [name, axis(weights[index], `Criterion ${index}`)]));

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

	it('returns the four axes in schema order, so the scores line up with them', async () => {
		chat.mockResolvedValue(reply(0.25, 0.25, 0.25, 0.25));
		const criteria = await deriveCriteria(persona);
		expect(criteria.map((c) => c.name)).toEqual(AXES.map((_, index) => `Criterion ${index}`));
	});

	it('runs near-cold — this one call decides the run and used to swing it wildly', async () => {
		chat.mockResolvedValue(reply(0.25, 0.25, 0.25, 0.25));
		await deriveCriteria(persona);
		expect(chat.mock.calls[0][0].temperature).toBeLessThan(0.3);
	});

	it('sends the goals and the avoid list — the criteria are built from them', async () => {
		chat.mockResolvedValue(reply(0.25, 0.25, 0.25, 0.25));
		await deriveCriteria(persona);
		const prompt = chat.mock.calls[0][0].user;
		expect(prompt).toContain('hire the first AEs');
		expect(prompt).toContain('intro explainers');
	});

	// Stage A used to write its axes blind and Stage B then scored a pool that could not
	// satisfy them — the whole reason nothing cleared 90 (task 018)
	it('shows the model the shelf its axes will be scored against', async () => {
		chat.mockResolvedValue(reply(0.25, 0.25, 0.25, 0.25));
		await deriveCriteria(persona, pool(3));
		expect(chat.mock.calls[0][0].user).toContain('Show 1');
	});

	it('omits the shelf when there is no pool, rather than printing an empty heading', async () => {
		chat.mockResolvedValue(reply(0.25, 0.25, 0.25, 0.25));
		await deriveCriteria(persona);
		expect(chat.mock.calls[0][0].user).not.toContain('THE SHELF');
	});
});

describe('criteriaSchema', () => {
	it('accepts the four named axes', () => {
		expect(criteriaSchema.safeParse(reply(0.4, 0.3, 0.2, 0.1)).success).toBe(true);
	});

	it('accepts weights expressed as percentages', () => {
		expect(criteriaSchema.safeParse(reply(40, 30, 20, 10)).success).toBe(true);
	});

	// The topic-checklist reply is exactly what the fixed axes exist to make impossible
	it('rejects a bare list of criteria', () => {
		expect(criteriaSchema.safeParse({ criteria: [axis(1, 'Pricing')] }).success).toBe(false);
	});

	it('rejects a reply missing an axis', () => {
		const bad = reply(0.4, 0.3, 0.2, 0.1) as Record<string, unknown>;
		delete bad.substance;
		expect(criteriaSchema.safeParse(bad).success).toBe(false);
	});

	it('rejects a one-word name', () => {
		const bad = reply(1, 1, 1, 1);
		bad.subject.name = 'x';
		expect(criteriaSchema.safeParse(bad).success).toBe(false);
	});
});

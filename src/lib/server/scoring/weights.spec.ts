import { describe, expect, it } from 'vitest';
import type { Criterion } from './types';
import { normalizeWeights, standoutOf, weightedTotal } from './weights';

const criteria = (...weights: number[]): Criterion[] =>
	weights.map((weight, index) => ({ name: `C${index}`, description: 'x', weight }));

describe('normalizeWeights', () => {
	it('leaves weights that already sum to 1.0 alone', () => {
		expect(normalizeWeights(criteria(0.3, 0.25, 0.25, 0.1, 0.1)).map((c) => c.weight)).toEqual([
			0.3, 0.25, 0.25, 0.1, 0.1
		]);
	});

	it('rescales weights that sum to something else', () => {
		const scaled = normalizeWeights(criteria(2, 1, 1));
		expect(scaled.map((c) => c.weight)).toEqual([0.5, 0.25, 0.25]);
	});

	it('falls back to equal weights when the model returns all zeroes', () => {
		expect(normalizeWeights(criteria(0, 0, 0, 0)).map((c) => c.weight)).toEqual([
			0.25, 0.25, 0.25, 0.25
		]);
	});

	it('keeps name and description', () => {
		expect(normalizeWeights(criteria(1, 3))[0]).toMatchObject({ name: 'C0', description: 'x' });
	});
});

describe('weightedTotal', () => {
	it.each([
		// 0.3*90 + 0.25*95 + 0.25*88 + 0.1*70 + 0.1*60 = 27 + 23.75 + 22 + 7 + 6 = 85.75
		[criteria(0.3, 0.25, 0.25, 0.1, 0.1), [90, 95, 88, 70, 60], 86],
		// 0.5*100 + 0.5*80 = 90
		[criteria(0.5, 0.5), [100, 80], 90],
		// 0.4*92 + 0.4*94 + 0.2*90 = 36.8 + 37.6 + 18 = 92.4
		[criteria(0.4, 0.4, 0.2), [92, 94, 90], 92],
		[criteria(0.25, 0.25, 0.25, 0.25), [0, 0, 0, 0], 0],
		[criteria(0.25, 0.25, 0.25, 0.25), [100, 100, 100, 100], 100]
	])('matches the hand-computed total', (weighted, scores, expected) => {
		expect(weightedTotal(weighted, scores)).toBe(expected);
	});

	it('clamps a model that answers outside 0-100', () => {
		expect(weightedTotal(criteria(0.5, 0.5), [140, -20])).toBe(50);
	});

	it('treats a missing score as zero rather than NaN', () => {
		expect(weightedTotal(criteria(0.5, 0.5), [100])).toBe(50);
	});

	it('never takes a total from the model even when one is offered', () => {
		// The reply shape has no `total` field at all — this is the guarantee in type form
		const reply: { scores: number[]; total?: number } = { scores: [50, 50], total: 99 };
		expect(weightedTotal(criteria(0.5, 0.5), reply.scores)).toBe(50);
	});
});

describe('standoutOf', () => {
	it('names the highest-scoring criterion, not the heaviest-weighted one', () => {
		expect(standoutOf(criteria(0.6, 0.2, 0.2), [70, 95, 80])).toBe('C1');
	});

	it('breaks a tie toward the heavier criterion', () => {
		expect(standoutOf(criteria(0.2, 0.5), [90, 90])).toBe('C1');
	});

	it('is stable when everything scores the same at the same weight', () => {
		expect(standoutOf(criteria(0.5, 0.5), [80, 80])).toBe('C0');
	});

	it('returns an empty string for no criteria', () => {
		expect(standoutOf([], [])).toBe('');
	});
});

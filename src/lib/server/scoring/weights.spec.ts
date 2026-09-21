import { describe, expect, it } from 'vitest';
import type { Criterion } from './types';
import { matchScore, normalizeWeights, standoutOf } from './weights';

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

describe('matchScore — three or fewer axes, a plain weighted mean', () => {
	it.each([
		// 0.5*100 + 0.5*80 = 90
		[criteria(0.5, 0.5), [100, 80], 90],
		// 0.4*92 + 0.4*94 + 0.2*90 = 36.8 + 37.6 + 18 = 92.4
		[criteria(0.4, 0.4, 0.2), [92, 94, 90], 92],
		[criteria(0.5, 0.5), [0, 0], 0],
		[criteria(0.5, 0.5), [100, 100], 100]
	])('matches the hand-computed total', (weighted, scores, expected) => {
		expect(matchScore(weighted, scores)).toBe(expected);
	});

	it('clamps a model that answers outside 0-100', () => {
		expect(matchScore(criteria(0.5, 0.5), [140, -20])).toBe(50);
	});

	it('treats a missing score as zero rather than NaN', () => {
		expect(matchScore(criteria(0.5, 0.5), [100])).toBe(50);
	});

	it('never takes a total from the model even when one is offered', () => {
		// The reply shape has no `total` field at all — this is the guarantee in type form
		const reply: { scores: number[]; total?: number } = { scores: [50, 50], total: 99 };
		expect(matchScore(criteria(0.5, 0.5), reply.scores)).toBe(50);
	});
});

describe('matchScore — four or more axes, the weakest one is set aside', () => {
	it('is the reason a real show reaches 90 (task 015, "The SaaS Podcast")', () => {
		// 95 fundamentals, 95 operator, 80 pricing, 60 sales-team building.
		// All four: 0.25*95 + 0.30*95 + 0.25*80 + 0.20*60 = 84 — below a bar the spec
		// says six shows must clear. Best three: (0.25*95 + 0.30*95 + 0.25*80) / 0.80 = 90.3
		const saas = criteria(0.25, 0.3, 0.25, 0.2);
		expect(matchScore(saas, [95, 95, 80, 60])).toBe(90);
	});

	it('drops the lowest score, not the lightest criterion', () => {
		// The 40 sits on the HEAVIEST axis; dropping by weight would keep it and return 62
		const weighted = criteria(0.4, 0.2, 0.2, 0.2);
		expect(matchScore(weighted, [40, 90, 90, 90])).toBe(90);
	});

	it('re-normalises the surviving weights instead of leaving a gap', () => {
		// Without rescaling the three remaining 0.25s would total 75, not 100
		expect(matchScore(criteria(0.25, 0.25, 0.25, 0.25), [100, 100, 100, 0])).toBe(100);
	});

	it('still fails a show that is weak on more than one axis', () => {
		// One 60 forgiven, the second is not: (0.25*95 + 0.25*95 + 0.25*60) / 0.75 = 83.3
		expect(matchScore(criteria(0.25, 0.25, 0.25, 0.25), [95, 95, 60, 60])).toBe(83);
	});

	it('drops exactly one axis from five, never two', () => {
		// (0.2*90 * 4) / 0.8 = 90 — the second 50 still counts
		expect(matchScore(criteria(0.2, 0.2, 0.2, 0.2, 0.2), [90, 90, 90, 90, 50])).toBe(90);
		expect(matchScore(criteria(0.2, 0.2, 0.2, 0.2, 0.2), [90, 90, 90, 50, 50])).toBe(80);
	});

	it('breaks a tie on the lowest score toward the earlier axis, for a stable rerun', () => {
		// Both 60s tie. Dropping C0 gives (0.1*60 + 0.25*100 + 0.25*100) / 0.6 = 93.3;
		// dropping C1 would give 82. Earliest index wins, so two runs never disagree
		expect(matchScore(criteria(0.4, 0.1, 0.25, 0.25), [60, 60, 100, 100])).toBe(93);
	});

	it('is unchanged when every axis scores the same', () => {
		expect(matchScore(criteria(0.25, 0.25, 0.25, 0.25), [88, 88, 88, 88])).toBe(88);
	});

	it('clamps before it compares, so an out-of-range score is still the weakest', () => {
		expect(matchScore(criteria(0.25, 0.25, 0.25, 0.25), [120, 100, 100, -5])).toBe(100);
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

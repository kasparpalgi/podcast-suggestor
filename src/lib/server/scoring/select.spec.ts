import { describe, expect, it } from 'vitest';
import type { Candidate } from '../podscan/candidates';
import type { ScoredCandidate } from './types';
import { select, TARGET, THRESHOLD } from './select';

type Options = { publisher?: string; standout?: string; terms?: number };

function scored(id: string, total: number, options: Options = {}): ScoredCandidate {
	return {
		candidate: {
			id,
			name: `Show ${id}`,
			publisher: options.publisher ?? `Publisher ${id}`,
			matchedTerms: Array.from({ length: options.terms ?? 1 }, (_, i) => `term${i}`)
		} as Candidate,
		perCriterion: [{ name: 'Depth', score: total }],
		total,
		why: `Because ${id}.`,
		standout: options.standout ?? `Axis ${id}`
	};
}

/** n shows at 90+, each its own publisher and its own standout axis. */
const qualifying = (count: number, from = 99): ScoredCandidate[] =>
	Array.from({ length: count }, (_, i) => scored(`q${i}`, from - i));

describe('select — how many come back', () => {
	it.each([
		[0, 0, true],
		[3, 3, true],
		[5, 5, true],
		[6, 6, false],
		[7, 6, false],
		[20, 6, false]
	])('with %i qualified it returns %i picks (shortfall: %s)', (available, expected, shortfall) => {
		const result = select(qualifying(available));
		expect(result.picks).toHaveLength(expected);
		expect(result.shortfall).toBe(shortfall);
	});

	it('never pads below the threshold to reach six', () => {
		const result = select([...qualifying(4), scored('near', 89), scored('near2', 88)]);
		expect(result.picks).toHaveLength(4);
		expect(result.picks.every((pick) => pick.total >= THRESHOLD)).toBe(true);
		expect(result.shortfall).toBe(true);
	});

	it('treats exactly 90 as qualifying and 89 as not', () => {
		const result = select([scored('on', 90), scored('under', 89)]);
		expect(result.picks.map((pick) => pick.candidate.id)).toEqual(['on']);
	});
});

describe('select — ranking', () => {
	it('returns the highest totals, in descending order', () => {
		const result = select(qualifying(10));
		expect(result.picks.map((pick) => pick.total)).toEqual([99, 98, 97, 96, 95, 94]);
	});

	it('breaks ties on how many search terms surfaced the show, then on id', () => {
		const result = select([
			scored('b', 95, { terms: 1 }),
			scored('a', 95, { terms: 1 }),
			scored('c', 95, { terms: 3 })
		]);
		expect(result.picks.map((pick) => pick.candidate.id)).toEqual(['c', 'a', 'b']);
	});

	it('is deterministic across input order', () => {
		const pool = qualifying(12);
		const forward = select(pool).picks.map((pick) => pick.candidate.id);
		const reversed = select([...pool].reverse()).picks.map((pick) => pick.candidate.id);
		expect(reversed).toEqual(forward);
	});
});

describe('select — diversity guard', () => {
	it('caps a publisher at two of the six when there are alternatives', () => {
		const network = Array.from({ length: 6 }, (_, i) =>
			scored(`n${i}`, 99 - i, { publisher: 'Network', standout: `Axis ${i}` })
		);
		const result = select([...network, ...qualifying(4, 93)]);
		const fromNetwork = result.picks.filter((pick) => pick.candidate.publisher === 'Network');
		expect(fromNetwork).toHaveLength(2);
		expect(result.picks).toHaveLength(TARGET);
	});

	it('drops the publisher cap rather than return a false shortfall', () => {
		const result = select(
			Array.from({ length: 8 }, (_, i) =>
				scored(`n${i}`, 99 - i, { publisher: 'Network', standout: `Axis ${i}` })
			)
		);
		expect(result.picks).toHaveLength(TARGET);
		expect(result.shortfall).toBe(false);
	});

	it('does not cap shows with no publisher name', () => {
		const result = select(
			Array.from({ length: 6 }, (_, i) => scored(`p${i}`, 99 - i, { publisher: '  ' }))
		);
		expect(result.picks).toHaveLength(TARGET);
	});

	it('prefers a lower total on a new axis over a higher one on a taken axis', () => {
		const result = select([
			...Array.from({ length: 6 }, (_, i) => scored(`d${i}`, 99 - i, { standout: 'Depth' })),
			scored('other', 91, { standout: 'Guest calibre' })
		]);
		expect(result.picks.map((pick) => pick.candidate.id)).toContain('other');
		expect(new Set(result.picks.map((pick) => pick.standout)).size).toBe(2);
	});

	it('still fills all six when only one axis exists', () => {
		const result = select(
			Array.from({ length: 9 }, (_, i) => scored(`d${i}`, 99 - i, { standout: 'Depth' }))
		);
		expect(result.picks).toHaveLength(TARGET);
	});
});

describe('select — nextBest', () => {
	it('returns the closest three shows that missed the cut', () => {
		const result = select([
			...qualifying(6),
			scored('a', 87),
			scored('b', 85),
			scored('c', 84),
			scored('d', 70)
		]);
		expect(result.nextBest.map((pick) => pick.total)).toEqual([87, 85, 84]);
	});

	it('never includes a picked show', () => {
		const result = select(qualifying(8));
		const picked = new Set(result.picks.map((pick) => pick.candidate.id));
		expect(result.nextBest.some((pick) => picked.has(pick.candidate.id))).toBe(false);
	});

	it('is empty when nothing was scored', () => {
		expect(select([])).toEqual({ picks: [], shortfall: true, nextBest: [] });
	});
});

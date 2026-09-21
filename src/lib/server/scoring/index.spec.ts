// The control loop end to end - criteria -> score -> select -> (one expansion round)
// LLM and Podscan are mocked - tested is the wiring and the "exactly 6" rule

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CandidatePool } from '../podscan/candidates';
import { candidate, persona, pool } from './testData';

vi.mock('../llm', () => {
	class LlmError extends Error {}
	// Same hierarchy as the real module: the quota error is a subclass
	return { chatJson: vi.fn(), LlmError, LlmQuotaError: class extends LlmError {} };
});
vi.mock('../podscan/candidates', async (importOriginal) => ({
	...(await importOriginal<typeof import('../podscan/candidates')>()),
	buildCandidatePool: vi.fn()
}));

const { chatJson } = await import('../llm');
const { buildCandidatePool } = await import('../podscan/candidates');
const { rankPodcasts } = await import('./index');
const chat = vi.mocked(chatJson);
const buildPool = vi.mocked(buildCandidatePool);

// The four axes are fixed by the schema — the reply is one object keyed by axis, and
// `deriveCriteria` flattens it in that order
const CRITERIA = {
	subject: { name: 'Operator depth', description: 'x', weight: 0.25 },
	perspective: { name: 'Bootstrapped POV', description: 'y', weight: 0.25 },
	level: { name: 'Founder level', description: 'z', weight: 0.25 },
	substance: { name: 'Specifics not stories', description: 'w', weight: 0.25 }
};

const candidatePool = (count: number, prefix = ''): CandidatePool => ({
	candidates: pool(count, prefix),
	termsUsed: ['b2b saas', 'saas pricing'],
	degraded: false
});

/**
 * Scores show n at exactly `totals[n - 1]`, alternating which axis it wins on.
 * `matchScore` drops each show's weakest axis, so three equal scores plus one low one
 * come back as that number unrounded — and moving the low one moves the standout.
 */
const scoresFor = (totals: number[]) => ({
	results: totals.map((total, index) => ({
		ref: index + 1,
		scores: index % 2 ? [total, 10, total, total] : [10, total, total, total],
		why: `You are moving to usage-based pricing and show ${index + 1} covers that migration.`
	}))
});

beforeEach(() => {
	chat.mockReset();
	buildPool.mockReset();
	vi.spyOn(console, 'info').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('rankPodcasts — the happy path', () => {
	it('returns exactly six shows, all at 90 or above', async () => {
		chat
			.mockResolvedValueOnce(CRITERIA)
			.mockResolvedValueOnce(scoresFor([96, 95, 94, 93, 92, 91, 88, 70, 65, 40]));

		const result = await rankPodcasts(persona, candidatePool(10));

		expect(result.picks).toHaveLength(6);
		expect(result.picks.every((pick) => pick.total >= 90)).toBe(true);
		expect(result.shortfall).toBe(false);
		expect(result.stats.expanded).toBe(false);
	});

	it('surfaces the criteria it scored against', async () => {
		chat.mockResolvedValueOnce(CRITERIA).mockResolvedValueOnce(scoresFor([96, 95, 94, 93, 92, 91]));
		const result = await rankPodcasts(persona, candidatePool(6));
		const names = ['Operator depth', 'Bootstrapped POV', 'Founder level', 'Specifics not stories'];
		expect(result.criteria.map((c) => c.name)).toEqual(names);
		expect(result.picks[0].perCriterion.map((entry) => entry.name)).toEqual(names);
	});

	it('reports a histogram and the call budget', async () => {
		chat
			.mockResolvedValueOnce(CRITERIA)
			.mockResolvedValueOnce(scoresFor([96, 95, 94, 93, 92, 91, 85, 75, 65, 50]));

		const { stats } = await rankPodcasts(persona, candidatePool(10));

		expect(stats.histogram).toEqual({ '<60': 1, '60-69': 1, '70-79': 1, '80-89': 1, '90+': 6 });
		expect(stats.qualified).toBe(6);
		// 1 criteria call + 1 scoring batch
		expect(stats.llmCalls).toBe(2);
	});

	it('does not expand when six already cleared the bar', async () => {
		chat.mockResolvedValueOnce(CRITERIA).mockResolvedValueOnce(scoresFor([96, 95, 94, 93, 92, 91]));
		await rankPodcasts(persona, candidatePool(6));
		expect(buildPool).not.toHaveBeenCalled();
	});
});

describe('rankPodcasts — the expansion round', () => {
	it('widens once and reaches six', async () => {
		chat
			.mockResolvedValueOnce(CRITERIA)
			.mockResolvedValueOnce(scoresFor([96, 95, 94, 85, 80, 70]))
			.mockResolvedValueOnce({
				searchTerms: ['saas retention', 'usage based pricing', 'sales comp']
			})
			.mockResolvedValueOnce(scoresFor([97, 93, 91, 60]));
		buildPool.mockResolvedValue(candidatePool(4, 'x'));

		const result = await rankPodcasts(persona, candidatePool(6));

		expect(result.picks).toHaveLength(6);
		expect(result.shortfall).toBe(false);
		expect(result.stats.expanded).toBe(true);
		expect(result.stats.llmCalls).toBe(4);
	});

	it('aims the new terms at the criteria the near-misses lost points on', async () => {
		chat
			.mockResolvedValueOnce(CRITERIA)
			// all three lose their points on "operator depth", and land at 88 — near misses
			.mockResolvedValueOnce({
				results: [1, 2, 3].map((ref) => ({
					ref,
					scores: [70, 88, 88, 88],
					why: 'A concrete reason.'
				}))
			})
			.mockResolvedValueOnce({ searchTerms: ['operator interviews'] })
			.mockResolvedValueOnce(scoresFor([95]));
		buildPool.mockResolvedValue(candidatePool(1, 'x'));

		await rankPodcasts(persona, candidatePool(3));

		expect(chat.mock.calls[2][0].user).toContain(
			'WEAK CRITERIA (where the near-misses lost points): Operator depth'
		);
	});

	it('never re-searches a term the first pass already used', async () => {
		chat
			.mockResolvedValueOnce(CRITERIA)
			.mockResolvedValueOnce(scoresFor([95, 80]))
			.mockResolvedValueOnce({ searchTerms: ['B2B SaaS', 'saas retention'] })
			.mockResolvedValueOnce(scoresFor([95]));
		buildPool.mockResolvedValue(candidatePool(1, 'x'));

		await rankPodcasts(persona, candidatePool(2));

		expect(buildPool).toHaveBeenCalledWith(persona, ['saas retention']);
	});

	it('skips the Podscan call when every suggested term was already tried', async () => {
		chat
			.mockResolvedValueOnce(CRITERIA)
			.mockResolvedValueOnce(scoresFor([95, 80]))
			.mockResolvedValueOnce({ searchTerms: ['b2b saas', 'saas pricing'] });

		const result = await rankPodcasts(persona, candidatePool(2));

		expect(buildPool).not.toHaveBeenCalled();
		expect(result.shortfall).toBe(true);
	});

	it('does not re-score a show the first pass already saw', async () => {
		chat
			.mockResolvedValueOnce(CRITERIA)
			.mockResolvedValueOnce(scoresFor([95, 80]))
			.mockResolvedValueOnce({ searchTerms: ['saas retention'] })
			.mockResolvedValueOnce(scoresFor([95]));
		// The widened search returns show 1 again plus one genuinely new show
		buildPool.mockResolvedValue({
			candidates: [candidate('1'), candidate('new')],
			termsUsed: ['saas retention'],
			degraded: false
		});

		await rankPodcasts(persona, candidatePool(2));

		expect(chat.mock.calls[3][0].user).toContain('[1] Show new');
		expect(chat.mock.calls[3][0].user).toContain('SHOWS (1)');
	});

	it('expands at most once, then reports an honest shortfall', async () => {
		chat
			.mockResolvedValueOnce(CRITERIA)
			.mockResolvedValueOnce(scoresFor([95, 94, 87, 70]))
			.mockResolvedValueOnce({ searchTerms: ['saas retention'] })
			.mockResolvedValueOnce(scoresFor([91, 75]));
		buildPool.mockResolvedValue(candidatePool(2, 'x'));

		const result = await rankPodcasts(persona, candidatePool(4));

		expect(result.picks).toHaveLength(3);
		expect(result.shortfall).toBe(true);
		expect(result.picks.every((pick) => pick.total >= 90)).toBe(true);
		// Three calls & one expansion — never a second round
		expect(chat).toHaveBeenCalledTimes(4);
	});

	it('offers the closest runner-up so the screen can show it', async () => {
		chat
			.mockResolvedValueOnce(CRITERIA)
			.mockResolvedValueOnce(scoresFor([95, 94, 93, 92, 91, 87, 80]))
			.mockResolvedValueOnce({ searchTerms: ['saas retention'] });

		const result = await rankPodcasts(persona, candidatePool(7));

		expect(result.picks).toHaveLength(5);
		expect(result.shortfall).toBe(true);
		expect(result.nextBest[0].total).toBe(87);
	});

	it('keeps the first pass when widening throws', async () => {
		chat
			.mockResolvedValueOnce(CRITERIA)
			.mockResolvedValueOnce(scoresFor([95, 94, 80]))
			.mockResolvedValueOnce({ searchTerms: ['saas retention'] });
		buildPool.mockRejectedValue(new Error('Podscan 403'));

		const result = await rankPodcasts(persona, candidatePool(3));

		expect(result.picks).toHaveLength(2);
		expect(result.shortfall).toBe(true);
	});
});

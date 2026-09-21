import { beforeEach, describe, expect, it, vi } from 'vitest';
import { candidate, criteria, persona, pool } from './testData';

vi.mock('../llm', () => ({ chatJson: vi.fn(), LlmError: class extends Error {} }));

const { chatJson } = await import('../llm');
const { BATCH_SIZE, batchCount, scoreCandidates, ScoringError } = await import('./score');
const chat = vi.mocked(chatJson);

beforeEach(() => {
	chat.mockReset();
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('batchCount', () => {
	it.each([
		[0, 0],
		[1, 1],
		[18, 1],
		[19, 2],
		[60, 4]
	])('%i candidates -> %i calls', (size, calls) => {
		expect(batchCount(size)).toBe(calls);
	});
});

describe('scoreCandidates', () => {
	it('makes no call for an empty pool', async () => {
		await expect(scoreCandidates(persona, criteria, [])).resolves.toEqual([]);
		expect(chat).not.toHaveBeenCalled();
	});

	it('computes the total in TypeScript, ignoring any total the model offers', async () => {
		chat.mockResolvedValue({
			results: [{ ref: 1, scores: [100, 60], why: 'Concrete reason here.', total: 99 }]
		});

		const [scored] = await scoreCandidates(persona, criteria, pool(1));

		expect(scored.total).toBe(80); // 0.5*100 + 0.5*60
		expect(scored.perCriterion).toEqual([
			{ name: 'Depth', score: 100 },
			{ name: 'Reach', score: 60 }
		]);
		expect(scored.standout).toBe('Depth');
	});

	it('maps a ref back to the show at that position in the batch', async () => {
		chat.mockResolvedValue({
			results: [
				{ ref: 3, scores: [90, 90], why: 'Third show reason.' },
				{ ref: 1, scores: [50, 50], why: 'First show reason.' }
			]
		});

		const scored = await scoreCandidates(persona, criteria, pool(3));

		expect(scored.map((s) => [s.candidate.id, s.total])).toEqual([
			['3', 90],
			['1', 50]
		]);
	});

	it('keeps the first answer when the model scores one show twice', async () => {
		chat.mockResolvedValue({
			results: [
				{ ref: 1, scores: [90, 90], why: 'The first answer.' },
				{ ref: 1, scores: [10, 10], why: 'The second answer.' }
			]
		});

		const scored = await scoreCandidates(persona, criteria, pool(2));

		expect(scored).toHaveLength(1);
		expect(scored[0].total).toBe(90);
	});

	it('drops a show the model simply did not answer for', async () => {
		chat.mockResolvedValue({ results: [{ ref: 1, scores: [90, 90], why: 'Only one answer.' }] });
		await expect(scoreCandidates(persona, criteria, pool(2))).resolves.toHaveLength(1);
	});

	it('splits a large pool into parallel batches of 18', async () => {
		chat.mockResolvedValue({ results: [{ ref: 1, scores: [70, 70], why: 'A reason goes here.' }] });

		await scoreCandidates(persona, criteria, pool(40));

		expect(chat).toHaveBeenCalledTimes(3);
		expect(chat.mock.calls[0][0].user).toContain(`SHOWS (${BATCH_SIZE})`);
		expect(chat.mock.calls[2][0].user).toContain('SHOWS (4)');
	});

	it('scores at temperature 0', async () => {
		chat.mockResolvedValue({ results: [{ ref: 1, scores: [70, 70], why: 'A reason goes here.' }] });
		await scoreCandidates(persona, criteria, pool(1));
		expect(chat.mock.calls[0][0].temperature).toBe(0);
	});

	it('loses a failed batch, not the run', async () => {
		chat
			.mockRejectedValueOnce(new Error('502'))
			.mockResolvedValue({ results: [{ ref: 1, scores: [90, 90], why: 'A reason goes here.' }] });

		await expect(scoreCandidates(persona, criteria, pool(36))).resolves.toHaveLength(1);
	});

	it('throws when every batch fails', async () => {
		chat.mockRejectedValue(new Error('502'));
		await expect(scoreCandidates(persona, criteria, pool(20))).rejects.toBeInstanceOf(ScoringError);
	});

	it('sends the sanitized description and the terms that surfaced the show', async () => {
		chat.mockResolvedValue({ results: [{ ref: 1, scores: [70, 70], why: 'A reason goes here.' }] });

		await scoreCandidates(persona, criteria, [
			{ ...candidate('1'), description: 'Clean text.', matchedTerms: ['b2b saas', 'pricing'] }
		]);

		const prompt = chat.mock.calls[0][0].user;
		expect(prompt).toContain('about: Clean text.');
		expect(prompt).toContain('surfaced by search: b2b saas, pricing');
		expect(prompt).not.toContain('<');
	});
});

describe('scoreCandidates — latency budget', () => {
	it('gives a batch a longer wait than the persona-sized default, and does not retry it', async () => {
		chat.mockResolvedValue({ results: [{ ref: 1, scores: [70, 70], why: 'A reason goes here.' }] });

		await scoreCandidates(persona, criteria, pool(1));

		// 35 s twice would not fit the 60 s function ceiling
		expect(chat.mock.calls[0][0].timeoutMs).toBeGreaterThan(20_000);
		expect(chat.mock.calls[0][0].retry).toBe(false);
	});
});

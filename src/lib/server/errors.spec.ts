// The error table is the only place the user's copy is decided, and the failure mode is
// silent: a subclass listed after its base gets swallowed and the user reads the wrong thing.

import { describe, expect, it } from 'vitest';
import { toPipelineError } from './errors';
import { LlmError, LlmQuotaError } from './llm';
import { PodscanDailyLimitError, PodscanRateLimitError } from './podscan/client';

describe('toPipelineError — Podscan quota', () => {
	it('tells a daily-capped user to come back tomorrow, not in a minute', () => {
		// The deployed site showed "Lots of people matching right now. Try again in a minute."
		// while the real cause was our own 100/day allowance, ~23 hours from resetting
		const mapped = toPipelineError(new PodscanDailyLimitError('daily_limit_exceeded'));
		expect(mapped.code).toBe('podcast_quota');
		expect(mapped.message).toMatch(/tomorrow/i);
	});

	it('keeps the one-minute copy for the per-minute cap, which does clear on its own', () => {
		const mapped = toPipelineError(new PodscanRateLimitError('per_minute_limit_exceeded'));
		expect(mapped.code).toBe('podcast_busy');
		expect(mapped.message).toMatch(/a minute/i);
	});

	it('does not blame traffic for either — the quota is ours, not the user’s fault', () => {
		for (const error of [
			new PodscanDailyLimitError('x'),
			new PodscanRateLimitError('x')
		] as const) {
			expect(toPipelineError(error).message).not.toMatch(/lots of people|busy|popular/i);
		}
	});

	it('matches the daily subclass before its base row', () => {
		// PodscanDailyLimitError extends PodscanRateLimitError, so table order is load-bearing
		expect(new PodscanDailyLimitError('x')).toBeInstanceOf(PodscanRateLimitError);
		expect(toPipelineError(new PodscanDailyLimitError('x')).code).not.toBe('podcast_busy');
	});
});

describe('toPipelineError — the other subclass pair', () => {
	it('matches LlmQuotaError before LlmError', () => {
		expect(toPipelineError(new LlmQuotaError('402')).code).toBe('llm_quota');
		expect(toPipelineError(new LlmError('timeout')).code).toBe('llm');
	});

	it('falls back rather than throwing on something unmapped', () => {
		expect(toPipelineError(new Error('nope')).code).toBe('unknown');
	});
});

// One table: thrown error -> copy the user reads. No "something went wrong".

import { NoEvidenceError } from './profile/persona';
import { LlmQuotaError, LlmError } from './llm';
import { ScoringError } from './scoring';
import {
	PodscanAuthError,
	PodscanDailyLimitError,
	PodscanRateLimitError,
	PodscanUnavailableError
} from './podscan/client';

export type PipelineError = { code: string; message: string };

const TABLE: [new (...args: never[]) => Error, PipelineError][] = [
	[
		NoEvidenceError,
		{
			code: 'no_evidence',
			message: 'We could not read that page. Add a few interests and try again.'
		}
	],
	[
		PodscanAuthError,
		{ code: 'podcast_auth', message: 'Our podcast data source is not available right now.' }
	],
	// Before PodscanRateLimitError: a subclass has to be matched first or the base row
	// swallows it. "Try again in a minute" on a daily cap is a retry loop that cannot succeed
	[
		PodscanDailyLimitError,
		{
			code: 'podcast_quota',
			message: "We've used up today's podcast data allowance. Please try again tomorrow."
		}
	],
	[
		PodscanRateLimitError,
		{
			code: 'podcast_busy',
			message: "We're reading the podcast directory too quickly. Try again in a minute."
		}
	],
	[
		PodscanUnavailableError,
		{ code: 'podcast_down', message: 'The podcast directory did not answer. Try again soon.' }
	],
	[
		ScoringError,
		{ code: 'scoring', message: 'We could not score the shows this time. Please try again.' }
	],
	// Before LlmError: a subclass has to be matched first or the base row swallows it
	[
		LlmQuotaError,
		{
			code: 'llm_quota',
			message: 'Our matching model is out of quota right now. Please try again later.'
		}
	],
	[LlmError, { code: 'llm', message: 'Our matching model timed out or refused. Please try again.' }]
];

export function toPipelineError(error: unknown): PipelineError {
	for (const [type, mapped] of TABLE) if (error instanceof type) return mapped;
	return { code: 'unknown', message: 'Unexpected error on our side. Please try again.' };
}

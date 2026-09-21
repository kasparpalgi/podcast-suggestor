// One OpenRouter call -> must return JSON matching schema. Scoring needs same thing - lives here (rather than inside persona step)

import type { z } from 'zod';
import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from './env';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
// One retry - worst case per call. Kept inside 60s Vercel function ceiling (pipeline makes more than one of these)
const TIMEOUT_MS = 20_000;

export class LlmError extends Error {
	/** HTTP status when the failure came from OpenRouter itself, else undefined */
	readonly status?: number;

	constructor(message: string, status?: number) {
		super(message);
		this.status = status;
	}
}

export class LlmQuotaError extends LlmError {}

function isRetryable(error: unknown): boolean {
	if (!(error instanceof LlmError)) return true; // timeout / network / unparsable reply
	if (error.status === undefined) return true;
	return error.status === 429 || error.status >= 500;
}

type JsonCall<T> = {
	system: string;
	user: string;
	/** Schema name sent to the provider & Zod schema that reply must satisfy */
	name: string;
	jsonSchema: Record<string, unknown>;
	schema: z.ZodType<T>;
	temperature?: number;
	maxTokens?: number;
	/** Override for calls with a bigger prompt than persona step this default was tuned for */
	timeoutMs?: number;
	/** Off for calls the caller can survive losing — retry doubles the worst-case wait */
	retry?: boolean;
};

async function once<T>(call: JsonCall<T>): Promise<T> {
	const response = await fetch(ENDPOINT, {
		method: 'POST',
		signal: AbortSignal.timeout(call.timeoutMs ?? TIMEOUT_MS),
		headers: {
			authorization: `Bearer ${OPENROUTER_API_KEY}`,
			'content-type': 'application/json',
			'x-title': 'Podcast Suggestor'
		},
		body: JSON.stringify({
			model: OPENROUTER_MODEL,
			temperature: call.temperature ?? 0.2,
			// Cost fuse is not limit we expect hitting — leave room for a model that reasons before answering (or it spends the whole budget thinking)
			max_tokens: call.maxTokens ?? 2500,
			messages: [
				{ role: 'system', content: call.system },
				{ role: 'user', content: call.user }
			],
			reasoning: { enabled: false },
			// Route only to endpoints that actually honour schema (instead of silently falling back to provider that returns prose)
			provider: { require_parameters: true },
			response_format: {
				type: 'json_schema',
				json_schema: { name: call.name, strict: true, schema: call.jsonSchema }
			}
		})
	});

	if (!response.ok) {
		const detail = `OpenRouter ${response.status}: ${(await response.text()).slice(0, 300)}`;
		throw response.status === 402 || response.status === 429
			? new LlmQuotaError(detail, response.status)
			: new LlmError(detail, response.status);
	}

	const payload = await response.json();
	const choice = payload?.choices?.[0];
	const content = choice?.message?.content;

	if (typeof content !== 'string' || !content.trim()) {
		throw new LlmError(`OpenRouter returned no content (finish_reason: ${choice?.finish_reason})`);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch {
		throw new LlmError('OpenRouter returned content that is not JSON');
	}

	const result = call.schema.safeParse(parsed);
	if (!result.success) throw new LlmError(`Reply failed validation: ${result.error.message}`);
	return result.data;
}

/** One retry - unless caller opted out or the failure is one a retry cannot fix */
export async function chatJson<T>(call: JsonCall<T>): Promise<T> {
	if (!OPENROUTER_API_KEY) throw new LlmError('OPENROUTER_API_KEY is not set');
	try {
		return await once(call);
	} catch (error) {
		if (call.retry === false || !isRetryable(error)) throw error;
		return await once(call);
	}
}

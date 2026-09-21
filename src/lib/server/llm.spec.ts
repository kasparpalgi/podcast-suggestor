import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('./env', () => ({ OPENROUTER_API_KEY: 'test-key', OPENROUTER_MODEL: 'test/model' }));

const { chatJson, LlmError, LlmQuotaError } = await import('./llm');
const { toPipelineError } = await import('./errors');

const call = {
	name: 'thing',
	system: 'be brief',
	user: 'go',
	jsonSchema: { type: 'object' },
	schema: z.object({ ok: z.boolean() })
};

function reply(body: unknown) {
	return new Response(JSON.stringify(body), { status: 200 });
}

const okBody = { choices: [{ message: { content: '{"ok":true}' } }] };

afterEach(() => vi.unstubAllGlobals());

function stubFetch(...responses: Response[]) {
	const fetchMock = vi.fn();
	for (const response of responses) fetchMock.mockResolvedValueOnce(response);
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

describe('chatJson', () => {
	it('sends the configured model with reasoning off, so thinking cannot eat max_tokens', async () => {
		const fetchMock = stubFetch(reply(okBody));

		await expect(chatJson(call)).resolves.toEqual({ ok: true });

		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body.model).toBe('test/model');
		expect(body.reasoning).toEqual({ enabled: false });
	});

	it('retries a 500 and returns the second answer', async () => {
		const fetchMock = stubFetch(new Response('boom', { status: 500 }), reply(okBody));

		await expect(chatJson(call)).resolves.toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('never retries a 402 - a second call cannot buy credit', async () => {
		const fetchMock = stubFetch(new Response('needs credits', { status: 402 }));

		await expect(chatJson(call)).rejects.toBeInstanceOf(LlmQuotaError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('never retries a 401', async () => {
		const fetchMock = stubFetch(new Response('bad key', { status: 401 }));

		await expect(chatJson(call)).rejects.toBeInstanceOf(LlmError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('retries a 429, which is usually the minute limit and not the day limit', async () => {
		const fetchMock = stubFetch(new Response('slow down', { status: 429 }), reply(okBody));

		await expect(chatJson(call)).resolves.toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('retries a reply that is not JSON', async () => {
		const fetchMock = stubFetch(
			reply({ choices: [{ message: { content: 'sure! here goes' } }] }),
			reply(okBody)
		);

		await expect(chatJson(call)).resolves.toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});

describe('quota copy', () => {
	it('tells the user to come back later instead of blaming a timeout', () => {
		expect(toPipelineError(new LlmQuotaError('OpenRouter 402: no credits', 402))).toEqual({
			code: 'llm_quota',
			message: 'Our matching model is out of quota right now. Please try again later.'
		});
	});

	it('still maps a plain model failure to the generic model copy', () => {
		expect(toPipelineError(new LlmError('OpenRouter 400: bad schema', 400)).code).toBe('llm');
	});
});

// The retry rule only. Everything else about this client is covered through
// `candidates.spec.ts`, which mocks at the `searchPodcasts` boundary.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	PodscanAuthError,
	PodscanDailyLimitError,
	PodscanRateLimitError,
	PodscanUnavailableError,
	searchPodcasts
} from './client';

vi.mock('../env', () => ({ PODSCAN_API_KEY: 'test-key' }));

const reply = (status: number, body: unknown = {}) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const ok = () => reply(200, { podcasts: [] });

afterEach(() => vi.unstubAllGlobals());

/** Returns the fetch spy so a test can count how many requests actually left */
function stubFetch(...responses: Response[]) {
	const fetchMock = vi.fn();
	for (const response of responses) fetchMock.mockResolvedValueOnce(response);
	fetchMock.mockResolvedValue(ok());
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

describe('searchPodcasts — retry only what a retry can fix', () => {
	it('retries a 5xx once and returns the second answer', async () => {
		const fetchMock = stubFetch(reply(503), ok());
		await expect(searchPodcasts({ query: 'saas' })).resolves.toEqual([]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('does not retry a 429 — the reset is 30-60s away, not 600ms', async () => {
		// Retrying here cost a second slot against a 10/min tier and could never succeed,
		// so one submission burned 16 requests instead of 8 and rate-limited the next user
		const fetchMock = stubFetch(reply(429, { error: 'per_minute_limit_exceeded' }));
		await expect(searchPodcasts({ query: 'saas' })).rejects.toBeInstanceOf(PodscanRateLimitError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('tells the two 429s apart so the user gets the right copy', async () => {
		stubFetch(reply(429, { error: 'daily_limit_exceeded', retry_after: 82917 }));
		await expect(searchPodcasts({ query: 'saas' })).rejects.toBeInstanceOf(PodscanDailyLimitError);

		stubFetch(reply(429, { error: 'per_minute_limit_exceeded', retry_after: 33 }));
		const perMinute = searchPodcasts({ query: 'saas' });
		await expect(perMinute).rejects.toBeInstanceOf(PodscanRateLimitError);
		await expect(perMinute).rejects.not.toBeInstanceOf(PodscanDailyLimitError);
	});

	it('does not retry the daily cap either — it is 23 hours away, not 600ms', async () => {
		const fetchMock = stubFetch(reply(429, { error: 'daily_limit_exceeded' }));
		await expect(searchPodcasts({ query: 'saas' })).rejects.toBeInstanceOf(PodscanDailyLimitError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('does not retry a 403 — an unpaid plan stays unpaid', async () => {
		const fetchMock = stubFetch(reply(403, { message: 'API usage requires a paid plan' }));
		await expect(searchPodcasts({ query: 'saas' })).rejects.toBeInstanceOf(PodscanAuthError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('gives up with an unavailable error after the one retry also fails', async () => {
		const fetchMock = stubFetch(reply(503), reply(503));
		await expect(searchPodcasts({ query: 'saas' })).rejects.toBeInstanceOf(PodscanUnavailableError);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});

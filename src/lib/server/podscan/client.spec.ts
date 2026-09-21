// The retry rule only. Everything else about this client is covered through
// `candidates.spec.ts`, which mocks at the `searchPodcasts` boundary.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	PodscanAuthError,
	PodscanDailyLimitError,
	PodscanRateLimitError,
	PodscanUnavailableError,
	resetQuota,
	searchPodcasts
} from './client';
import { clearCache } from './cache';

vi.mock('../env', () => ({ PODSCAN_API_KEY: 'test-key' }));

const reply = (status: number, body: unknown = {}) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const ok = () => reply(200, { podcasts: [] });

/** A 200 that also reports how much of the 10/min window is left, as the real API does */
const okWith = (remaining: number) =>
	new Response(JSON.stringify({ podcasts: [] }), {
		status: 200,
		headers: {
			'content-type': 'application/json',
			'x-ratelimit-limit': '10',
			'x-ratelimit-remaining': String(remaining)
		}
	});

// Every test below searches 'saas', which is one cache key — without this the first test
// to succeed would answer all the later ones and they would silently stop testing the client
afterEach(() => {
	vi.unstubAllGlobals();
	clearCache();
	resetQuota();
});

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

describe('per-minute budget gate', () => {
	it('does not send a request Podscan has already told us it will reject', async () => {
		const fetchMock = stubFetch(okWith(0));
		await searchPodcasts({ query: 'saas' });
		expect(fetchMock).toHaveBeenCalledTimes(1);

		// The expansion round, or a second submission in the same minute. A 429 costs nothing
		// but still counts against the 100/day, so the honest move is not to send it.
		await expect(searchPodcasts({ query: 'growth' })).rejects.toBeInstanceOf(PodscanRateLimitError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('sends again once the window has had time to reset', async () => {
		vi.useFakeTimers();
		const fetchMock = stubFetch(okWith(0));
		await searchPodcasts({ query: 'saas' });
		vi.advanceTimersByTime(60_001);
		// A stale 0 must not outlive its minute, or the app locks itself out for good
		await expect(searchPodcasts({ query: 'growth' })).resolves.toEqual([]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		vi.useRealTimers();
	});

	it('still spends the budget it is told it has', async () => {
		const fetchMock = stubFetch(okWith(4));
		await searchPodcasts({ query: 'saas' });
		await expect(searchPodcasts({ query: 'growth' })).resolves.toEqual([]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});

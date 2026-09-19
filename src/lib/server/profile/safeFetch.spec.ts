import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Every hostname resolves to a public address unless test says otherwise — that keeps
// the suite off the network and makes the DNS-based rejections explicit
vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));

import type { LookupAddress } from 'node:dns';
import { lookup } from 'node:dns/promises';
import { safeFetch } from './safeFetch';

// `lookup` is overloaded; pin the `{ all: true }` shape so the mock helpers type-check.
const dns = vi.mocked(lookup as (host: string, options: unknown) => Promise<LookupAddress[]>);

const resolvesTo = (...addresses: string[]) =>
	dns.mockResolvedValue(
		addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }))
	);

// Braces matter... Vitest calls a value returned from a hook as a teardown function and
// `mockResolvedValue` returns the mock itself.
beforeEach(() => {
	resolvesTo('93.184.216.34');
});

// Hand-rolled rather than `new Response(...)` -- the constructor rejects status 999 which
// is exactly the status LinkedIn serves and the one we most need to cover
function reply(status: number, body = '', location?: string) {
	return {
		status,
		ok: status >= 200 && status < 300,
		headers: { get: (key: string) => (key === 'location' ? (location ?? null) : null) },
		body: new Blob([body]).stream()
	} as unknown as Response;
}

function mockFetch(...responses: Array<Response | Error>) {
	const calls: string[] = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string) => {
			calls.push(url);
			const next = responses.shift() ?? reply(200, 'last');
			if (next instanceof Error) throw next;
			return next;
		})
	);
	return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('safeFetch', () => {
	it('returns the body of a plain 200', async () => {
		mockFetch(reply(200, '<html>hi</html>'));
		await expect(safeFetch('https://acme.com', 1000)).resolves.toMatchObject({
			ok: true,
			body: '<html>hi</html>'
		});
	});

	it('follows a redirect and reports the final URL', async () => {
		const calls = mockFetch(reply(301, '', '/about'), reply(200, 'about us'));
		await expect(safeFetch('https://acme.com', 1000)).resolves.toMatchObject({
			ok: true,
			url: 'https://acme.com/about',
			body: 'about us'
		});
		expect(calls).toEqual(['https://acme.com', 'https://acme.com/about']);
	});

	// The whole point of the manual redirect loop - a public URL that 302s inward.
	it.each([
		['http://127.0.0.1/admin'],
		['http://169.254.169.254/latest/meta-data/'],
		['https://localhost/secrets'],
		['https://redis.internal/keys'],
		['https://db.cluster.local/'],
		['file:///etc/passwd']
	])('refuses a redirect to %s', async (target) => {
		const calls = mockFetch(reply(302, '', target));
		await expect(safeFetch('https://acme.com', 1000)).resolves.toEqual({
			ok: false,
			reason: 'unsafe'
		});
		expect(calls).toHaveLength(1); // never sent the second request
	});

	it('refuses an unsafe starting URL without calling fetch at all', async () => {
		const calls = mockFetch(reply(200, 'nope'));
		await expect(safeFetch('http://192.168.0.1/', 1000)).resolves.toEqual({
			ok: false,
			reason: 'unsafe'
		});
		expect(calls).toHaveLength(0);
	});

	it('caps redirect depth instead of looping forever', async () => {
		const calls = mockFetch(
			reply(302, '', 'https://acme.com/a'),
			reply(302, '', 'https://acme.com/b'),
			reply(302, '', 'https://acme.com/c'),
			reply(302, '', 'https://acme.com/d'),
			reply(302, '', 'https://acme.com/e')
		);
		await expect(safeFetch('https://acme.com', 1000)).resolves.toEqual({
			ok: false,
			reason: 'unreachable'
		});
		expect(calls).toHaveLength(4);
	});

	it.each([999, 403, 429, 500])('treats %i as a miss, not an error', async (status) => {
		mockFetch(reply(status, 'go away'));
		await expect(safeFetch('https://linkedin.com/in/jane-doe', 1000)).resolves.toEqual({
			ok: false,
			reason: 'blocked'
		});
	});

	// name is fine - A record is not
	it('refuses a public hostname that resolves to a private address', async () => {
		const calls = mockFetch(reply(200, 'internal'));
		resolvesTo('169.254.169.254');
		await expect(safeFetch('https://evil.com', 1000)).resolves.toEqual({
			ok: false,
			reason: 'unsafe'
		});
		expect(calls).toHaveLength(0);
	});

	it('refuses when only one of several answers is private', async () => {
		mockFetch(reply(200, 'internal'));
		resolvesTo('93.184.216.34', '10.0.0.5');
		await expect(safeFetch('https://evil.com', 1000)).resolves.toEqual({
			ok: false,
			reason: 'unsafe'
		});
	});

	it('re-resolves after a redirect, not just on the first URL', async () => {
		mockFetch(reply(302, '', 'https://stage-two.com/'), reply(200, 'internal'));
		dns
			.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
			.mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);
		await expect(safeFetch('https://acme.com', 1000)).resolves.toEqual({
			ok: false,
			reason: 'unsafe'
		});
	});

	it('refuses when the name does not resolve', async () => {
		mockFetch(reply(200, 'nope'));
		dns.mockImplementation(() => Promise.reject(new Error('ENOTFOUND')));
		await expect(safeFetch('https://acme.com', 1000)).resolves.toEqual({
			ok: false,
			reason: 'unsafe'
		});
	});

	it('refuses when DNS answers with nothing at all', async () => {
		mockFetch(reply(200, 'nope'));
		dns.mockResolvedValue([]);
		await expect(safeFetch('https://acme.com', 1000)).resolves.toEqual({
			ok: false,
			reason: 'unsafe'
		});
	});

	it('swallows a network failure', async () => {
		mockFetch(new Error('ECONNREFUSED'));
		await expect(safeFetch('https://acme.com', 1000)).resolves.toEqual({
			ok: false,
			reason: 'unreachable'
		});
	});
});

// One guarded HTTP GET - real-browser headers, hard timeout, capped read and the part
// that matters — SSRF check re-runs on every redirect hop not just on the URL the
// user typed. A public URL that 302s to http://169.254.169.254/ is the whole attack

import { lookup } from 'node:dns/promises';
import { normalizeUrl } from '$lib/url';
import { isPrivateAddress } from './privateAddress';

const USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const MAX_REDIRECTS = 3;
const MAX_CHARS = 500_000;
// Hostnames that look public but resolve inside a network. `normalizeUrl` already rejects bare IPs and `localhost` - these are the name-based leftovers
const INTERNAL_HOST = /(^|\.)(local|internal|localdomain|home\.arpa|cluster\.local)$/i;
// A DNS lookup should take ms - if not thenb not waiting for it inside a request the user is watching
const DNS_TIMEOUT_MS = 1500;

export type FetchOutcome =
	| { ok: true; url: string; status: number; body: string }
	| { ok: false; reason: 'blocked' | 'unreachable' | 'unsafe' };

/**
 * Name checks first then the one that matters: resolve the host and refuse if
 * any answer is a private or reserved address. Without this `evil.com A 169.254.169.254`
 * walks straight through every hostname rule above it
 *
 * TODO: risk between this lookup and `fetch`'s own - a hostile DNS server can answer
 * differently (classic rebinding). Closing that needs dispatcher pinned to the address
 * code checked... documented in `doc/NOTES.md` (rather than silently assumed away)
 */
async function isSafe(url: string): Promise<boolean> {
	const normalized = normalizeUrl(url);
	if (!normalized.ok) return false;

	const { hostname } = new URL(normalized.url);
	if (INTERNAL_HOST.test(hostname)) return false;

	try {
		const answers = await Promise.race([
			lookup(hostname, { all: true }),
			new Promise<never>((_, reject) => setTimeout(reject, DNS_TIMEOUT_MS, new Error('dns')))
		]);
		return answers.length > 0 && answers.every((answer) => !isPrivateAddress(answer.address));
	} catch {
		return false; // NXDOMAIN, or a resolver too slow to trust
	}
}

/** Read the body but stop once we have enough — some sites stream mbs of markup. */
async function readCapped(response: Response): Promise<string> {
	const reader = response.body?.getReader();
	if (!reader) return '';
	const decoder = new TextDecoder();
	let text = '';
	try {
		while (text.length < MAX_CHARS) {
			const { done, value } = await reader.read();
			if (done) break;
			text += decoder.decode(value, { stream: true });
		}
	} finally {
		await reader.cancel().catch(() => undefined);
	}
	return text.slice(0, MAX_CHARS);
}

export async function safeFetch(url: string, timeoutMs: number): Promise<FetchOutcome> {
	let target = url;

	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		if (!(await isSafe(target))) return { ok: false, reason: 'unsafe' };

		let response: Response;
		try {
			response = await fetch(target, {
				redirect: 'manual',
				signal: AbortSignal.timeout(timeoutMs),
				headers: {
					'user-agent': USER_AGENT,
					accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'accept-language': 'en'
				}
			});
		} catch {
			return { ok: false, reason: 'unreachable' };
		}

		const location = response.headers.get('location');
		if (response.status >= 300 && response.status < 400 && location) {
			await response.body?.cancel().catch(() => undefined);
			try {
				target = new URL(location, target).toString();
			} catch {
				return { ok: false, reason: 'unreachable' };
			}
			continue;
		}

		// 999 LI's "we know you're robot". Miss not error!
		if (!response.ok) {
			await response.body?.cancel().catch(() => undefined);
			return { ok: false, reason: 'blocked' };
		}

		return { ok: true, url: target, status: response.status, body: await readCapped(response) };
	}

	return { ok: false, reason: 'unreachable' };
}

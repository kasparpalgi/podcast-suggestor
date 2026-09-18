export type NormalizeResult = { ok: true; url: string } | { ok: false; error: string };

// Built from a string so the escapes survive formatting rather than becoming literal chars.
const ZERO_WIDTH = new RegExp('\\u200B|\\u200C|\\u200D|\\u2060|\\uFEFF', 'g');
// Query params that carry no meaning for us and just make the URL ugly.
const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|igshid$|si$|_ga$)/i;

function fail(error: string): NormalizeResult {
	return { ok: false, error };
}

function isBareIp(host: string): boolean {
	if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true; // IPv4
	if (host.includes(':') || host.startsWith('[')) return true; // IPv6 literal
	return false;
}

export function normalizeUrl(input: string): NormalizeResult {
	const cleaned = (input ?? '').replace(ZERO_WIDTH, '').trim();
	if (!cleaned) return fail('Enter your website or LinkedIn URL.');
	// A space in the middle means someone typed a sentence, not an address.
	if (/\s/.test(cleaned)) return fail('That looks like text — paste a URL instead.');

	let withScheme: string;
	const scheme = cleaned.match(/^([a-z][a-z0-9+.-]*):(.*)$/i);
	if (/^https?:\/\//i.test(cleaned)) {
		withScheme = cleaned.replace(/^http:\/\//i, 'https://');
	} else if (scheme && !/^\d+(\/|\?|$)/.test(scheme[2])) {
		// A real foreign scheme (javascript:, ftp://, mailto:) — not a "host:port".
		return fail('Enter a website or LinkedIn URL.');
	} else {
		withScheme = `https://${cleaned}`;
	}

	let parsed: URL;
	try {
		parsed = new URL(withScheme);
	} catch {
		return fail("That doesn't look like a valid URL.");
	}
	if (parsed.protocol !== 'https:') return fail('Enter a website or LinkedIn URL.');

	const host = parsed.hostname.toLowerCase();
	if (host === 'localhost') return fail('Enter a public website, not localhost.');
	if (isBareIp(host)) return fail('Enter a domain name, not an IP address.');
	if (!host.includes('.')) return fail('Enter a full domain, e.g. example.com.');

	const tld = host.split('.').pop() ?? '';
	if (!/^[a-z]{2,}$/.test(tld) && !tld.startsWith('xn--')) {
		return fail("That domain's ending doesn't look right.");
	}

	for (const key of [...parsed.searchParams.keys()]) {
		if (TRACKING_PARAM.test(key)) parsed.searchParams.delete(key);
	}
	const search = parsed.searchParams.toString();
	const url = `${parsed.origin}${parsed.pathname}${search ? `?${search}` : ''}`.replace(/\/$/, '');
	return { ok: true, url };
}

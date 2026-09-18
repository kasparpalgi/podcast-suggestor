import { describe, it, expect } from 'vitest';
import { normalizeUrl } from './url';

describe('normalizeUrl — accepts and canonicalizes', () => {
	const ok: [string, string][] = [
		['domain.com', 'https://domain.com'],
		['HTTP://Domain.com/', 'https://domain.com'],
		['  domain.com  ', 'https://domain.com'],
		['https://domain.com/blog/', 'https://domain.com/blog'],
		['linkedin.com/in/jane-doe-b2b-7a3b21', 'https://linkedin.com/in/jane-doe-b2b-7a3b21'],
		['uk.linkedin.com/in/x', 'https://uk.linkedin.com/in/x'],
		['linkedin.com/company/acme', 'https://linkedin.com/company/acme'],
		['shop.example.co.uk', 'https://shop.example.co.uk'],
		// zero-width chars are stripped
		['dom​ain.com', 'https://domain.com'],
		// tracking params dropped, real ones kept
		['example.com/p?utm_source=news&q=1', 'https://example.com/p?q=1'],
		['example.com/p?utm_source=news', 'https://example.com/p'],
		// IDN host is punycoded, still valid
		['münchen.de', 'https://xn--mnchen-3ya.de']
	];
	it.each(ok)('%s → %s', (input, expected) => {
		const result = normalizeUrl(input);
		expect(result).toEqual({ ok: true, url: expected });
	});
});

describe('normalizeUrl — rejects', () => {
	const bad = [
		'',
		'   ',
		'not a url',
		'javascript:alert(1)',
		'mailto:me@x.com',
		'ftp://x.com',
		'localhost:3000',
		'192.168.1.1',
		'http://[::1]',
		'nodothost'
	];
	it.each(bad)('rejects %s', (input) => {
		const result = normalizeUrl(input);
		expect(result.ok).toBe(false);
	});
});

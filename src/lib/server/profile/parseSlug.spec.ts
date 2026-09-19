import { describe, expect, it } from 'vitest';
import { parseCompanySlug, parseSlug } from './parseSlug';

describe('parseSlug', () => {
	const cases: Array<[string, string, number]> = [
		// [slug, expected keyword payload, expected confidence]
		['jane-doe-b2b-marketing-7a3b21', 'b2b marketing', 0.35],
		['jane-doe-b2b-marketing', 'b2b marketing', 0.35],
		['lex-doe-fractional-cfo-saas', 'fractional cfo saas', 0.35],
		['ari-novak-platform', 'platform', 0.2],
		// A hash made only of digits and one with a leading letter
		['sam-rivera-devrel-123456789', 'devrel', 0.2],
		['sam-rivera-devrel-a1b2c3d4', 'devrel', 0.2],
		// ... short hex-looking token that carries meaning stay
		['pat-lee-b2b', 'b2b', 0.2],
		['pat-lee-web3-defi', 'web3 defi', 0.35],
		// Nothing but a name
		['jane-doe', '', 0],
		['jane-doe-a1b2c3d4', '', 0],
		// A name with nothing attached zero value - however it is spelled
		['marketingjane', '', 0],
		['jane-marketing', '', 0],
		// Underscores and percent encoding
		['jane_doe_growth_lead', 'growth lead', 0.35],
		['jane-doe-b2b%20sales', 'b2b sales', 0.2],
		// Junk in - zero confidence out
		['---', '', 0]
	];

	it.each(cases)('%s → "%s" @ %f', (slug, text, confidence) => {
		expect(parseSlug(slug)).toEqual({ text, confidence });
	});
});

describe('parseCompanySlug', () => {
	it('keeps the whole slug as the name and guesses a domain', () => {
		expect(parseCompanySlug('acme-analytics')).toEqual({
			name: 'acme analytics',
			guessedUrl: 'https://acme-analytics.com'
		});
	});

	it('drops a trailing hash but never the last token', () => {
		expect(parseCompanySlug('acme-7a3b21')).toEqual({
			name: 'acme',
			guessedUrl: 'https://acme.com'
		});
		expect(parseCompanySlug('a1b2c3d4')).toEqual({
			name: 'a1b2c3d4',
			guessedUrl: 'https://a1b2c3d4.com'
		});
	});
});

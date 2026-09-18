import { describe, it, expect } from 'vitest';
import { classifyUrl, type Classification } from './classifyUrl';

describe('classifyUrl', () => {
	const cases: [string, Classification][] = [
		[
			'https://linkedin.com/in/jane-doe-b2b-7a3b21',
			{ kind: 'linkedin-person', slug: 'jane-doe-b2b-7a3b21' }
		],
		['https://uk.linkedin.com/in/x', { kind: 'linkedin-person', slug: 'x' }],
		['https://www.linkedin.com/in/lex', { kind: 'linkedin-person', slug: 'lex' }],
		['https://linkedin.com/company/acme', { kind: 'linkedin-company', slug: 'acme' }],
		['https://de.linkedin.com/company/acme-gmbh', { kind: 'linkedin-company', slug: 'acme-gmbh' }],
		['https://example.com', { kind: 'website' }],
		// a fake host that merely ends in "linkedin.com" as a string is not LinkedIn
		['https://notlinkedin.com/in/x', { kind: 'website' }],
		// LinkedIn but not a profile/company path
		['https://linkedin.com/feed', { kind: 'website' }]
	];
	it.each(cases)('%s', (input, expected) => {
		expect(classifyUrl(input)).toEqual(expected);
	});
});

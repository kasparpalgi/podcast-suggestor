import { describe, expect, it } from 'vitest';
import { buildEmail } from './template';

const pick = (name: string) => ({
	name,
	url: 'https://example.com/a',
	imageUrl: 'https://example.com/a.png',
	score: 93,
	why: 'You will like it.'
});
const base = {
	unsubscribeUrl: 'https://x.test/unsubscribe?token=t',
	signedUpAt: new Date(),
	submittedUrl: 'https://me.test'
};

describe('buildEmail', () => {
	it('has html, text, unsubscribe link and alt text', () => {
		const { html, text } = buildEmail({ ...base, picks: [pick('Show A')] });
		expect(html).toContain('unsubscribe?token=t');
		expect(html).toContain('alt="Show A cover art"');
		expect(text).toContain('Unsubscribe: https://x.test/unsubscribe?token=t');
	});
	it('escapes html and drops non-http urls', () => {
		const { html } = buildEmail({
			...base,
			picks: [{ ...pick('<b>x</b>'), url: 'javascript:alert(1)', imageUrl: 'data:x' }]
		});
		expect(html).not.toContain('<b>x</b>');
		expect(html).not.toContain('javascript:');
		expect(html).not.toContain('data:x');
	});
});

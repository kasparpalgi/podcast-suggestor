import { describe, expect, it } from 'vitest';
import { sanitizeDescription } from './sanitize';

// Composite of the things real feed descriptions actually do
const NASTY = `
<div class="feed">
	<script>window.analytics.track("open");alert("xss")</script>
	<style>.feed{color:red}</style>
	<p>Welcome to <b>The Founder&rsquo;s Hour</b> &mdash; a show about building.</p>
	<p>Hosted by <a href="https://example.com/host"><span>Jane</span> &amp; <em>Sam</em></a>.</p>
	<ul><li>Fundraising</li><li>Hiring</li></ul>
	Email us at <a href="mailto:hi@example.com">hi@example.com</a><br/>New line here.
</div>
`;

describe('sanitizeDescription', () => {
	const cleaned = sanitizeDescription(NASTY);

	it('removes every tag', () => {
		expect(cleaned).not.toMatch(/[<>]/);
	});

	it('drops script and style content entirely', () => {
		expect(cleaned).not.toMatch(/analytics|alert|color:red/);
	});

	it('keeps the text of nested anchors but not the href', () => {
		expect(cleaned).toContain('Jane & Sam');
		expect(cleaned).not.toContain('example.com/host');
	});

	it('decodes entities', () => {
		expect(cleaned).toContain('Founder’s Hour');
		expect(cleaned).toContain('—');
	});

	it('separates block elements instead of gluing them together', () => {
		expect(cleaned).toContain('Fundraising Hiring');
		expect(cleaned).toContain('hi@example.com New line here.');
	});

	it('collapses whitespace', () => {
		expect(cleaned).not.toMatch(/\s{2}|\n/);
	});

	it('caps long text on a word boundary', () => {
		const long = `<p>${'podcast growth '.repeat(80)}</p>`;
		const result = sanitizeDescription(long);
		expect(result.length).toBeLessThanOrEqual(601);
		expect(result.endsWith('…')).toBe(true);
		expect(result).not.toMatch(/\s…$/);
	});

	it('leaves short plain text alone', () => {
		expect(sanitizeDescription('A weekly show.')).toBe('A weekly show.');
	});

	it('returns an empty string for empty or whitespace input', () => {
		expect(sanitizeDescription('')).toBe('');
		expect(sanitizeDescription('   \n  ')).toBe('');
	});
});

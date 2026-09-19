import { describe, expect, it } from 'vitest';
import { readHtml } from './fetchPage';
import authwall from './fixtures/linkedin-authwall.html?raw';
import jsonld from './fixtures/jsonld.html?raw';
import linkedinOg from './fixtures/linkedin-og.html?raw';
import website from './fixtures/website.html?raw';

describe('readHtml', () => {
	it('reads a normal site: title, meta, headings and main copy', () => {
		const text = readHtml(website);
		expect(text).toContain('Lex Doe — Fractional CFO for seed-stage SaaS');
		expect(text).toContain('og:title: Lex Doe, Fractional CFO');
		expect(text).toContain('Financial modelling that survives the board meeting');
		expect(text).toContain('Ten years in venture finance');
	});

	it('drops chrome, scripts and untargeted meta', () => {
		const text = readHtml(website) ?? '';
		expect(text).not.toContain('window.analytics');
		expect(text).not.toContain('Pricing');
		expect(text).not.toContain('All rights reserved');
		expect(text).not.toContain('width=device-width');
	});

	it('mines JSON-LD, flattens nested values and survives a malformed block', () => {
		const text = readHtml(jsonld) ?? '';
		expect(text).toContain('jobTitle: Principal Platform Engineer');
		expect(text).toContain('knowsAbout: Kubernetes, platform engineering, developer experience');
		expect(text).not.toContain('arinovak.dev'); // @type WebSite is not a person or a company
	});

	it('treats a LinkedIn auth wall as a miss, not as content', () => {
		expect(readHtml(authwall)).toBeNull();
	});

	it('keeps LinkedIn OG tags when they actually name the person', () => {
		const text = readHtml(linkedinOg) ?? '';
		expect(text).toContain('Jane Doe - Head of Growth - Acme');
		expect(text).toContain('paid acquisition and lifecycle');
		expect(text).not.toContain('Join now to see'); // the marketing body stays out
	});

	it('returns null when there is nothing worth sending to the model', () => {
		expect(readHtml('<html><body><p>Hi</p></body></html>')).toBeNull();
	});
});

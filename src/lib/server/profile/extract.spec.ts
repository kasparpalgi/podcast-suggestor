import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./fetchPage', () => ({ fetchPage: vi.fn() }));

import { extractProfile } from './extract';
import { fetchPage } from './fetchPage';

const page = vi.mocked(fetchPage);
const THIN = 'Head of Growth at Acme. Paid acquisition and lifecycle for a B2B SaaS.';
const BODY = THIN.repeat(8); // comfortably past the full-read threshold

beforeEach(() => {
	page.mockReset();
});

describe('extractProfile', () => {
	it('uses the page when a website reads', async () => {
		page.mockResolvedValue(BODY);
		const profile = await extractProfile({ url: 'https://acme.com' });
		expect(profile).toMatchObject({ source: 'website', confidence: 0.9, lowConfidence: false });
	});

	it('discounts a page that barely said anything', async () => {
		page.mockResolvedValue(THIN);
		const profile = await extractProfile({ url: 'https://acme.com' });
		expect(profile).toMatchObject({ source: 'website', confidence: 0.54 });
	});

	it('prefers LinkedIn OG tags over the slug', async () => {
		page.mockResolvedValue(BODY);
		const profile = await extractProfile({ url: 'https://linkedin.com/in/jane-doe-b2b-marketing' });
		expect(profile).toMatchObject({ source: 'linkedin-og', confidence: 0.75 });
	});

	it('falls back to slug keywords when LinkedIn blocks us', async () => {
		page.mockResolvedValue(null);
		const profile = await extractProfile({ url: 'https://linkedin.com/in/jane-doe-b2b-marketing' });
		expect(profile).toMatchObject({
			source: 'linkedin-slug',
			text: 'b2b marketing',
			confidence: 0.35,
			lowConfidence: true
		});
	});

	it('guesses {slug}.com for a company page', async () => {
		page.mockResolvedValueOnce(null).mockResolvedValueOnce(BODY);
		const profile = await extractProfile({ url: 'https://linkedin.com/company/acme-analytics' });
		expect(page).toHaveBeenLastCalledWith('https://acme-analytics.com', 2000);
		expect(profile).toMatchObject({ source: 'company-site', confidence: 0.8 });
	});

	it('keeps the company name when the guessed domain is a dead end', async () => {
		page.mockResolvedValue(null);
		const profile = await extractProfile({ url: 'https://linkedin.com/company/acme-analytics' });
		expect(profile).toMatchObject({
			source: 'linkedin-slug',
			text: 'company: acme analytics',
			confidence: 0.35
		});
	});

	it('merges stated interests into every rung and lifts confidence', async () => {
		page.mockResolvedValue(null);
		const profile = await extractProfile({
			url: 'https://linkedin.com/in/jane-doe-b2b-marketing',
			interests: 'AI infra, bootstrapping'
		});
		expect(profile.text).toBe('b2b marketing\nstated interests: AI infra, bootstrapping');
		expect(profile.confidence).toBeCloseTo(0.65);
		expect(profile.lowConfidence).toBe(false);
	});

	it('caps the interests boost at 0.95', async () => {
		page.mockResolvedValue(BODY);
		const profile = await extractProfile({ url: 'https://acme.com', interests: 'AI infra' });
		expect(profile.confidence).toBe(0.95);
	});

	it('degrades honestly instead of throwing when nothing reads at all', async () => {
		page.mockResolvedValue(null);
		const profile = await extractProfile({ url: 'https://acme.com' });
		expect(profile).toMatchObject({
			source: 'interests',
			text: '',
			confidence: 0,
			lowConfidence: true
		});
	});
});

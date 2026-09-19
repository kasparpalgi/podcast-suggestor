// Keep the first one that returns something & user own interests merged into whatever we got — never used as just a fallback. User who typed eg. "Programming, AI agents" has told us more than any scrape

import { classifyUrl } from '$lib/classifyUrl';
import { fetchPage } from './fetchPage';
import { parseCompanySlug, parseSlug } from './parseSlug';
import { CONFIDENCE_FLOOR, type Evidence, type Profile } from './types';

const PAGE_TIMEOUT_MS = 3000;
const GUESS_TIMEOUT_MS = 2000;
const INTERESTS_BOOST = 0.3;
const MAX_CONFIDENCE = 0.95;
// One-pager that yields three lines is a successful fetch but poor read of the person
const FULL_READ_CHARS = 400;
const THIN_READ_PENALTY = 0.6;

function read(source: Evidence['source'], text: string, confidence: number): Evidence {
	const weighted = text.length >= FULL_READ_CHARS ? confidence : confidence * THIN_READ_PENALTY;
	return { source, text, confidence: Math.round(weighted * 100) / 100 };
}

async function climb(url: string): Promise<Evidence | null> {
	const { kind, slug } = classifyUrl(url);

	if (kind === 'website') {
		const text = await fetchPage(url, PAGE_TIMEOUT_MS);
		return text ? read('website', text, 0.9) : null;
	}

	// Try LinkedIn anyway: 1 cheap request & OG tags beat a slug every time
	const og = await fetchPage(url, PAGE_TIMEOUT_MS);
	if (og) return read('linkedin-og', og, 0.75);

	if (kind === 'linkedin-company' && slug) {
		const { name, guessedUrl } = parseCompanySlug(slug);
		const site = await fetchPage(guessedUrl, GUESS_TIMEOUT_MS);
		if (site) return read('company-site', site, 0.8);
		return name ? { source: 'linkedin-slug', text: `company: ${name}`, confidence: 0.35 } : null;
	}

	const parsed = slug ? parseSlug(slug) : { text: '', confidence: 0 };
	if (!parsed.text) return null;
	return { source: 'linkedin-slug', text: parsed.text, confidence: parsed.confidence };
}

export async function extractProfile(input: { url: string; interests?: string }): Promise<Profile> {
	const interests = input.interests?.trim() || undefined;
	const rung = await climb(input.url);

	const base: Evidence = rung ?? { source: 'interests', text: '', confidence: 0 };
	const confidence = interests
		? Math.min(MAX_CONFIDENCE, base.confidence + INTERESTS_BOOST)
		: base.confidence;
	const text = [base.text, interests && `stated interests: ${interests}`]
		.filter(Boolean)
		.join('\n');

	return {
		...base,
		url: input.url,
		text,
		confidence,
		interests,
		lowConfidence: confidence < CONFIDENCE_FLOOR
	};
}

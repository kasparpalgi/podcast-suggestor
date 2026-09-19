// Rung 1 of the ladder: read the page. Works for webs. LinkedIn it usually hits auth wall (but just one cheap request) and LinkedIn does sometimes serve OG tags

import * as cheerio from 'cheerio';
import { safeFetch } from './safeFetch';

const MAX_TEXT = 4000;
// Below this a "successful" read is a title and a tagline -> not enough to call it a read
const MIN_TEXT = 120;
const META_KEYS =
	/^(description|og:title|og:description|og:site_name|twitter:title|twitter:description)$/i;
const AUTH_WALL = /authwall|uas\/login|session_redirect|join now to see|sign in to view/i;
// LinkedIn's own boilerplate titles as opposed to a real person's headline
const GENERIC_TITLE = /^(linkedin|sign up|sign in|join linkedin)\b/i;
// JSON-LD is niice when present but only these types describe a person or a company
const LD_TYPES = /^(person|organization|corporation|localbusiness|profilepage)$/i;
const LD_FIELDS = ['name', 'jobTitle', 'description', 'knowsAbout', 'slogan', 'industry'] as const;

function flatten(value: unknown): string {
	if (typeof value === 'string') return value;
	if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join(', ');
	if (value && typeof value === 'object') return flatten((value as { name?: unknown }).name);
	return '';
}

function metaParts($: cheerio.CheerioAPI): { parts: string[]; ogTitle: string } {
	const parts = [$('title').first().text()];
	let ogTitle = '';
	$('meta').each((_, el) => {
		const key = $(el).attr('property') ?? $(el).attr('name') ?? '';
		const content = $(el).attr('content') ?? '';
		if (!content || !META_KEYS.test(key)) return;
		if (/^og:title$/i.test(key)) ogTitle = content;
		parts.push(`${key}: ${content}`);
	});
	return { parts, ogTitle };
}

function jsonLdParts($: cheerio.CheerioAPI): string[] {
	const parts: string[] = [];
	$('script[type="application/ld+json"]').each((_, el) => {
		let parsed: unknown;
		try {
			parsed = JSON.parse($(el).text());
		} catch {
			return; // malformed JSON-LD is common in the wild; skip it silently
		}
		const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
		while (queue.length) {
			const node = queue.shift();
			if (!node || typeof node !== 'object') continue;
			const record = node as Record<string, unknown>;
			if (Array.isArray(record['@graph'])) queue.push(...record['@graph']);
			if (!LD_TYPES.test(flatten(record['@type']))) continue;
			for (const field of LD_FIELDS) {
				const text = flatten(record[field]);
				if (text) parts.push(`${field}: ${text}`);
			}
		}
	});
	return parts;
}

function tidy(parts: string[]): string {
	const seen = new Set<string>();
	return parts
		.map((part) => part.replace(/\s+/g, ' ').trim())
		.filter((part) => part.length > 1 && !seen.has(part) && seen.add(part))
		.join('\n')
		.slice(0, MAX_TEXT);
}

export function readHtml(html: string): string | null {
	const $ = cheerio.load(html);
	// JSON-LD is in a <script> so read it before stripping scripts out
	const structured = jsonLdParts($);
	$('script, style, noscript, nav, footer, form, svg').remove();
	const { parts, ogTitle } = metaParts($);

	// Behind auth wall body is LinkedIn's marketing. OG tags may name the person so keep those and nothing else (only if they are real)
	if (AUTH_WALL.test(html)) {
		if (!ogTitle || GENERIC_TITLE.test(ogTitle)) return null;
		const walled = tidy(parts);
		return walled.length < MIN_TEXT ? null : walled;
	}

	const collect = (selection: ReturnType<cheerio.CheerioAPI>) => {
		selection.each((_, el) => {
			parts.push($(el).text());
		});
	};

	parts.push(...structured);
	collect($('h1, h2'));
	collect($('main p, article p, [role="main"] p').slice(0, 20));
	if (parts.filter(Boolean).length < 4) collect($('p').slice(0, 15));

	const text = tidy(parts);
	return text.length < MIN_TEXT ? null : text;
}

/** `null` means "this rung missed" — never an error. The ladder drops to the next rung. */
export async function fetchPage(url: string, timeoutMs = 3000): Promise<string | null> {
	const result = await safeFetch(url, timeoutMs);
	return result.ok ? readHtml(result.body) : null;
}

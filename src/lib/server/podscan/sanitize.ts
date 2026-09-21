// `podcast_description` arrives as raw feed HTML — <p>, <br>, nested <a>, entities, and
// the occasional <script>. Strip it once, server-side, before it reaches either the LLM
// (where tags are wasted tokens) or the page (where they break the layout).

import * as cheerio from 'cheerio';

const MAX_CHARS = 600;
// Elements that mean "new line" in a feed description. Cheerio's .text() concatenates
// without separators, so `<p>a</p><p>b</p>` would otherwise come out as "ab".
const BLOCKS = 'br, p, div, li, tr, h1, h2, h3, h4, h5, h6, blockquote';

function truncate(value: string): string {
	if (value.length <= MAX_CHARS) return value;
	const cut = value.slice(0, MAX_CHARS);
	const boundary = cut.lastIndexOf(' ');
	// Only honour the word boundary if it is not amputating most of the text
	const kept = boundary > MAX_CHARS * 0.6 ? cut.slice(0, boundary) : cut;
	return `${kept.replace(/[\s,;:.!?—–-]+$/, '')}…`;
}

export function sanitizeDescription(html: string): string {
	if (!html.trim()) return '';

	const $ = cheerio.load(html);
	$('script, style, noscript').remove();
	$(BLOCKS).after(' ');

	const plain = $.root().text().replace(/\s+/g, ' ').trim();

	return truncate(plain);
}

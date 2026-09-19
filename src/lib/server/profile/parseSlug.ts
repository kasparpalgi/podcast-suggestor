// Rung 2: LI fallback - everything is `/in/jane-doe-b2b-marketing-7a3b21` so strip 
// LI disambiguator hash and leading personal name and keep keywords.

/**
 * LinkedIn appends hash to most slugs. Pure digits or longish hex run containing a
 * digit (noise) - `b2b`, `web3` and `a16z` are not, so the hex rule needs a length floor
 */
function isNoise(token: string): boolean {
	if (/^\d+$/.test(token)) return true;
	if (token.length <= 1) return true;
	return token.length >= 5 && /^[0-9a-f]+$/.test(token) && /\d/.test(token);
}

export type SlugParse = { text: string; confidence: number };

export function parseSlug(slug: string): SlugParse {
	const tokens = decodeURIComponent(slug).toLowerCase().split(/[-_]+/).filter(Boolean);

	while (tokens.length && isNoise(tokens[tokens.length - 1])) tokens.pop();

	// The first two tokens are almost always first/last name. Less than 3 tokens
	// left means --> slug is only a name — learned nothing
	const payload = tokens.length >= 3 ? tokens.slice(2) : [];

	if (payload.length === 0) return { text: '', confidence: 0 };
	return { text: payload.join(' '), confidence: payload.length >= 2 ? 0.35 : 0.2 };
}

/**
 * Company slugs easier: whole slug is the name. `{slug}.com` is good enough
 * guess to be worth one best-effort request (see `extract.ts`).
 */
export function parseCompanySlug(slug: string): { name: string; guessedUrl: string } {
	const tokens = decodeURIComponent(slug).toLowerCase().split(/[-_]+/).filter(Boolean);
	while (tokens.length > 1 && isNoise(tokens[tokens.length - 1])) tokens.pop();
	const cleaned = tokens.join('-');
	return { name: tokens.join(' '), guessedUrl: `https://${cleaned}.com` };
}

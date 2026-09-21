// Development stand-in for the live API, gated on PODSCAN_FIXTURES=1 and nothing else —
// never on NODE_ENV, or a misconfigured deploy silently serves invented podcasts.
// It exists because the Podscan key currently 403s ("API usage requires a paid plan"),
// which would otherwise block tasks 005-007 entirely.

import { PODSCAN_FIXTURES } from '../env';
import { searchResponseSchema, type Podcast } from './client';

export const usingFixtures = (): boolean => PODSCAN_FIXTURES;

/** Deterministic per-term offset, so different search terms return overlapping-but-different sets. */
function offset(query: string, length: number): number {
	let hash = 0;
	for (const char of query) hash = (hash * 31 + char.charCodeAt(0)) % 100_000;
	return hash % length;
}

export async function fixtureSearch(query: string, perPage: number): Promise<Podcast[]> {
	const raw = await import('./fixtures/search.json');
	// Same schema as a live response: a fixture that drifts from the contract fails loudly
	const { podcasts } = searchResponseSchema.parse(raw.default);

	const start = offset(query, podcasts.length);
	const take = Math.min(perPage, podcasts.length);
	return Array.from({ length: take }, (_, i) => podcasts[(start + i) % podcasts.length]);
}

// The model judges each criterion - every number the user sees is computed here. Asking an
// LLM for the total as well is the single biggest source of score drift - it rounds toward
// the number it thinks you want and no arithmetic ties it to the per criterion scores

import type { Criterion } from './types';

const clamp = (value: number): number => Math.min(100, Math.max(0, value));

/** Model weights rarely sum to exactly 1.0 so raw weighted sum is not on 0-100 scale */
export function normalizeWeights(criteria: Criterion[]): Criterion[] {
	const sum = criteria.reduce((total, criterion) => total + criterion.weight, 0);
	// All-zero (or negative) weights is a broken reply, not a ranking — treat the axes as equal
	if (!(sum > 0)) {
		const even = criteria.length ? 1 / criteria.length : 0;
		return criteria.map((criterion) => ({ ...criterion, weight: even }));
	}
	return criteria.map((criterion) => ({ ...criterion, weight: criterion.weight / sum }));
}

/** Rounded once (here). The rounded value is what the screen shows and what the 90
 * threshold is tested against so card can never read "90%" while sitting below the cut */
export function weightedTotal(criteria: Criterion[], scores: number[]): number {
	const raw = criteria.reduce(
		(total, criterion, index) => total + criterion.weight * clamp(scores[index] ?? 0),
		0
	);
	return Math.round(raw);
}

/** The axis this show is BEST at - highest raw score not the biggest weighted
 * contribution. Weights vary far more than scores so contribution would just name the
 * heaviest criterion for every show and the diversity guard in `select.ts` would do nothing */
export function standoutOf(criteria: Criterion[], scores: number[]): string {
	let best = 0;
	for (let index = 1; index < criteria.length; index += 1) {
		const score = scores[index] ?? 0;
		const bestScore = scores[best] ?? 0;
		if (
			score > bestScore ||
			(score === bestScore && criteria[index].weight > criteria[best].weight)
		) {
			best = index;
		}
	}
	return criteria[best]?.name ?? '';
}

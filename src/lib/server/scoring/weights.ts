// The model judges each criterion - every number the user sees is computed here. Asking an
// LLM for the total as well is the single biggest source of score drift - it rounds toward
// the number it thinks you want and no arithmetic ties it to the per criterion scores

import type { Criterion } from './types';

/** Never score on fewer than this many axes - below it "best of" stops meaning anything */
const MIN_AXES = 3;

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

/** Rescales as it goes, so it is correct on a subset of the criteria too */
function weightedMean(pairs: { weight: number; score: number }[]): number {
	const sum = pairs.reduce((total, pair) => total + pair.weight, 0);
	if (!(sum > 0)) return 0;
	return pairs.reduce((total, pair) => total + pair.weight * pair.score, 0) / sum;
}

/** Index of the lowest score; earliest index wins a tie so two runs agree */
function weakestIndex(pairs: { score: number }[]): number {
	let weakest = 0;
	for (let index = 1; index < pairs.length; index += 1) {
		if (pairs[index].score < pairs[weakest].score) weakest = index;
	}
	return weakest;
}

/**
 * The match score: a weighted mean over every criterion EXCEPT the one this show is
 * weakest on.
 *
 * A plain mean over all four axes needs ~90 everywhere to total 90, and no real show is
 * outstanding on four independent axes at once - task 015 measured seven prompt variants,
 * two models and a 2.3x bigger pool all capping in the low 80s. "The SaaS Podcast" is a
 * textbook match for a bootstrapped founder (95 fundamentals, 95 operator, 80 pricing)
 * and lands at 84 only because it does not also cover sales-team building.
 *
 * So the number answers "how well does this serve the things it serves?" rather than
 * "does this one show cover everything?". Nothing is invented - each surviving number is
 * still the model's per-criterion judgement, and the dropped axis is the show's own
 * weakest, not one we picked in advance. Covering every axis is the job of the SET of six:
 * that is what the standout-diversity pass in `select.ts` is for.
 *
 * Rounded once (here). The rounded value is what the screen shows and what the 90
 * threshold is tested against so a card can never read "90%" while sitting below the cut.
 */
export function matchScore(criteria: Criterion[], scores: number[]): number {
	const pairs = criteria.map((criterion, index) => ({
		weight: criterion.weight,
		score: clamp(scores[index] ?? 0)
	}));
	if (pairs.length <= MIN_AXES) return Math.round(weightedMean(pairs));

	const weakest = weakestIndex(pairs);
	return Math.round(weightedMean(pairs.filter((_, index) => index !== weakest)));
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

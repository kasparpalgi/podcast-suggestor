// Step 3 of pipeline - persona + candidate pool -> exactly six shows at 90%+ or
// honest shortfall. Stages A-C live next door - this wires them and owns the control loop

import type { Persona } from '../profile/persona';
import type { CandidatePool } from '../podscan/candidates';
import { deriveCriteria } from './criteria';
import { expandPool } from './expand';
import { batchCount, scoreCandidates } from './score';
import { select, TARGET, THRESHOLD } from './select';
import type { RunStats, ScoredCandidate, Selection } from './types';

export { ScoringError } from './score';
export { THRESHOLD, TARGET } from './select';
export type { Criterion, ScoredCandidate, Selection } from './types';

const BANNED = /\b(perfect|great fit|must[- ]listen|no[- ]brainer|right up your alley)\b/i;
const WHY_WORD_LIMIT = 22;

function histogram(scored: ScoredCandidate[]): Record<string, number> {
	const buckets: Record<string, number> = {
		'<60': 0,
		'60-69': 0,
		'70-79': 0,
		'80-89': 0,
		'90+': 0
	};
	for (const { total } of scored) {
		const bucket =
			total >= 90
				? '90+'
				: total >= 80
					? '80-89'
					: total >= 70
						? '70-79'
						: total >= 60
							? '60-69'
							: '<60';
		buckets[bucket] += 1;
	}
	return buckets;
}

/**
 * Log only. Run where half the "why" lines are over-long or reach for banned phrase is
 * prompt that is not done — but it is not a reason to fail a user's request
 */
function auditWhys(picks: ScoredCandidate[]): void {
	const weak = picks.filter(
		(pick) => BANNED.test(pick.why) || pick.why.split(/\s+/).length > WHY_WORD_LIMIT
	);
	if (weak.length) {
		console.warn(`[scoring] ${weak.length}/${picks.length} "why" lines are generic or too long`);
	}
}

export async function rankPodcasts(persona: Persona, pool: CandidatePool): Promise<Selection> {
	const criteria = await deriveCriteria(persona, pool.candidates);

	let scored = await scoreCandidates(persona, criteria, pool.candidates);
	let llmCalls = 1 + batchCount(pool.candidates.length);
	let expanded = false;
	let picked = select(scored);

	// One round - only when it can change the answer
	if (picked.shortfall) {
		// Set before the attempt - the round is spent whether or not it returns anything
		// and a failed widening that vanished from the stats would read as "never needed one"
		expanded = true;
		try {
			const expansion = await expandPool({ persona, criteria, scored, termsUsed: pool.termsUsed });
			llmCalls += expansion.llmCalls;
			if (expansion.scored.length) {
				scored = [...scored, ...expansion.scored];
				picked = select(scored);
			}
		} catch (error) {
			// A lower bound — the terms call was at least attempted. Better an undercount than
			// round that cost money and left no trace in the log task 010 budgets from
			llmCalls += 1;
			// Widening is best effort - Podscan 403 here must not lose the shows already got
			console.warn('[scoring] expansion round failed, keeping the first pass:', error);
		}
	}

	const stats: RunStats = {
		poolSize: pool.candidates.length,
		scored: scored.length,
		qualified: scored.filter((candidate) => candidate.total >= THRESHOLD).length,
		expanded,
		histogram: histogram(scored),
		llmCalls
	};

	console.info(
		`[scoring] ${stats.scored}/${stats.poolSize} scored, ${stats.qualified} at 90+, ` +
			`${picked.picks.length}/${TARGET} picked${stats.expanded ? ' (expanded)' : ''}, ` +
			`${stats.llmCalls} LLM calls — ${JSON.stringify(stats.histogram)}`
	);
	auditWhys(picked.picks);

	return { criteria, ...picked, stats };
}

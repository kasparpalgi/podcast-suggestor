// Shapes shared by four scoring stages - `total` and `standout` are never model output

import type { Candidate } from '../podscan/candidates';

/** One named weighted axis derived for THIS person. Surfaced on the results screen. */
export type Criterion = {
	name: string;
	description: string;
	weight: number;
};

export type ScoredCandidate = {
	candidate: Candidate;
	/** Same order as the criteria that produced it */
	perCriterion: { name: string; score: number }[];
	/** Weighted sum of `perCriterion` computed in TypeScript. 0-100, integer. */
	total: number;
	why: string;
	/** The criterion this show scored highest on. */
	standout: string;
};

export type RunStats = {
	poolSize: number;
	scored: number;
	qualified: number;
	expanded: boolean;
	/** `'90+' | '80-89' | ...` -> count. Printed every run; the prompt is tuned off it. */
	histogram: Record<string, number>;
	llmCalls: number;
};

export type Selection = {
	criteria: Criterion[];
	picks: ScoredCandidate[];
	/** Fewer than six cleared 90. The screen says so — it never pads to six. */
	shortfall: boolean;
	/** Best shows that did not make the cut, for "the closest runner-up at 87%". */
	nextBest: ScoredCandidate[];
	stats: RunStats;
};

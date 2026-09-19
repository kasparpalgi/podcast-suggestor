export type EvidenceSource =
	| 'website' // read the page itself
	| 'linkedin-og' // LI served OG tags before auth wall
	| 'company-site' // linkedin.com/company/{slug} --> guessed {slug}.com and it answered
	| 'linkedin-slug' // slug keywords only — thin
	| 'interests'; // nothing scraped - user told directly

export type Evidence = {
	source: EvidenceSource;
	text: string;
	confidence: number;
};

/** What the ladder hands to LLM step. */
export type Profile = Evidence & {
	url: string;
	interests?: string;
	/** `confidence < 0.4` — the results screen says so instead of pretending. */
	lowConfidence: boolean;
};

/** Confidence at or above this is treated as usable read of the person. */
export const CONFIDENCE_FLOOR = 0.4;

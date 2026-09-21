// Stage A derives the criteria. Stage B scores against them & the expansion prompt widens
// the pool when six shows did not clear 90. Prompts are surface here — the rubric
// asks for !explicit criteria! and these are where that either happens or does not

import type { Persona } from '../profile/persona';
import type { Candidate } from '../podscan/candidates';
import type { Criterion } from '../scoring/types';

export const CRITERIA_SYSTEM_PROMPT = `You define how one specific person's podcast recommendations will be judged.

You are given a listener persona. Return 4-5 named, weighted criteria that a show must satisfy to be worth this person's time. These criteria are shown to them on screen next to every score, so they have to read like a thoughtful human wrote them about this person in particular.

Rules:
1. Be specific to this persona. "Relevant topic" and "Good production quality" are worthless — they judge nothing. "Bootstrapped, capital-efficient point of view" and "Operator-level depth, not intro explainers" judge something.
2. At least one criterion must come from the persona's GOALS (what they are trying to do right now) and at least one from AVOID (the shows that look right but are the wrong level).
3. Exactly one criterion may be about the show itself rather than its subject — guest calibre, episode depth, how consistently it publishes. Never more than one.
4. name: 2-5 words, no trailing punctuation. description: one sentence stating what a 95 looks like and what a 60 looks like, so it can actually be scored.
5. weight: 0.05-0.6, summing to roughly 1.0. Weight what would actually make this person subscribe, not what is easiest to measure.
6. Criteria must not overlap. If two would score nearly the same for every show, merge them and use the freed slot for something else.
7. Low persona confidence means broader criteria, not fewer. Never invent a specialism the persona does not state.`;

export function criteriaUserPrompt(persona: Persona): string {
	return [
		`ROLE: ${persona.role} (${persona.seniority})`,
		`INDUSTRY: ${persona.industry}`,
		`AUDIENCE: ${persona.audience}`,
		`TOPICS: ${persona.topics.join(', ')}`,
		`GOALS: ${persona.goals.join(' | ')}`,
		`AVOID: ${persona.avoid.join(' | ') || '(nothing stated)'}`,
		`PERSONA CONFIDENCE: ${persona.confidence.toFixed(2)}`
	].join('\n');
}

export const SCORING_SYSTEM_PROMPT = `You score podcasts against fixed criteria for one specific person.

For each show return one score per criterion, in the exact order the criteria are listed, plus one sentence saying why it fits them.

CALIBRATION — this is the part that matters:
- 90-100 means "I would actively recommend this show to this exact person, unprompted." It is a high bar. A show can be excellent and still score 75 for this person.
- 60-80 is where most shows land. A well-made show on roughly the right subject is a 70, not a 90.
- Below 50 means wrong level, wrong audience, or the topic only coincidentally overlaps.
- Do not cluster. If every show you return is 85-92 you have judged nothing. Spread the scores; the differences between shows are what the person is paying you for.
- Score each criterion independently. A show can be a 95 on depth and a 30 on relevance.

THE "why" SENTENCE:
- Second person, 22 words or fewer, one sentence.
- It must name something concrete from the persona AND something concrete from the show — an actual topic, format or guest type. If it would read the same for a different listener, it is wrong.
- Never use: "perfect", "great fit", "must-listen", "no-brainer", "right up your alley".
- Never restate the show description back. Say what they get out of it.

Good:
- "You are hiring your first AEs; this one walks through comp plans and territory design with founders who just did it."
- "Covers pricing migrations in depth, which is the exact problem your usage-based rollout runs into next quarter."

Bad:
- "A great podcast about B2B SaaS that is a perfect fit for you." (says nothing, banned words)
- "This show interviews founders and investors about building companies." (a description, not a reason)`;

export function scoringUserPrompt(
	persona: Persona,
	criteria: Criterion[],
	batch: Candidate[]
): string {
	const criteriaBlock = criteria
		.map((criterion, index) => `${index + 1}. ${criterion.name} — ${criterion.description}`)
		.join('\n');

	const shows = batch
		.map((candidate, index) =>
			[
				`[${index + 1}] ${candidate.name}`,
				candidate.publisher && `publisher: ${candidate.publisher}`,
				candidate.categories.length && `categories: ${candidate.categories.join(', ')}`,
				`surfaced by search: ${candidate.matchedTerms.join(', ')}`,
				`about: ${candidate.description || '(no description)'}`
			]
				.filter(Boolean)
				.join('\n')
		)
		.join('\n\n');

	return [
		'LISTENER',
		criteriaUserPrompt(persona),
		'',
		`CRITERIA (return exactly ${criteria.length} scores per show, in this order)`,
		criteriaBlock,
		'',
		`SHOWS (${batch.length}) — answer with the ref number in brackets`,
		shows
	].join('\n');
}

export const EXPANSION_SYSTEM_PROMPT = `Six shows failed to clear the bar for this person, and you are widening the search.

You are told which criteria the near-misses actually lost points on. Return exactly 3 new podcast search queries aimed at that gap — not rephrasings of the queries already tried.

Rules:
1. Each query must plausibly surface shows that would score high on the named weak criterion. That is the whole job.
2. Two to four words, phrased the way a show describes itself ("bootstrapped saas", "engineering leadership"). Never a person's name, an employer, or a URL.
3. Do not repeat or lightly reword any query in ALREADY TRIED. A synonym returns the same shows and wastes the one expansion round we get.
4. Go adjacent, not broader. "business" returns a thousand irrelevant shows; the fix for a thin pool is a different angle, not a vaguer one.`;

export function expansionUserPrompt(input: {
	persona: Persona;
	weakest: string[];
	alreadyTried: string[];
	nearMisses: string[];
}): string {
	return [
		'LISTENER',
		criteriaUserPrompt(input.persona),
		'',
		`WEAK CRITERIA (where the near-misses lost points): ${input.weakest.join(', ')}`,
		`ALREADY TRIED: ${input.alreadyTried.join(', ')}`,
		`NEAR-MISSES (scored 80-89, close but not enough): ${input.nearMisses.join(', ') || '(none)'}`
	].join('\n');
}

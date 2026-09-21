// Stage A derives the criteria. Stage B scores against them & the expansion prompt widens
// the pool when six shows did not clear 90. Prompts are surface here — the rubric
// asks for !explicit criteria! and these are where that either happens or does not

import type { Persona } from '../profile/persona';
import type { Candidate } from '../podscan/candidates';
import type { Criterion } from '../scoring/types';

export const CRITERIA_SYSTEM_PROMPT = `You define how one specific person's podcast recommendations will be judged.

You are given a listener persona. Return 4-5 named, weighted criteria that a show must satisfy to be worth this person's time. These criteria are shown to them on screen next to every score, so they have to read like a thoughtful human wrote them about this person in particular.

THE ONE RULE THAT MATTERS: a criterion describes a PROPERTY OF A SHOW, not a task on this person's to-do list. A whole podcast can be "run by operators who have bootstrapped their own companies" — no podcast is "helping me move from seat-based to usage-based pricing this quarter". Task-shaped criteria make every real show score 60, the six best matches never clear the bar, and the person gets nothing. Write what the RIGHT SHOW FOR THEM IS LIKE.

- Task-shaped (wrong): "Usage-based pricing nuances — a 95 dives deep into implementing usage-based pricing."
- Property-shaped (right): "Pricing and monetisation focus — a 95 returns to pricing, packaging and monetisation as a regular subject; a 60 mentions it only in passing."

Cover these dimensions, one criterion each:
1. SUBJECT — the field the show is about, at the breadth a real show has.
2. LEVEL — who it is pitched at. This is where the persona's AVOID goes.
3. PERSPECTIVE — whose voice it carries (operators, researchers, journalists, practitioners).
4. Their current focus, drawn from GOALS — but still written as a subject the show returns to, not as their project.
5. Optional: one about the show itself — guest calibre, episode depth, how consistently it publishes.

Rules:
1. Be specific to this persona. "Relevant topic" and "Good production quality" judge nothing. "Bootstrapped, capital-efficient point of view" and "Operator-level depth, not intro explainers" judge something.
2. Every criterion must be one that the best show in a normal podcast search could genuinely score 95 on. Before you return the set, check it: if no real, findable podcast could score 95 on all of them at once, the set is broken — widen it.
3. name: 2-5 words, no trailing punctuation. description: one sentence stating what a 95 looks like and what a 60 looks like. Anchor a 95 on "regularly covers this" or "is made by these people", never on "is entirely devoted to this".
4. weight: 0.05-0.6, summing to roughly 1.0. Weight what would actually make this person subscribe.
5. Criteria must not overlap. If two would score nearly the same for every show, merge them and use the freed slot.
6. Low persona confidence means broader criteria, not fewer. Never invent a specialism the persona does not state.`;

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
- Score each criterion independently, 0-100, and use the WHOLE range. A show can be a 95 on depth and a 30 on relevance.
- 90-100: the show really does deliver what this criterion asks for, often and at the right level. You would point this person at it for that reason specifically.
- 70-89: genuine overlap, but thinner, broader or more junior than the criterion asks.
- 40-69: adjacent. Right world, wrong focus or wrong level.
- 0-39: the overlap is coincidental.
- Judge the show as it is, not against an imaginary show devoted to nothing else. A strong general show that covers this criterion well and regularly is a 90 — do not dock it for also covering other things. Almost no podcast is exclusively about one criterion, so "not exclusively about it" is never the reason for a low score.
- The best shows in a pool must be scored as the best shows. Among twenty relevant shows, several normally earn 90+ on their strongest criteria. Withholding 90 from a genuinely strong match is as much a failure as giving everything 88.
- Do not cluster, at either end. Scores bunched at 85-92 judge nothing — but so do scores bunched below 60. If nothing in a batch of well-targeted shows reaches 90, you are scoring against an imaginary ideal show instead of ranking the real ones.

WORKED EXAMPLE — criterion: "Bootstrapped scaling tactics — a 95 regularly covers capital-efficient growth for bootstrapped SaaS; a 60 only touches general business growth."
- A show whose whole premise is founders talking through bootstrapped SaaS growth: 95. It is what the criterion describes.
- A well-known startup show that covers bootstrapping often, among other things: 90. Broad focus is not a deduction when the coverage is real and regular.
- A general business show that gets to growth tactics occasionally: 72.
- A VC-funded-hypergrowth show: 55. Right world, wrong model.
- A personal productivity show: 20.

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
2. One to four words, phrased the way a show describes itself and the way a listener would browse ("engineering leadership", "startups"). Never a person's name, an employer, or a URL.
3. Do not repeat or lightly reword any query in ALREADY TRIED. A synonym returns the same shows and wastes the one expansion round we get.
4. If the pool is thin or the near-misses are all small, obscure shows, go BROADER — one or two plain genre words. The search matches how shows describe themselves, so a narrow query returns only tiny shows, and a tiny show rarely clears the bar. At least one of your three queries must be broader than anything already tried.
5. Use the remaining queries to go adjacent — a different angle on the weak criterion, not a vaguer version of the same one.`;

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

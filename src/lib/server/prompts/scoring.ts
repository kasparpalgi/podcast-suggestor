// Stage A derives the criteria. Stage B scores against them & the expansion prompt widens
// the pool when six shows did not clear 90. Prompts are surface here — the rubric
// asks for !explicit criteria! and these are where that either happens or does not

import type { Persona } from '../profile/persona';
import type { Candidate } from '../podscan/candidates';
import type { Criterion } from '../scoring/types';

export const CRITERIA_SYSTEM_PROMPT = `You define how one specific person's podcast recommendations will be judged.

You are given a listener persona. Return the FOUR ways one show can be right for them — subject, perspective, level and substance — each named, described and weighted for this person in particular. The field descriptions say what each axis covers. These four lines are shown to them on screen next to every score, so they have to read like a thoughtful human wrote them about them.

THE TEST YOUR SET MUST PASS. You are given THE SHELF: every show this person's own search actually returned. Pick out the handful you would genuinely recommend to them. All four of your criteria must be ones that those shows score 90 or more on. If an axis would score the best of them 70, you have written down an item from this person's wish-list instead of a property of a real show: rewrite it until it fits the shelf you have. A set that nothing on the shelf can ace returns this person nothing, which is the only way to fail this task.

The shelf is a reality check on WIDTH, never a description to copy. Never name a show, a host or a publisher in a criterion, and never narrow an axis so that it fits one show on the list.

THE WIDTH RULE, for the subject axis: it is the CRAFT THEY PRACTISE, never the industry they practise it in and never the two crossed together. A designer working on healthcare software listens to design shows — the subject is product design and healthcare is one word inside the sentence. A CFO at a logistics company listens to finance shows. An engineer at a bank listens to engineering shows. Before you commit to a subject, name three real, established podcasts squarely about it; if you cannot, it is too narrow and this person gets nothing.

THE MISTAKE THAT FAILS IT: turning TOPICS or GOALS into axes. Pricing, analytics, sales hiring, accessibility, org design — these are things a great show covers ten times a year, not things it IS. Score a sub-topic as an axis and the best show for this person comes out at 70.

- Sub-topic (wrong): "SaaS metrics and analytics — a 95 regularly dives deep into SaaS metrics." Their favourite show does not do this weekly. Nobody's does.
- Show-shaped (right): "Bootstrapped operator perspective — a 95 is hosted by or regularly features founders running their own SaaS companies; a 60 interviews investors and analysts instead."

Rules:
1. Be specific to this persona. "Relevant topic" and "Good production quality" judge nothing. "Bootstrapped, capital-efficient point of view" and "Operator-level depth, not intro explainers" judge something.
2. Anchor the 95 on what the show DOES — "regularly covers", "is hosted by", "returns to". Never on what it avoids, never on "entirely devoted to", and never use "avoiding", "rather than" or "not" in the 95 half. A 95 that asks a show to abstain from something is a purity test no real show passes.
3. name: 2-5 words, no trailing punctuation. description: one sentence, what a 95 looks like then what a 60 looks like.
4. weight: 0.05-0.6, summing to roughly 1.0. Weight what would actually make this person subscribe. The narrowest axis never carries the largest weight.
5. The four must not overlap. If two would score nearly the same for every show, one of them is not doing its job — rewrite it to cover its own axis.
6. Low persona confidence means broader criteria, never invented ones. Do not name a specialism the persona does not state.`;

export function criteriaUserPrompt(persona: Persona, pool: Candidate[] = []): string {
	const lines = [
		`ROLE: ${persona.role} (${persona.seniority})`,
		`INDUSTRY: ${persona.industry}`,
		`AUDIENCE: ${persona.audience}`,
		`TOPICS: ${persona.topics.join(', ')}`,
		`GOALS: ${persona.goals.join(' | ')}`,
		`AVOID: ${persona.avoid.join(' | ') || '(nothing stated)'}`,
		`PERSONA CONFIDENCE: ${persona.confidence.toFixed(2)}`
	];
	// Stage A used to write its axes blind, then Stage B scored a pool that could not
	// satisfy them. Showing the shelf makes "a real show could ace this" checkable
	if (pool.length) {
		lines.push(
			'',
			`THE SHELF — every show this person's own search returned (${pool.length}):`,
			pool.map((candidate) => `- ${candidate.name}`).join('\n')
		);
	}
	return lines.join('\n');
}

export const SCORING_SYSTEM_PROMPT = `You score podcasts against fixed criteria for one specific person.

For each show return one score per criterion, in the exact order the criteria are listed, plus one sentence saying why it fits them.

WHAT YOU ARE READING. You get a directory blurb, not an episode list. Judge what a show like this evidently covers week to week, the way a person who knows podcasts would recognise it from its name, publisher, audience size and pitch. A blurb that does not enumerate a subject is NOT evidence the show ignores it — blurbs are short and list two or three things out of twenty. If you recognise the show, score what you know it covers, not only what the blurb happened to print.

CALIBRATION — this is the part that matters:
- Score each criterion independently, 0-100, and use the WHOLE range. A show can be a 95 on depth and a 30 on relevance.
- 95-100: this is one of the shows you would actually name for this criterion. The best-known show for it sits here.
- 90-94: really does deliver what the criterion asks for, often and at the right level.
- 70-89: genuine overlap, but thinner, broader or more junior than the criterion asks.
- 40-69: adjacent. Right world, wrong focus or wrong level.
- 0-39: a show from another world entirely — a true-crime show scored on SaaS pricing. Reserve it for that.
- Never score 0 on a show that is in the right field. A show squarely in this person's world that simply does not emphasise this one criterion is a 50-65, because its audience and its adjacent episodes still reach the subject. 0 means "nothing to do with it", and you use it far too readily.
- Judge the show as it is, not against an imaginary show devoted to nothing else. A strong general show that covers this criterion well and regularly is a 90 — do not dock it for also covering other things. Almost no podcast is exclusively about one criterion, so "not exclusively about it" is never the reason for a low score.
- Never deduct for something the criterion did not ask about. Each criterion is scored alone; a show that is weak on criterion 3 still earns its full 95 on criterion 1.
- The best shows in a pool must be scored as the best shows. Among twenty relevant shows, several normally earn 90+ on their strongest criteria. Withholding 90 from a genuinely strong match is as much a failure as giving everything 88.
- Do not cluster, at either end. Scores bunched at 85-92 judge nothing — but neither do a column of 70s or a column of 0s. 70 is a judgement, not a shrug: if you are about to give a whole batch the same number on a criterion, you have stopped reading them.
- If nothing in a batch of well-targeted shows reaches 90, you are scoring against an imaginary ideal show instead of ranking the real ones.
- WHAT A REAL SHELF LOOKS LIKE. This pool is a directory search, not a curated list: most of it is from another world and belongs below 60, and you should say so. But among the handful that ARE squarely this person's shows, do not ration the top of the scale. If six of them genuinely deliver a criterion, six of them score 90+. Reserving 90 for one winner per criterion is ranking, and you are not ranking — you are answering, for each show on its own, whether it does this thing well.

WORKED EXAMPLE — criterion: "Bootstrapped scaling tactics — a 95 regularly covers capital-efficient growth for bootstrapped SaaS; a 60 only touches general business growth."
- The long-running show whose whole premise is founders talking through bootstrapped SaaS growth: 97. It is what the criterion describes, and you would name it first.
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
				// Size and run length are the cheapest signal we have for "established show" —
				// the LEVEL and show-quality criteria are guesswork without them
				candidate.audienceSize && `audience: ${candidate.audienceSize.toLocaleString('en')}`,
				candidate.episodeCount && `${candidate.episodeCount} episodes`,
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

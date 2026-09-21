// The only place that knows the step order. Yields events --> the endpoint just streams them
// TODO: save the signup and send the email between `scoring` and `done`

import type { Submission } from '$lib/schemas/submission';
import { extractProfile } from './profile/extract';
import { buildPersona, type Persona } from './profile/persona';
import { buildCandidatePool } from './podscan/candidates';
import { rankPodcasts, type Selection } from './scoring';
import type { Stage } from '$lib/stages';
import { toPipelineError } from './errors';

export type MatchEvent =
	| { t: 'stage'; stage: Stage; label: string }
	| { t: 'persona'; persona: Persona }
	| ({ t: 'result' } & Pick<Selection, 'picks' | 'criteria' | 'shortfall' | 'nextBest'>)
	| { t: 'error'; code: string; message: string };

const stage = (s: Stage, label: string): MatchEvent => ({ t: 'stage', stage: s, label });

export async function* runPipeline(input: Submission): AsyncGenerator<MatchEvent> {
	try {
		yield stage('reading', 'Reading your page…');
		const profile = await extractProfile(input);

		yield stage('profiling', 'Working out who you are as a listener…');
		const persona = await buildPersona(profile);
		yield { t: 'persona', persona };

		yield stage('searching', 'Searching thousands of shows…');
		const pool = await buildCandidatePool(persona);

		yield stage('scoring', 'Scoring every show against your taste…');
		const { picks, criteria, shortfall, nextBest } = await rankPodcasts(persona, pool);
		yield { t: 'result', picks, criteria, shortfall, nextBest };

		yield stage('done', 'Done!');
	} catch (error) {
		console.error('[pipeline]', error);
		yield { t: 'error', ...toPipelineError(error) };
	}
}

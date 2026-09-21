import { browser } from '$app/environment';
import type { Submission } from '$lib/schemas/submission';
import { CONFIDENCE_FLOOR } from '$lib/confidence';
import type { Stage } from '$lib/stages';
import type { MatchEvent } from '$lib/server/pipeline';

type Result = Extract<MatchEvent, { t: 'result' }>;
type Persona = Extract<MatchEvent, { t: 'persona' }>['persona'];

const initial = () => ({
	loading: false,
	stage: null as Stage | null,
	label: '',
	persona: null as Persona | null,
	result: null as Result | null,
	error: null as string | null
});

function createMatchStore() {
	const state = $state(initial());
	let last: Submission | null = null;

	function apply(event: MatchEvent) {
		if (event.t === 'stage') {
			state.stage = event.stage;
			state.label = event.label;
		} else if (event.t === 'persona') state.persona = event.persona;
		else if (event.t === 'result') state.result = event;
		else if (event.t === 'error') state.error = event.message;
	}

	async function submit(values: Submission) {
		if (!browser || state.loading) return;
		last = values;
		Object.assign(state, initial(), { loading: true });
		try {
			const response = await fetch('/api/match', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(values)
			});
			if (!response.ok || !response.body) throw new Error('Request failed');

			const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
			let buffer = '';
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += value;
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';
				for (const line of lines) {
					try {
						if (line.trim()) apply(JSON.parse(line));
					} catch {
						// half-broken line, skip it
					}
				}
			}
			// stream ended without result or error = connection died
			if (!state.result && !state.error) throw new Error('Connection lost');
		} catch {
			state.error ||= 'Connection lost. Check your network and try again.';
		} finally {
			state.loading = false;
		}
	}

	/** Same URL + email, sharper interests */
	const rerun = (interests: string) => last && submit({ ...last, interests });
	const reset = () => Object.assign(state, initial());

	return {
		get loading() {
			return state.loading;
		},
		get stage() {
			return state.stage;
		},
		get label() {
			return state.label;
		},
		get persona() {
			return state.persona;
		},
		get picks() {
			return state.result?.picks ?? [];
		},
		get criteria() {
			return state.result?.criteria ?? [];
		},
		get shortfall() {
			return state.result?.shortfall ?? false;
		},
		get nextBest() {
			return state.result?.nextBest ?? [];
		},
		get lowConfidence() {
			return !!state.persona && state.persona.confidence < CONFIDENCE_FLOOR;
		},
		get hasResult() {
			return !!state.result;
		},
		get error() {
			return state.error;
		},
		submit,
		rerun,
		reset
	};
}

export const match = createMatchStore();

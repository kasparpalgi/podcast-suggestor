// Persistence for signups + their six matches --> failures throw... the pipeline catches and
// carries on. On screen result matters more than the DB (NOTES.md)

import type { Submission } from '$lib/schemas/submission';
import { classifyUrl } from '$lib/classifyUrl';
import { supabase } from '$lib/supabase/server';
import type { Persona } from '../profile/persona';
import type { Selection } from '../scoring/types';

export type SavedSignup = { id: string; unsubscribeToken: string; repeat: boolean };

export async function saveSignup(
	input: Submission,
	persona: Persona,
	selection: Pick<Selection, 'criteria' | 'picks'>
): Promise<SavedSignup> {
	const { data: existing } = await supabase
		.from('signups')
		.select('id')
		.eq('email', input.email)
		.eq('submitted_url', input.url)
		.maybeSingle();

	// token is left out on purpose -> DB default on insert (untouched on conflict)
	const { data: signup, error } = await supabase
		.from('signups')
		.upsert(
			{
				email: input.email,
				submitted_url: input.url,
				url_kind: classifyUrl(input.url).kind,
				persona,
				criteria: selection.criteria,
				persona_confidence: persona.confidence,
				is_active: true
			},
			{ onConflict: 'email,submitted_url' }
		)
		.select('id, unsubscribe_token')
		.single();
	if (error) throw error;

	// Replace the six. Two calls, not atomic - a repeat submit just runs it again
	const cleared = await supabase.from('matches').delete().eq('signup_id', signup.id);
	if (cleared.error) throw cleared.error;

	const rows = selection.picks.map(({ candidate, total, why, standout }, position) => ({
		signup_id: signup.id,
		podcast_id: candidate.id,
		podcast_name: candidate.name,
		podcast_url: candidate.url,
		podcast_image_url: candidate.imageUrl,
		description: candidate.description,
		score: total,
		why,
		standout_criterion: standout,
		position
	}));
	const inserted = await supabase.from('matches').insert(rows);
	if (inserted.error) throw inserted.error;

	return { id: signup.id, unsubscribeToken: signup.unsubscribe_token, repeat: !!existing };
}

/** For the weekly resend (task 010) - one page, ordered by id so `after` is a stable cursor */
export async function getActiveSignups(after?: string, limit = 25) {
	let query = supabase
		.from('signups')
		.select(
			'id, email, submitted_url, created_at, unsubscribe_token, matches(podcast_id, podcast_name, podcast_url, podcast_image_url, score, why, position)'
		)
		.eq('is_active', true)
		.order('id')
		.limit(limit);
	if (after) query = query.gt('id', after);
	const { data, error } = await query;
	if (error) throw error;
	return data;
}

/** Last successful send per signup - the cutoff for "new episode" */
export async function lastSentAt(ids: string[]): Promise<Map<string, string>> {
	const { data, error } = await supabase
		.from('sends')
		.select('signup_id, created_at')
		.in('signup_id', ids)
		.eq('status', 'sent')
		.order('created_at', { ascending: false });
	if (error) throw error;
	const last = new Map<string, string>();
	for (const row of data) if (!last.has(row.signup_id)) last.set(row.signup_id, row.created_at);
	return last;
}

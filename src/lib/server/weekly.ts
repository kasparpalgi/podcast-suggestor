// Weekly resend: same six shows, only the ones with a new episode since the last send

import { getLatestEpisode } from './podscan/client';
import { sendResults } from './email/send';
import type { getActiveSignups } from './db/signups';

type Signup = Awaited<ReturnType<typeof getActiveSignups>>[number];
export type Outcome = 'sent' | 'skipped' | 'failed';

const latestCache = new Map<string, ReturnType<typeof getLatestEpisode>>();

// shows are shared between signups, so one Podscan call per show per run
const latest = (id: string) => {
	if (!latestCache.has(id)) latestCache.set(id, getLatestEpisode(id));
	return latestCache.get(id)!;
};

export async function resend(signup: Signup, since: string, dry: boolean): Promise<Outcome> {
	const cutoff = new Date(since);
	const matches = [...signup.matches].sort((a, b) => a.position - b.position);
	const eps = await Promise.all(matches.map((m) => latest(m.podcast_id).catch(() => null)));

	const picks = matches.flatMap((m, i) => {
		const ep = eps[i];
		if (!ep || ep.postedAt <= cutoff) return [];
		return [
			{
				name: m.podcast_name,
				url: m.podcast_url,
				imageUrl: m.podcast_image_url ?? '',
				score: m.score,
				why: m.why,
				latest: ep.title
			}
		];
	});
	// quiet week = no mail, and no row: the next run compares to the same cutoff
	if (!picks.length) return 'skipped';
	if (dry) return 'sent';

	const { ok } = await sendResults({
		signupId: signup.id,
		email: signup.email,
		token: signup.unsubscribe_token,
		submittedUrl: signup.submitted_url,
		signedUpAt: new Date(signup.created_at),
		kind: 'weekly',
		picks
	});
	return ok ? 'sent' : 'failed';
}

// Vercel Cron hits this. Spends money (Podscan + Resend) so bearer only. ?dry=1 sends nothing

import { createHash, timingSafeEqual } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { CRON_SECRET } from '$lib/server/env';
import { getActiveSignups, lastSentAt } from '$lib/server/db/signups';
import { resend, type Outcome } from '$lib/server/weekly';
import type { RequestHandler } from './$types';

const PAGE = 25;
const CONCURRENCY = 3;
const BUDGET_MS = 45_000;

const digest = (s: string) => createHash('sha256').update(s).digest();

export const GET: RequestHandler = async ({ request, url }) => {
	const given = request.headers.get('authorization') ?? '';
	// empty secret must never match
	if (!CRON_SECRET || !timingSafeEqual(digest(given), digest(`Bearer ${CRON_SECRET}`))) {
		return new Response('Unauthorized', { status: 401 });
	}
	const dry = url.searchParams.get('dry') === '1';
	const started = Date.now();
	const summary = { processed: 0, sent: 0, skipped: 0, failed: 0, hasMore: false, next: '' };

	try {
		const signups = await getActiveSignups(url.searchParams.get('after') ?? undefined, PAGE);
		const since = signups.length ? await lastSentAt(signups.map((s) => s.id)) : new Map();
		const queue = [...signups];

		// small pool - the Podscan trial tier is 10 req/min, so no Promise.all over everyone
		await Promise.all(
			Array.from({ length: CONCURRENCY }, async () => {
				for (let s = queue.shift(); s; s = queue.shift()) {
					if (Date.now() - started > BUDGET_MS) {
						queue.unshift(s);
						return;
					}
					let outcome: Outcome = 'failed';
					try {
						outcome = await resend(s, since.get(s.id) ?? s.created_at, dry);
					} catch (error) {
						console.error('[cron] signup', s.id, error);
					}
					summary.processed++;
					summary[outcome]++;
					summary.next = s.id > summary.next ? s.id : summary.next;
				}
			})
		);
		// cut short by the budget, or a full page (there may be more)
		summary.hasMore = queue.length > 0 || signups.length === PAGE;
	} catch (error) {
		console.error('[cron]', error);
		return json({ error: 'Run failed' }, { status: 500 });
	}
	console.log('[cron] weekly', { dry, ...summary });
	return json({ dry, ...summary });
};

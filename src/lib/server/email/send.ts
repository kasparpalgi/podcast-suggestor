// Never throws - a dead mail provider must not kill the on-screen result (NOTES.md #4)

import { createHash } from 'node:crypto';
import { Resend } from 'resend';
import { supabase } from '$lib/supabase/server';
import { PUBLIC_BASE_URL, RESEND_API_KEY, RESEND_VERIFIED_DOMAIN } from '../env';
import { buildEmail, type EmailPick } from './template';

export type SendInput = {
	signupId: string;
	email: string;
	token: string;
	submittedUrl: string;
	signedUpAt: Date;
	picks: EmailPick[];
	kind: 'initial' | 'weekly';
};

const resend = new Resend(RESEND_API_KEY || 'missing');
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// bad address - retrying is pointless
const HARD = new Set(['validation_error', 'invalid_to_address', 'invalid_from_address']);

const isoWeek = (d = new Date()) => {
	const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
	t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
	const start = Date.UTC(t.getUTCFullYear(), 0, 1);
	return `${t.getUTCFullYear()}-W${Math.ceil(((+t - start) / 864e5 + 1) / 7)}`;
};

async function record(input: SendInput, status: 'sent' | 'failed', id?: string, error?: string) {
	const { error: dbError } = await supabase
		.from('sends')
		.insert({ signup_id: input.signupId, kind: input.kind, status, provider_id: id, error });
	if (dbError) console.error('[email] could not log send', dbError.message);
}

export async function sendResults(input: SendInput): Promise<{ ok: boolean }> {
	try {
		if (!RESEND_API_KEY || !RESEND_VERIFIED_DOMAIN) throw new Error('Resend is not configured');

		const unsubscribeUrl = `${PUBLIC_BASE_URL}/unsubscribe?token=${encodeURIComponent(input.token)}`;
		const oneClickUrl = `${PUBLIC_BASE_URL}/api/unsubscribe?token=${encodeURIComponent(input.token)}`;
		const { subject, html, text } = buildEmail({ ...input, unsubscribeUrl });
		const from = `PodMatch <hello@${RESEND_VERIFIED_DOMAIN}>`;
		// same list + same week = same key, so a cron retry cannot double send. Ids in the
		// key because Resend rejects a reused key with a different body
		const shows = createHash('sha1')
			.update(input.picks.map((p) => p.url).join())
			.digest('hex');
		const idempotencyKey = `${input.kind}/${input.signupId}/${isoWeek()}/${shows.slice(0, 8)}`;

		let lastError = 'unknown error';
		for (let attempt = 0; attempt < 2; attempt++) {
			const { data, error } = await resend.emails.send(
				{
					from,
					replyTo: from,
					to: input.email,
					subject,
					html,
					text,
					headers: {
						'List-Unsubscribe': `<${oneClickUrl}>`,
						'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
					}
				},
				{ idempotencyKey }
			);
			if (data) {
				await record(input, 'sent', data.id);
				return { ok: true };
			}
			lastError = `${error.name}: ${error.message}`;
			if (HARD.has(error.name)) {
				// stop the weekly cron writing to a dead address
				await supabase.from('signups').update({ is_active: false }).eq('id', input.signupId);
				break;
			}
			const transient = error.statusCode === 429 || (error.statusCode ?? 500) >= 500;
			if (!transient) break;
			await wait(1500);
		}
		await record(input, 'failed', undefined, lastError);
	} catch (error) {
		console.error('[email]', error);
		await record(
			input,
			'failed',
			undefined,
			String(error instanceof Error ? error.message : error)
		);
	}
	return { ok: false };
}

// Dev only - renders the mail with fixture data. 404 in production

import { error } from '@sveltejs/kit';
import { buildEmail } from '$lib/server/email/template';
import type { RequestHandler } from './$types';

const picks = Array.from({ length: 6 }, (_, i) => ({
	name: `Fixture Show ${i + 1}: a long-ish title to test wrapping`,
	url: 'https://example.com/show',
	imageUrl: `https://picsum.photos/seed/pod${i}/176`,
	score: 96 - i,
	why: 'As a B2B SaaS founder, you will love how this show breaks down early-stage growth with real numbers.'
}));

export const GET: RequestHandler = () => {
	if (!import.meta.env.DEV) error(404);
	const { html } = buildEmail({
		picks,
		unsubscribeUrl: 'https://example.com/unsubscribe?token=x',
		signedUpAt: new Date(),
		submittedUrl: 'https://example.com'
	});
	return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
};

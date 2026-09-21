// One-click path for List-Unsubscribe-Post (RFC 8058). Acts on POST straight away

import { cleanToken, setActive } from '$lib/server/db/unsubscribe';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ url }) => {
	const token = cleanToken(url.searchParams.get('token'));
	if (!token) return new Response('Bad request', { status: 400 });
	try {
		await setActive(token, false);
	} catch (error) {
		console.error('[unsubscribe]', error);
		return new Response('Try again later', { status: 500 });
	}
	// same answer for unknown tokens
	return new Response('Unsubscribed', { status: 200 });
};

// GET only shows a button - mail scanners prefetch links, so never act on GET

import { fail } from '@sveltejs/kit';
import { cleanToken, setActive } from '$lib/server/db/unsubscribe';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({
	token: cleanToken(url.searchParams.get('token'))
});

const change =
	(active: boolean): Actions[string] =>
	async ({ request }) => {
		const token = cleanToken((await request.formData()).get('token'));
		if (!token)
			return fail(400, { error: 'That link looks broken. Use the one in your latest email.' });
		try {
			await setActive(token, active);
		} catch (error) {
			console.error('[unsubscribe]', error);
			return fail(500, { error: 'Something went wrong on our side. Please try again.' });
		}
		return { done: active ? 'resubscribed' : 'unsubscribed' };
	};

export const actions: Actions = { unsubscribe: change(false), resubscribe: change(true) };

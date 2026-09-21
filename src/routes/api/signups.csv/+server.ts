// Only admin surface: a CSV of signups, behind a bearer secret

import { CRON_SECRET } from '$lib/server/env';
import { supabase } from '$lib/supabase/server';
import type { RequestHandler } from './$types';

// Quote everything and defuse spreadsheet formulas (=, +, -, @)
const cell = (value: unknown) => {
	const text = String(value ?? '');
	return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
};

export const GET: RequestHandler = async ({ request }) => {
	// empty secret must never match
	if (!CRON_SECRET || request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
		return new Response('Unauthorized', { status: 401 });
	}
	const { data, error } = await supabase
		.from('signups')
		.select('email, submitted_url, url_kind, persona_confidence, is_active, created_at')
		.order('created_at', { ascending: false });
	if (error) return new Response('Query failed', { status: 500 });

	const head = [
		'email',
		'submitted_url',
		'url_kind',
		'persona_confidence',
		'is_active',
		'created_at'
	];
	const lines = data.map((row) => head.map((key) => cell(row[key as keyof typeof row])).join(','));
	return new Response([head.join(','), ...lines].join('\n'), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'cache-control': 'no-store'
		}
	});
};

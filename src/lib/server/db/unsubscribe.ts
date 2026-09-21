// Token is the only credential. Callers never learn whether it matched (no enumeration)

import { supabase } from '$lib/supabase/server';

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const cleanToken = (raw: unknown): string | null =>
	typeof raw === 'string' && TOKEN.test(raw) ? raw : null;

export async function setActive(token: string, active: boolean): Promise<void> {
	const { error } = await supabase
		.from('signups')
		.update({ is_active: active })
		.eq('unsubscribe_token', token);
	if (error) throw error;
}

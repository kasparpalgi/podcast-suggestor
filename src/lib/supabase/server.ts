// Server only client. Secret key bypasses RLS -> tables have no anon policies
// If a query fails with RLS, it runs on the wrong client. Don't add a policy.

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SECRET_API, SUPABASE_URL } from '$lib/server/env';
import type { Database } from './types';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_API, {
	auth: { persistSession: false, autoRefreshToken: false }
});

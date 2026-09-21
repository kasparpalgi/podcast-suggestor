// Onlu server config. `$env/dynamic/private` - deployed function reads the real values at runtime (instead at build time)

import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

export const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY ?? '';
export const OPENROUTER_MODEL = env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite';
export const PODSCAN_API_KEY = env.PODSCAN_API_KEY ?? '';
/** Opt-in only, never inferred from NODE_ENV — see `podscan/fixtures.ts`. */
export const PODSCAN_FIXTURES = env.PODSCAN_FIXTURES === '1';
export const SUPABASE_URL = publicEnv.PUBLIC_SUPABASE_URL ?? '';
/** Bypasses RLS - server only, never import in client code */
export const SUPABASE_SECRET_API = env.SUPABASE_SECRET_API ?? '';
/** Bearer secret for the CSV export (and the weekly cron, task 010) */
export const CRON_SECRET = env.CRON_SECRET ?? '';

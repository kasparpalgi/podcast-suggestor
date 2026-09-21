// Onlu server config. `$env/dynamic/private` - deployed function reads the real values at runtime (instead at build time)

import { env } from '$env/dynamic/private';

export const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY ?? '';
export const OPENROUTER_MODEL = env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite';
export const PODSCAN_API_KEY = env.PODSCAN_API_KEY ?? '';
/** Opt-in only, never inferred from NODE_ENV — see `podscan/fixtures.ts`. */
export const PODSCAN_FIXTURES = env.PODSCAN_FIXTURES === '1';

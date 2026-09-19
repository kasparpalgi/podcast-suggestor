// Onlu server config. `$env/dynamic/private` - deployed function reads the real values at runtime (instead at build time)

import { env } from '$env/dynamic/private';

export const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY ?? '';
export const OPENROUTER_MODEL = env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite';

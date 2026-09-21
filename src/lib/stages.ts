// Shared by the pipeline (server) and the loading screen (client)
export const STAGES = ['reading', 'profiling', 'searching', 'scoring', 'done'] as const;
export type Stage = (typeof STAGES)[number];

// Why this exists: the dashboard read "363 API calls today" after a handful of submissions.
// Nothing here was cached, so every re-submit — every dev-server reload, every live spec —
// re-bought the same searches. One submission is 5 search terms (plus 3 if the pool has to
// widen), so ~45 runs is 363 calls. On the trial tier that is three and a half days of quota
// spent re-asking Podscan questions it had already answered.
//
// Storing the *promise* rather than the value also collapses concurrent duplicates: the five
// parallel terms of a double-clicked submission become one request, which matters because
// `x-concurrency-limit` is 5.

type Entry = { at: number; value: Promise<unknown> };

const store = new Map<string, Entry>();
const MAX_ENTRIES = 200;

export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
	const hit = store.get(key);
	if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;

	const value = fn();
	store.set(key, { at: Date.now(), value });

	// A failure must not be remembered: a 429 cached for six hours would outlive the minute
	// it belongs to and lock the term out long after the budget came back.
	value.catch(() => {
		if (store.get(key)?.value === value) store.delete(key);
	});

	// Insertion-ordered, so the first key is the oldest write
	if (store.size > MAX_ENTRIES) {
		const oldest = store.keys().next().value;
		if (oldest !== undefined) store.delete(oldest);
	}
	return value;
}

/** Tests only — the cache is per-process and otherwise lives for the life of the instance. */
export const clearCache = (): void => store.clear();

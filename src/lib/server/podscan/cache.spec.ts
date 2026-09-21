import { afterEach, describe, expect, it, vi } from 'vitest';
import { cached, clearCache } from './cache';

afterEach(() => clearCache());

const TTL = 60_000;

describe('cached — the quota saver', () => {
	it('serves a repeat of the same search without calling Podscan again', async () => {
		const call = vi.fn().mockResolvedValue('shows');
		await expect(cached('search:a', TTL, call)).resolves.toBe('shows');
		await expect(cached('search:a', TTL, call)).resolves.toBe('shows');
		expect(call).toHaveBeenCalledTimes(1);
	});

	it('collapses concurrent duplicates — a double-clicked submit is one request', async () => {
		const call = vi.fn().mockResolvedValue('shows');
		await Promise.all([cached('search:a', TTL, call), cached('search:a', TTL, call)]);
		expect(call).toHaveBeenCalledTimes(1);
	});

	it('keeps different searches apart', async () => {
		const call = vi.fn().mockImplementation((...args: unknown[]) => Promise.resolve(args));
		await cached('search:a', TTL, () => call('a'));
		await cached('search:b', TTL, () => call('b'));
		expect(call).toHaveBeenCalledTimes(2);
	});

	it('re-fetches once the entry is older than its TTL', async () => {
		vi.useFakeTimers();
		const call = vi.fn().mockResolvedValue('shows');
		await cached('search:a', TTL, call);
		vi.advanceTimersByTime(TTL + 1);
		await cached('search:a', TTL, call);
		expect(call).toHaveBeenCalledTimes(2);
		vi.useRealTimers();
	});

	// A 429 cached for six hours would outlive the minute it belongs to
	it('does not remember a failure', async () => {
		const call = vi.fn().mockRejectedValueOnce(new Error('429')).mockResolvedValue('shows');
		await expect(cached('search:a', TTL, call)).rejects.toThrow('429');
		await expect(cached('search:a', TTL, call)).resolves.toBe('shows');
		expect(call).toHaveBeenCalledTimes(2);
	});
});

import { describe, expect, it } from 'vitest';
import { isPrivateAddress } from './privateAddress';

describe('isPrivateAddress', () => {
	it.each([
		['127.0.0.1', 'loopback'],
		['0.0.0.0', 'this host'],
		['10.1.2.3', 'private /8'],
		['172.16.0.1', 'private /12 lower bound'],
		['172.31.255.254', 'private /12 upper bound'],
		['192.168.1.1', 'private /16'],
		['169.254.169.254', 'cloud metadata'],
		['100.64.0.1', 'carrier-grade NAT'],
		['198.18.0.1', 'benchmarking'],
		['192.0.0.1', 'IETF protocol assignments'],
		['224.0.0.1', 'multicast'],
		['255.255.255.255', 'broadcast'],
		['::1', 'IPv6 loopback'],
		['::', 'IPv6 unspecified'],
		['fd00::1', 'IPv6 unique local'],
		['fe80::1', 'IPv6 link-local'],
		['ff02::1', 'IPv6 multicast'],
		['::ffff:169.254.169.254', 'v4-mapped metadata'],
		['::ffff:10.0.0.1', 'v4-mapped private'],
		['64:ff9b::127.0.0.1', 'NAT64 loopback']
	])('blocks %s (%s)', (ip) => {
		expect(isPrivateAddress(ip)).toBe(true);
	});

	it.each([
		['93.184.216.34', 'example.com'],
		['8.8.8.8', 'public resolver'],
		['1.1.1.1', 'public resolver'],
		['172.15.0.1', 'just below the private /12'],
		['172.32.0.1', 'just above the private /12'],
		['100.63.255.255', 'just below CGNAT'],
		['100.128.0.1', 'just above CGNAT'],
		['192.169.0.1', 'not 192.168'],
		['223.255.255.255', 'last unicast address'],
		['2606:4700:4700::1111', 'public IPv6'],
		['::ffff:93.184.216.34', 'v4-mapped public']
	])('allows %s (%s)', (ip) => {
		expect(isPrivateAddress(ip)).toBe(false);
	});
});

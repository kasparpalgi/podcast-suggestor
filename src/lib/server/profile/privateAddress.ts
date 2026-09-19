// TODO: Is this resolved IP somewhere we must never send user-supplied request? Blocking
// hostnames is not enough: `evil.com` can simply have an A record pointing at 10.0.0.5,
// On Vercel that is function's own VPC. Pure and table-tested — no I/O here

function v4Parts(ip: string): number[] | null {
	const match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (!match) return null;
	const parts = match.slice(1).map(Number);
	return parts.every((part) => part <= 255) ? parts : null;
}

function isPrivateV4([a, b]: number[]): boolean {
	if (a === 0 || a === 10 || a === 127) return true; // this-host, private, loopback
	if (a >= 224) return true; // multicast, reserved, broadcast
	if (a === 169 && b === 254) return true; // link-local — AWS/GCP metadata lives here
	if (a === 172 && b >= 16 && b <= 31) return true; // private
	if (a === 192 && (b === 168 || b === 0)) return true; // private, IETF protocol assignments
	if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
	if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
	return false;
}

function isPrivateV6(ip: string): boolean {
	const address = ip
		.toLowerCase()
		.replace(/^\[|\]$/g, '')
		.split('%')[0];
	if (address === '::' || address === '::1') return true;

	// v4-mapped (::ffff:10.0.0.1), v4-compatible and NAT64 all carry a dotted IPv4 tail
	// judge them by the address they actually reach.
	const embedded = address.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
	if (embedded) {
		const parts = v4Parts(embedded[1]);
		if (parts) return isPrivateV4(parts);
	}

	const head = address.split(':')[0];
	if (/^f[cd]/.test(head)) return true; // fc00::/7 unique local
	if (/^fe[89ab]/.test(head)) return true; // fe80::/10 link-local
	if (/^ff/.test(head)) return true; // ff00::/8 multicast
	return false;
}

export function isPrivateAddress(ip: string): boolean {
	const parts = v4Parts(ip);
	return parts ? isPrivateV4(parts) : isPrivateV6(ip);
}

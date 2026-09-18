// Classifies an already-normalized URL so task 003 knows how to build the persona:
// a LinkedIn person/company slug, or a plain website to scrape.

export type UrlKind = 'linkedin-person' | 'linkedin-company' | 'website';
export type Classification = { kind: UrlKind; slug?: string };

export function classifyUrl(normalizedUrl: string): Classification {
	let host: string;
	let pathname: string;
	try {
		const u = new URL(normalizedUrl);
		host = u.hostname.toLowerCase();
		pathname = u.pathname;
	} catch {
		return { kind: 'website' };
	}

	// Match linkedin.com on any subdomain: www., uk., de., ...
	if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
		const person = pathname.match(/^\/in\/([^/]+)\/?$/i);
		if (person) return { kind: 'linkedin-person', slug: decodeURIComponent(person[1]) };
		const company = pathname.match(/^\/company\/([^/]+)\/?$/i);
		if (company) return { kind: 'linkedin-company', slug: decodeURIComponent(company[1]) };
	}

	return { kind: 'website' };
}

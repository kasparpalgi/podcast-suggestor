// Test-only fixtures, shared by the scoring specs. Not imported by any runtime module.

import type { Candidate } from '../podscan/candidates';
import type { Persona } from '../profile/persona';
import type { Criterion } from './types';

export const persona: Persona = {
	role: 'Bootstrapped SaaS founder',
	seniority: 'founder',
	industry: 'B2B SaaS',
	audience: 'Revenue teams at mid-market companies',
	topics: ['pricing', 'go-to-market', 'sales hiring', 'retention', 'positioning'],
	goals: ['hire the first AEs', 'move to usage-based pricing'],
	avoid: ['intro explainers', 'venture-scale growth playbooks'],
	confidence: 0.82,
	searchTerms: ['b2b saas', 'bootstrapped founders', 'saas pricing', 'sales hiring']
};

export const criteria: Criterion[] = [
	{ name: 'Depth', description: 'Operator-level, not intro.', weight: 0.5 },
	{ name: 'Reach', description: 'Consistent and well produced.', weight: 0.5 }
];

export function candidate(id: string, overrides: Partial<Candidate> = {}): Candidate {
	return {
		id,
		name: `Show ${id}`,
		url: `https://example.test/${id}`,
		imageUrl: '',
		publisher: `Publisher ${id}`,
		description: `About show ${id}.`,
		categories: ['Business'],
		audienceSize: 5000,
		episodeCount: 120,
		lastPostedAt: new Date().toISOString(),
		matchedTerms: ['b2b saas'],
		...overrides
	};
}

export const pool = (count: number, prefix = ''): Candidate[] =>
	Array.from({ length: count }, (_, index) => candidate(`${prefix}${index + 1}`));

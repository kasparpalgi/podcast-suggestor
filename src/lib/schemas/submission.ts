import { z } from 'zod';
import { normalizeUrl } from '$lib/url';

// One schema, imported by both the form (InputScreen) and the server action — the
// validation rules live here once and are never duplicated.
export const submissionSchema = z.object({
	url: z
		.string()
		.min(1, 'Enter your website or LinkedIn URL.')
		.transform((value, ctx) => {
			const result = normalizeUrl(value);
			if (!result.ok) {
				ctx.addIssue({ code: 'custom', message: result.error });
				return z.NEVER;
			}
			return result.url;
		}),
	email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.')),
	// Manual-interests escape hatch — Requirements QA #4 commits us to offering it up front.
	interests: z.string().max(200, 'Keep it under 200 characters.').optional()
});

export type Submission = z.infer<typeof submissionSchema>;
export type SubmissionInput = z.input<typeof submissionSchema>;

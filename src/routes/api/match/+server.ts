import { submissionSchema } from '$lib/schemas/submission';
import { runPipeline } from '$lib/server/pipeline';
import type { RequestHandler } from './$types';

const HEARTBEAT_MS = 10_000;

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const parsed = submissionSchema.safeParse(body);
	if (!parsed.success) {
		return Response.json(
			{ error: parsed.error.issues[0]?.message ?? 'Invalid request.' },
			{ status: 400 }
		);
	}

	const encoder = new TextEncoder();
	let beat: ReturnType<typeof setInterval>;

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			// Blank line keeps proxies awake, the client skips it
			beat = setInterval(() => controller.enqueue(encoder.encode('\n')), HEARTBEAT_MS);
			try {
				for await (const event of runPipeline(parsed.data)) {
					controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
				}
			} finally {
				clearInterval(beat);
				controller.close();
			}
		},
		cancel() {
			clearInterval(beat);
		}
	});

	return new Response(stream, {
		headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' }
	});
};

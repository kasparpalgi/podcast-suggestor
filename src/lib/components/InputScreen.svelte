<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import Button from './ui/Button.svelte';
	import Field from './ui/Field.svelte';
	import Alert from './ui/Alert.svelte';
	import { submissionSchema, type Submission } from '$lib/schemas/submission';
	import { normalizeUrl } from '$lib/url';
	import { classifyUrl } from '$lib/classifyUrl';

	type Props = {
		onsubmit: (values: Submission) => void;
		submitting?: boolean;
		submitError?: string;
	};

	let { onsubmit, submitting = false, submitError }: Props = $props();

	let url = $state('');
	let email = $state('');
	let interests = $state('');

	let urlTouched = $state(false);
	let urlError = $state<string | undefined>();
	let emailError = $state<string | undefined>();

	// Live normalization powers both the LinkedIn nudge and the "we'll read …" hint.
	const normalized = $derived.by(() => {
		const result = normalizeUrl(url);
		return result.ok ? result.url : null;
	});
	const isLinkedin = $derived(!!normalized && classifyUrl(normalized).kind !== 'website');
	// Make the auto-prepend visible instead of magic — only once it actually differs.
	const urlHint = $derived(
		normalized && normalized !== url.trim() ? `We'll read ${normalized}` : undefined
	);

	function handleUrlBlur() {
		urlTouched = true;
		const result = submissionSchema.shape.url.safeParse(url);
		urlError = result.success ? undefined : result.error.issues[0]?.message;
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const parsed = submissionSchema.safeParse({ url, email, interests: interests || undefined });
		if (!parsed.success) {
			urlTouched = true;
			const fields = parsed.error.flatten().fieldErrors;
			urlError = fields.url?.[0];
			emailError = fields.email?.[0];
			return;
		}
		urlError = undefined;
		emailError = undefined;
		onsubmit(parsed.data);
	}
</script>

<section class="w-full animate-rise">
	<span
		class="inline-block rounded-full bg-accent px-3 py-1 text-xs font-bold tracking-widest uppercase"
	>
		Your taste, decoded
	</span>
	<h1 class="mt-4 font-display text-5xl leading-[0.95] font-extrabold tracking-tight">
		Find your next favourite podcast.
	</h1>
	<p class="mt-4 text-base leading-relaxed text-foreground/70">
		Drop a link and an email. We read between the lines and pull six shows you'll actually binge.
	</p>

	<form class="mt-8 space-y-4" onsubmit={handleSubmit} novalidate>
		{#if submitError}
			<Alert variant="error">{submitError}</Alert>
		{/if}

		<Field
			id="podmatch-url"
			label="Your website or LinkedIn"
			placeholder="lex-doe.com or linkedin.com/in/lex"
			bind:value={url}
			hint={urlHint}
			error={urlTouched ? urlError : undefined}
			onblur={handleUrlBlur}
		/>
		<Field
			id="podmatch-email"
			label="Email"
			type="email"
			placeholder="you@example.com"
			bind:value={email}
			error={emailError}
		/>

		{#if isLinkedin}
			<div class="animate-rise">
				<Field
					id="podmatch-interests"
					label="Anything specific you're into? (optional)"
					placeholder="B2B growth, indie hacking, longevity…"
					bind:value={interests}
					hint="LinkedIn hides most of a profile, so a hint or two sharpens your matches."
				/>
			</div>
		{/if}

		<Button type="submit" disabled={submitting}>
			<span class="group inline-flex items-center gap-2">
				{submitting ? 'Finding your matches…' : 'Get my six matches'}
				{#if !submitting}
					<ArrowRight class="size-5 transition-transform duration-150 group-hover:translate-x-1" />
				{/if}
			</span>
		</Button>
	</form>
</section>

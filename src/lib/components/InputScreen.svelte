<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import Button from './ui/Button.svelte';
	import Field from './ui/Field.svelte';

	type Props = { onsubmit: (values: { url: string; email: string }) => void };

	let { onsubmit }: Props = $props();

	// Validation, normalization and the interests escape hatch land in task 002.
	let url = $state('');
	let email = $state('');

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		onsubmit({ url, email });
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

	<form class="mt-8 space-y-4" onsubmit={handleSubmit}>
		<Field
			id="podmatch-url"
			label="Your website or LinkedIn"
			placeholder="lex-doe.com or linkedin.com/in/lex"
			bind:value={url}
		/>
		<Field
			id="podmatch-email"
			label="Email"
			type="email"
			placeholder="you@example.com"
			bind:value={email}
		/>
		<Button type="submit">
			<span class="group inline-flex items-center gap-2">
				Get my six matches
				<ArrowRight class="size-5 transition-transform duration-150 group-hover:translate-x-1" />
			</span>
		</Button>
	</form>
</section>

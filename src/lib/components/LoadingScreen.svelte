<script lang="ts">
	import { Headphones } from '@lucide/svelte';

	// Task 006 feeds `label` from the real NDJSON progress stream.
	type Props = { label?: string };

	let { label = 'Matching your taste against thousands of shows.' }: Props = $props();
</script>

<section class="flex w-full animate-rise flex-col items-center py-16 text-center">
	<div
		class="grid size-20 animate-wiggle place-items-center rounded-full bg-butter shadow-pop-sm"
		aria-hidden="true"
	>
		<Headphones class="size-9" />
	</div>
	<h2 class="mt-6 font-display text-3xl font-extrabold tracking-tight">
		Reading between your lines…
	</h2>
	<p class="mt-2 text-sm text-foreground/60" aria-live="polite">{label}</p>
	<div class="mt-6 flex gap-2" aria-hidden="true">
		{#each [0, 1, 2] as i (i)}
			<span
				class="size-3 animate-bounce-dot rounded-full bg-primary"
				style="animation-delay: {i * 0.15}s"
			></span>
		{/each}
	</div>
</section>

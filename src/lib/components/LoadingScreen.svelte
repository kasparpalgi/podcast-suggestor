<script lang="ts">
	import { Headphones } from '@lucide/svelte';

	import { STAGES, type Stage } from '$lib/stages';

	type Props = { label?: string; stage?: Stage | null };

	let { label = 'Matching your taste against thousands of shows.', stage = null }: Props = $props();
	const current = $derived(stage ? STAGES.indexOf(stage) : 0);
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
		{#each STAGES as s, i (s)}
			<span
				class="size-3 rounded-full border-2 transition-colors duration-300 motion-safe:animate-bounce-dot {i <=
				current
					? 'bg-primary'
					: 'bg-transparent'}"
				style="animation-delay: {i * 0.15}s"
			></span>
		{/each}
	</div>
</section>

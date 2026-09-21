<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import Badge from './ui/Badge.svelte';
	import type { ScoredCandidate } from '$lib/server/scoring/types';

	type Props = { pick: ScoredCandidate; tint: string; index: number };
	let { pick, tint, index }: Props = $props();

	const { candidate } = $derived(pick);
	let broken = $state(false);
</script>

<!-- Plain text only. Podscan fields are stripped server-side but never use {@html} here -->
<a
	href={candidate.url}
	target="_blank"
	rel="external noopener noreferrer"
	class="group relative flex items-start gap-4 rounded-2xl border-2 bg-card p-3 shadow-pop-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-pop-md motion-safe:animate-rise"
	style="animation-delay: {0.05 + index * 0.07}s"
>
	<div class="size-16 shrink-0 overflow-hidden rounded-xl {tint}">
		{#if candidate.imageUrl && !broken}
			<img
				src={candidate.imageUrl}
				alt="{candidate.name} cover"
				width="64"
				height="64"
				loading="lazy"
				onerror={() => (broken = true)}
				class="size-16 object-cover"
			/>
		{/if}
	</div>
	<div class="min-w-0 flex-1">
		<div class="flex items-center justify-between gap-2">
			<h3 class="truncate font-display text-lg font-extrabold">{candidate.name}</h3>
			<Badge score={pick.total} />
		</div>
		<p class="mt-0.5 text-sm leading-snug [overflow-wrap:anywhere] text-foreground/65">
			<span class="font-bold text-primary">Why it's a fit:</span>
			{pick.why}
		</p>
		{#if candidate.description}
			<p class="mt-1 line-clamp-2 text-xs [overflow-wrap:anywhere] text-foreground/45">
				{candidate.description}
			</p>
		{/if}
	</div>
	<ArrowRight
		class="mt-1 size-5 shrink-0 text-foreground/30 transition-transform duration-200 group-hover:translate-x-1"
	/>
</a>

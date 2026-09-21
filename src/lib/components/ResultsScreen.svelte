<script lang="ts">
	import PodcastCard from './PodcastCard.svelte';
	import CriteriaPanel from './CriteriaPanel.svelte';
	import ConfidenceNote from './ConfidenceNote.svelte';
	import type { ScoredCandidate, Criterion } from '$lib/server/scoring/types';

	type Props = {
		picks: ScoredCandidate[];
		criteria: Criterion[];
		shortfall: boolean;
		nextBest: ScoredCandidate[];
		lowConfidence: boolean;
		/** undefined until the email step exists (task 009) */
		emailTo?: string;
		emailFailed?: boolean;
		onreset: () => void;
		onrefine: (interests: string) => void;
		onresend?: () => void;
	};

	let {
		picks,
		criteria,
		shortfall,
		nextBest,
		lowConfidence,
		emailTo,
		emailFailed = false,
		onreset,
		onrefine,
		onresend
	}: Props = $props();

	const TINTS = [
		'bg-primary/15',
		'bg-secondary/40',
		'bg-accent/40',
		'bg-sky/40',
		'bg-lilac/35',
		'bg-primary/10'
	];
	const runnerUp = $derived(nextBest[0]);
</script>

<section class="w-full motion-safe:animate-rise">
	<div class="flex items-center justify-between">
		<p class="font-display text-2xl font-extrabold tracking-tight">
			{shortfall ? `${picks.length} of 6 cleared the bar` : 'Six picks for you'}
		</p>
		<button
			type="button"
			onclick={onreset}
			class="cursor-pointer text-xs font-bold tracking-widest text-foreground/60 uppercase underline decoration-2 underline-offset-4 transition hover:text-primary"
		>
			Start over
		</button>
	</div>
	<p class="mt-1 text-sm text-foreground/60">Matched to your work and the things you care about.</p>

	{#if emailFailed}
		<p class="mt-2 text-sm font-medium text-destructive">
			We couldn't email this list.
			{#if onresend}
				<button type="button" onclick={onresend} class="cursor-pointer underline">Resend</button>
			{/if}
		</p>
	{:else if emailTo}
		<p class="mt-2 text-xs font-medium text-foreground/50">Also sent to {emailTo}</p>
	{/if}

	{#if lowConfidence}
		<ConfidenceNote {onrefine} />
	{/if}

	<div class="mt-5 space-y-3">
		{#each picks as pick, i (pick.candidate.id)}
			<PodcastCard {pick} index={i} tint={TINTS[i % TINTS.length]} />
		{/each}
	</div>

	{#if shortfall && runnerUp}
		<p class="mt-4 text-sm text-foreground/60">
			Only {picks.length} cleared our 90% bar. Closest runner-up: {runnerUp.candidate.name} ({runnerUp.total}%)
		</p>
	{/if}

	<CriteriaPanel {criteria} />
</section>

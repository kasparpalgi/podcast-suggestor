<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';

	export type Pick = {
		id: string;
		name: string;
		why: string;
		/** Already stripped of Podscan's raw HTML, server-side. Never rendered with {@html}. */
		imageUrl?: string;
		url?: string;
		tint: string;
	};

	type Props = { picks?: Pick[]; onreset: () => void };

	// Placeholder set — task 007 swaps this for the scored picks from the pipeline.
	const PLACEHOLDER: Pick[] = [
		{
			id: '1',
			name: 'The Design Desk',
			why: "you ship interfaces daily — this one's pure craft.",
			tint: 'bg-primary/15'
		},
		{
			id: '2',
			name: 'Founder Frequency',
			why: "you've built two things solo — this one's built for builders.",
			tint: 'bg-secondary/40'
		},
		{
			id: '3',
			name: 'Signal & Noise',
			why: "you write about product — here's the deep cut.",
			tint: 'bg-accent/40'
		},
		{
			id: '4',
			name: 'The Creative Cuts',
			why: 'your portfolio leans editorial — so do these guests.',
			tint: 'bg-sky/40'
		},
		{
			id: '5',
			name: 'Momentum Club',
			why: "you're scaling a team — this one's about pace.",
			tint: 'bg-lilac/35'
		},
		{
			id: '6',
			name: 'Off the Cuff',
			why: 'your bio says "curious" — this one\'s pure curiosity.',
			tint: 'bg-primary/10'
		}
	];

	let { picks = PLACEHOLDER, onreset }: Props = $props();
</script>

<section class="w-full animate-rise">
	<div class="flex items-center justify-between">
		<p class="font-display text-2xl font-extrabold tracking-tight">Six picks for you</p>
		<button
			type="button"
			onclick={onreset}
			class="cursor-pointer text-xs font-bold tracking-widest text-foreground/60 uppercase underline decoration-2 underline-offset-4 transition hover:text-primary"
		>
			Start over
		</button>
	</div>
	<p class="mt-1 text-sm text-foreground/60">Matched to your work and the things you care about.</p>

	<div class="mt-5 space-y-3">
		{#each picks as pick, i (pick.id)}
			<article
				class="group relative flex animate-rise items-center gap-4 rounded-2xl border-2 bg-card p-3 shadow-pop-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-pop-md"
				style="animation-delay: {0.05 + i * 0.07}s"
			>
				{#if pick.imageUrl}
					<img
						src={pick.imageUrl}
						alt="{pick.name} cover"
						width="64"
						height="64"
						loading="lazy"
						class="size-16 shrink-0 rounded-xl object-cover outline-1 -outline-offset-1 outline-black/5 {pick.tint}"
					/>
				{:else}
					<div class="size-16 shrink-0 rounded-xl {pick.tint}" aria-hidden="true"></div>
				{/if}
				<div class="min-w-0 flex-1">
					<h3 class="truncate font-display text-lg font-extrabold">{pick.name}</h3>
					<p class="mt-0.5 text-sm leading-snug text-foreground/65">
						<span class="font-bold text-primary">Why it's a fit:</span>
						{pick.why}
					</p>
				</div>
				<ArrowRight
					class="size-5 shrink-0 text-foreground/30 transition-transform duration-200 group-hover:translate-x-1"
				/>
			</article>
		{/each}
	</div>
</section>

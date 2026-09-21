<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import type { Criterion } from '$lib/server/scoring/types';

	type Props = { criteria: Criterion[] };
	let { criteria }: Props = $props();
</script>

{#if criteria.length}
	<details class="group mt-4 rounded-2xl border-2 bg-card px-4 py-3 shadow-pop-xs">
		<summary
			class="flex cursor-pointer list-none items-center justify-between text-sm font-bold [&::-webkit-details-marker]:hidden"
		>
			How these were picked
			<ChevronDown class="size-4 transition-transform group-open:rotate-180" />
		</summary>
		<ul class="mt-3 space-y-2.5">
			{#each criteria as c (c.name)}
				<li class="text-sm leading-snug">
					<span class="font-bold">{c.name}</span>
					<span class="font-bold text-primary"> · {Math.round(c.weight * 100)}%</span>
					<span class="block text-foreground/65">{c.description}</span>
				</li>
			{/each}
		</ul>
	</details>
{/if}

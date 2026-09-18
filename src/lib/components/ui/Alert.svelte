<script lang="ts">
	import type { Snippet } from 'svelte';
	import { CircleAlert, CircleCheck } from '@lucide/svelte';

	type Props = { variant?: 'error' | 'success'; children: Snippet };

	let { variant = 'error', children }: Props = $props();

	const styles = {
		error: 'border-destructive bg-destructive/10 text-destructive',
		success: 'border-primary bg-primary/10 text-foreground'
	};
</script>

<div
	role="alert"
	class="flex items-start gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-medium shadow-pop-xs {styles[
		variant
	]}"
>
	{#if variant === 'error'}
		<CircleAlert class="mt-0.5 size-4 shrink-0" />
	{:else}
		<CircleCheck class="mt-0.5 size-4 shrink-0" />
	{/if}
	<span>{@render children()}</span>
</div>

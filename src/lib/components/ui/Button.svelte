<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		type?: 'button' | 'submit';
		variant?: 'primary' | 'outline';
		disabled?: boolean;
		onclick?: () => void;
		children: Snippet;
	};

	let {
		type = 'button',
		variant = 'primary',
		disabled = false,
		onclick,
		children
	}: Props = $props();

	const base =
		'font-display shadow-pop-md w-full cursor-pointer rounded-2xl px-6 py-4 text-xl font-extrabold transition-all duration-150 hover:-translate-y-0.5 hover:shadow-pop-lg active:translate-y-1 active:shadow-pop-xs disabled:pointer-events-none disabled:opacity-60';

	const variants = {
		primary: 'bg-primary text-primary-foreground',
		outline: 'bg-background text-foreground border-2'
	};
</script>

<button {type} {disabled} {onclick} class="{base} {variants[variant]}">
	{@render children()}
</button>

<script lang="ts">
	type Props = {
		id: string;
		label: string;
		value: string;
		type?: 'text' | 'email';
		placeholder?: string;
		hint?: string;
		error?: string;
		onblur?: () => void;
	};

	let {
		id,
		label,
		value = $bindable(),
		type = 'text',
		placeholder,
		hint,
		error,
		onblur
	}: Props = $props();
</script>

<div>
	<label for={id} class="mb-1 block text-sm font-bold">{label}</label>
	<input
		{id}
		{type}
		{placeholder}
		{onblur}
		bind:value
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
		class="w-full rounded-2xl border-2 bg-card px-4 py-3.5 text-base transition placeholder:text-foreground/40 focus:border-primary focus:ring-4 focus:ring-primary/20 focus:outline-none
		{error ? 'border-destructive' : ''}"
	/>
	{#if error}
		<p id="{id}-error" class="mt-1 text-sm font-medium text-destructive">{error}</p>
	{:else if hint}
		<p id="{id}-hint" class="mt-1 text-sm text-foreground/50">{hint}</p>
	{/if}
</div>

<script lang="ts">
	import Field from './ui/Field.svelte';
	import Button from './ui/Button.svelte';

	type Props = { onrefine: (interests: string) => void };
	let { onrefine }: Props = $props();

	let interests = $state('');

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (interests.trim()) onrefine(interests.trim().slice(0, 200));
	}
</script>

<form onsubmit={submit} class="mt-4 space-y-3 rounded-2xl border-2 bg-butter/30 p-4">
	<p class="text-sm font-medium">
		Built from your profile URL only --> tell us what you're into to sharpen these.
	</p>
	<Field
		id="refine"
		label="Your interests"
		bind:value={interests}
		placeholder="e.g. B2B SaaS, hiring"
	/>
	<Button type="submit" variant="outline" disabled={!interests.trim()}>Sharpen my list</Button>
</form>

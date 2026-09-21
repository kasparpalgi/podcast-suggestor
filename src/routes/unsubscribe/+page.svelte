<script lang="ts">
	import { enhance } from '$app/forms';
	import Alert from '$lib/components/ui/Alert.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Logo from '$lib/components/Logo.svelte';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Unsubscribe — PodMatch</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto flex min-h-screen w-full max-w-md flex-col gap-8 px-6 py-10">
	<Logo />
	<main class="flex flex-col gap-5">
		{#if form?.done === 'unsubscribed'}
			<h1 class="font-display text-3xl font-extrabold">You are unsubscribed.</h1>
			<Alert variant="success">No more weekly emails. Sorry to see you go!</Alert>
			<p class="text-sm text-muted-foreground">Clicked by mistake?</p>
			<form method="POST" action="?/resubscribe" use:enhance>
				<input type="hidden" name="token" value={data.token} />
				<Button type="submit" variant="outline">Resubscribe me</Button>
			</form>
		{:else if form?.done === 'resubscribed'}
			<h1 class="font-display text-3xl font-extrabold">Welcome back!</h1>
			<Alert variant="success">You are on the list again. Next picks land next week.</Alert>
		{:else if data.token}
			<h1 class="font-display text-3xl font-extrabold">Stop the weekly picks?</h1>
			<p class="text-muted-foreground">Confirm and we will not email you again.</p>
			{#if form?.error}<Alert>{form.error}</Alert>{/if}
			<form method="POST" action="?/unsubscribe" use:enhance>
				<input type="hidden" name="token" value={data.token} />
				<Button type="submit">Yes, unsubscribe</Button>
			</form>
		{:else}
			<h1 class="font-display text-3xl font-extrabold">Hmm, that link is broken.</h1>
			<p class="text-muted-foreground">
				Open the unsubscribe link from your latest PodMatch email and try again.
			</p>
		{/if}
	</main>
</div>

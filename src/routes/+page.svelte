<script lang="ts">
	import Floaties from '$lib/components/Floaties.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import InputScreen from '$lib/components/InputScreen.svelte';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import ResultsScreen from '$lib/components/ResultsScreen.svelte';

	const TITLE = 'PodMatch — Find your next favourite podcast';
	const DESCRIPTION =
		"Drop a link and an email — PodMatch reads between the lines and pulls six shows you'll actually binge.";

	let view = $state<'input' | 'loading' | 'results'>('input');

	// Placeholder transition. Task 006 replaces this with the real NDJSON pipeline stream.
	function startMatching() {
		view = 'loading';
		setTimeout(() => (view = 'results'), 1600);
	}
</script>

<svelte:head>
	<title>{TITLE}</title>
	<meta name="description" content={DESCRIPTION} />
	<meta property="og:title" content={TITLE} />
	<meta property="og:description" content={DESCRIPTION} />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div class="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
	<Floaties />
	<div
		class="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-between px-6 py-10"
	>
		<header class="flex items-center justify-between">
			<Logo />
			<span
				class="rounded-full border-2 bg-background px-3 py-1 text-xs font-bold tracking-widest uppercase"
			>
				Taste engine
			</span>
		</header>

		<main class="my-8">
			{#if view === 'input'}
				<InputScreen onsubmit={startMatching} />
			{:else if view === 'loading'}
				<LoadingScreen />
			{:else}
				<ResultsScreen onreset={() => (view = 'input')} />
			{/if}
		</main>

		<footer class="text-center text-xs font-medium text-foreground/40">
			PodMatch · a taste engine for curious ears
		</footer>
	</div>
</div>

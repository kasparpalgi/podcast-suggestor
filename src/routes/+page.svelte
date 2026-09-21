<script lang="ts">
	import { page } from '$app/state';
	import Floaties from '$lib/components/Floaties.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import InputScreen from '$lib/components/InputScreen.svelte';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import ResultsScreen from '$lib/components/ResultsScreen.svelte';

	const TITLE = 'PodMatch — Find your next favourite podcast';
	const DESCRIPTION =
		"Drop a link and an email — PodMatch reads between the lines and pulls six shows you'll actually binge.";

	import { match } from '$lib/stores/match.svelte';

	const view = $derived(match.loading ? 'loading' : match.hasResult ? 'results' : 'input');
</script>

<svelte:head>
	<title>{TITLE}</title>
	<meta name="description" content={DESCRIPTION} />
	<meta property="og:title" content={TITLE} />
	<meta property="og:description" content={DESCRIPTION} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="{page.url.origin}/og.png" />
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
				<InputScreen onsubmit={match.submit} submitError={match.error ?? undefined} />
			{:else if view === 'loading'}
				<LoadingScreen label={match.label || undefined} stage={match.stage} />
			{:else}
				<ResultsScreen
					picks={match.picks}
					criteria={match.criteria}
					shortfall={match.shortfall}
					nextBest={match.nextBest}
					lowConfidence={match.lowConfidence}
					onreset={match.reset}
					onrefine={match.rerun}
				/>
			{/if}
		</main>

		<footer class="text-center text-xs font-medium text-foreground/40">
			PodMatch · a taste engine for curious ears
		</footer>
	</div>
</div>

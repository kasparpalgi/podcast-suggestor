<script lang="ts">
	type Props = { score: number };
	let { score }: Props = $props();
</script>

<span
	class="shrink-0 rounded-full border-2 bg-butter px-2 py-0.5 text-xs font-extrabold text-ink shadow-pop-xs"
	title="Match score"
>
	{score}%
</span>

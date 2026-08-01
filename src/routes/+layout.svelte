<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { theme } from '$lib/ui/theme.svelte';

	let { children } = $props();

	// Das Attribut steht schon (Inline-Skript in app.html); hier wird nur der
	// Zustand daran angehängt und auf Systemwechsel gehört.
	$effect(() => theme.init());
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- viewport, theme-color und color-scheme stehen in app.html. Sie dürfen
	     nicht doppelt deklariert werden: das Inline-Skript im Kopf braucht sie,
	     bevor SvelteKit überhaupt etwas rendert. -->
</svelte:head>

{@render children()}

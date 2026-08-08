<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import SideNav from '$lib/ui/SideNav.svelte';
	import { theme } from '$lib/ui/theme.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	// Das Attribut steht schon (Inline-Skript in app.html); hier wird nur der
	// Zustand daran angehängt und auf Systemwechsel gehört.
	$effect(() => theme.init());

	/**
	 * Seiten ohne Schiene.
	 *
	 * Anmeldung und Rechtsseiten sind für sich stehende Blätter — die eine
	 * hat genau eine Aufgabe, die anderen sind Fließtext. Eine
	 * Navigationsschiene daneben wäre Beiwerk, und beide tragen ihren
	 * eigenen Rückweg.
	 */
	const OHNE_SCHIENE = new Set(['/anmelden', '/impressum', '/datenschutz']);
	const mitSchiene = $derived(!OHNE_SCHIENE.has(page.url.pathname));

	/*
	 * Anfangswert aus dem DOM, nicht aus localStorage.
	 *
	 * Dasselbe Muster wie beim Thema und aus demselben Grund: das
	 * Inline-Skript in app.html hat den Zustand vor dem ersten Anstrich
	 * gesetzt. Hier noch einmal zu lesen hieße, ihn ein zweites Mal zu
	 * entscheiden — und die beiden Entscheidungen könnten auseinandergehen.
	 */
	let schmal = $state(browser && document.documentElement.dataset.nav === 'schmal');

	function umschalten() {
		schmal = !schmal;
		document.documentElement.dataset.nav = schmal ? 'schmal' : 'weit';
		localStorage.setItem('wv.nav', schmal ? 'schmal' : 'weit');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- viewport, theme-color und color-scheme stehen in app.html. Sie dürfen
	     nicht doppelt deklariert werden: das Inline-Skript im Kopf braucht sie,
	     bevor SvelteKit überhaupt etwas rendert. -->
</svelte:head>

{#if mitSchiene}
	<div class="huelle">
		<SideNav user={data.user} collapsed={schmal} onToggle={umschalten} />
		<div class="inhalt">{@render children()}</div>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.huelle {
		display: flex;
		height: 100dvh;
		overflow: hidden;
	}

	/* `min-width: 0` ist hier nicht Kosmetik: ohne die Zeile wächst ein
	   Flex-Kind an seinem Inhalt und die Karte drückt die Schiene aus dem
	   Bild, sobald eine lange Tourbezeichnung darin steht. */
	.inhalt {
		flex: 1;
		min-width: 0;
		min-height: 0;
	}
</style>

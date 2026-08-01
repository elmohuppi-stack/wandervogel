<script lang="ts">
	/**
	 * Schwebende Werkzeuggruppe über einer Karte.
	 *
	 * Werkzeuge der Karte liegen auf der Karte, nicht in der Kopfzeile: sie
	 * gehören zu dem, worauf sie wirken. Als eigener Baustein, damit
	 * Planungsansicht und Übersicht nicht zwei Gruppen bekommen, die sich
	 * um ein Pixel unterscheiden.
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		/** Ecke der Karte. */
		place?: 'top-left' | 'top-right';
		children: Snippet;
	}

	let { place = 'top-right', children }: Props = $props();
</script>

<div class="tools {place}">{@render children()}</div>

<style>
	.tools {
		position: absolute;
		top: var(--sp-5);
		z-index: var(--z-map-ui);
		display: flex;
		flex-direction: column;
		gap: 1px;
		background: var(--surface);
		border: 1px solid var(--edge);
		border-radius: var(--r-sm);
		box-shadow: var(--el-2);
	}

	.top-right {
		right: var(--sp-5);
	}
	.top-left {
		left: var(--sp-5);
	}
</style>

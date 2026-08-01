<script lang="ts">
	/**
	 * Ein Filter oder eine Marke. Anklickbar, wenn `onclick` gesetzt ist —
	 * sonst ein reines Etikett (Aktivitätsart auf einer Tourenkarte).
	 */
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons';

	interface Props {
		icon?: IconName;
		colorVar?: string;
		pressed?: boolean;
		onclick?: () => void;
		children: Snippet;
	}

	let { icon, colorVar, pressed, onclick, children }: Props = $props();
</script>

{#snippet inner()}
	{#if colorVar}<span class="swatch" style="background: var({colorVar})"></span>{/if}
	{#if icon}<Icon name={icon} size={12} />{/if}
	{@render children()}
{/snippet}

{#if onclick}
	<button type="button" class="chip" aria-pressed={pressed} {onclick}>{@render inner()}</button>
{:else}
	<span class="chip static">{@render inner()}</span>
{/if}

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-3);
		min-height: 24px;
		padding: 0 var(--sp-4);
		border: 1px solid var(--edge);
		border-radius: var(--r-pill);
		background: var(--surface);
		color: var(--ink-2);
		font-size: var(--fs-xs);
		font-family: inherit;
		line-height: 1;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}

	.static {
		cursor: default;
		background: transparent;
	}

	button.chip:hover {
		color: var(--ink);
		border-color: var(--ink-3);
	}

	.chip[aria-pressed='true'] {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--paper);
		font-weight: 600;
	}

	.swatch {
		width: 8px;
		height: 8px;
		border-radius: var(--r-pill);
		flex: none;
	}
</style>

<script lang="ts">
	/**
	 * Der Knopf. Ersetzt fünf unabhängige Stile, die vorher nebeneinander
	 * standen und sich in Höhe, Radius und Farbe leicht unterschieden.
	 *
	 * Mit `href` wird ein Link daraus. Das ist kein Zierrat: „zurück zu den
	 * Touren" ist eine Navigation und gehört in ein <a>, muss aber aussehen
	 * wie ein Knopf.
	 */
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons';

	type Rest = HTMLButtonAttributes & HTMLAnchorAttributes;

	interface Props extends Rest {
		variant?: 'primary' | 'quiet' | 'ghost' | 'danger';
		size?: 'sm' | 'md';
		icon?: IconName;
		iconEnd?: IconName;
		/** Füllt die Breite des Elternelements. */
		wide?: boolean;
		/** Zeigt einen Ladekreis statt des führenden Symbols und sperrt. */
		loading?: boolean;
		href?: string;
		children?: Snippet;
	}

	let {
		variant = 'quiet',
		size = 'md',
		icon,
		iconEnd,
		wide = false,
		loading = false,
		href,
		children,
		...rest
	}: Props = $props();
</script>

{#snippet inner()}
	{#if loading}
		<Icon name="loader" class="spin" />
	{:else if icon}
		<Icon name={icon} />
	{/if}
	{#if children}<span class="text">{@render children()}</span>{/if}
	{#if iconEnd}<Icon name={iconEnd} />{/if}
{/snippet}

{#if href}
	<a class="btn {variant} {size}" class:wide {href} {...rest}>{@render inner()}</a>
{:else}
	<button
		type="button"
		class="btn {variant} {size}"
		class:wide
		disabled={loading || rest.disabled}
		{...rest}>{@render inner()}</button
	>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--sp-3);
		border: 1px solid transparent;
		border-radius: var(--r-sm);
		font-size: var(--fs-sm);
		font-family: inherit;
		line-height: 1;
		text-decoration: none;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}

	.md {
		min-height: var(--hit-sm);
		padding: 0 var(--sp-5);
	}
	.sm {
		min-height: 24px;
		padding: 0 var(--sp-4);
		font-size: var(--fs-xs);
	}

	.wide {
		display: flex;
		width: 100%;
	}

	.btn:disabled {
		cursor: default;
		opacity: 0.5;
	}

	/* Die eine hervorgehobene Aktion je Bildschirm. */
	.primary {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--paper);
		font-weight: 600;
	}
	.primary:hover:not(:disabled) {
		background: var(--ink-2);
		border-color: var(--ink-2);
	}

	/* Der Normalfall: sichtbar, aber zurückhaltend. */
	.quiet {
		background: var(--surface-2);
		border-color: var(--edge);
		color: var(--ink);
	}
	.quiet:hover:not(:disabled) {
		border-color: var(--ink-3);
	}

	/* Für Nebensächliches, das trotzdem anklickbar aussehen muss. */
	.ghost {
		background: transparent;
		color: var(--ink-2);
	}
	.ghost:hover:not(:disabled) {
		background: var(--surface-2);
		color: var(--ink);
	}

	.danger {
		background: transparent;
		color: var(--bad);
	}
	.danger:hover:not(:disabled) {
		background: var(--bad-bg);
	}

	.text {
		/* Ohne das rutscht Text mit Unterlängen gegen das Symbol. */
		padding-block: 0.15em;
	}

	/* Vom globalen prefers-reduced-motion automatisch stillgelegt. */
	.btn :global(.spin) {
		animation: spin 900ms linear infinite;
	}

	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}
</style>

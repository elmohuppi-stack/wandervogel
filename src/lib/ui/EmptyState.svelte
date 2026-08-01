<script lang="ts">
	/**
	 * Ein Leerzustand, der etwas anbietet.
	 *
	 * Die Anforderung dazu steht in §7: nicht beschreiben, was fehlt, sondern
	 * zeigen, was als Nächstes geht. „Noch keine." war der alte Zustand und
	 * hat niemandem geholfen.
	 */
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons';

	interface Props {
		icon: IconName;
		title?: string;
		size?: 'sm' | 'md';
		children?: Snippet;
		actions?: Snippet;
	}

	let { icon, title, size = 'md', children, actions }: Props = $props();
</script>

<div class="empty {size}">
	<Icon name={icon} size={size === 'sm' ? 16 : 24} class="glyph" />
	<div class="text">
		{#if title}<b>{title}</b>{/if}
		{#if children}<p>{@render children()}</p>{/if}
		{#if actions}<div class="actions">{@render actions()}</div>{/if}
	</div>
</div>

<style>
	.empty {
		display: flex;
		gap: var(--sp-4);
		color: var(--ink-2);
	}

	.md {
		gap: var(--sp-5);
	}

	.empty :global(.glyph) {
		color: var(--ink-3);
		margin-top: 0.15em;
	}

	.text {
		min-width: 0;
	}

	b {
		display: block;
		color: var(--ink);
		font-size: var(--fs-sm);
	}

	.md b {
		font-size: var(--fs-base);
	}

	p {
		margin: var(--sp-2) 0 0;
		font-size: var(--fs-sm);
		line-height: 1.5;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4);
		margin-top: var(--sp-5);
	}
</style>

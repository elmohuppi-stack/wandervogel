<script lang="ts">
	/**
	 * Ein Abschnitt in einer Schiene. Titel links, Aktionen rechts.
	 *
	 * `count` steht bewusst im Titel und nicht in der Liste darunter: die
	 * Anzahl gehört zur Überschrift, nicht zum Inhalt.
	 */
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons';

	interface Props {
		title?: string;
		icon?: IconName;
		count?: number;
		/** Nimmt den übrigen Platz und scrollt innen. */
		grow?: boolean;
		actions?: Snippet;
		children: Snippet;
	}

	let { title, icon, count, grow = false, actions, children }: Props = $props();
</script>

<section class="panel" class:grow>
	{#if title}
		<header>
			{#if icon}<Icon name={icon} size={14} />{/if}
			<h2 class="label">{title}</h2>
			{#if count !== undefined}<span class="count num">{count}</span>{/if}
			{#if actions}<div class="actions">{@render actions()}</div>{/if}
		</header>
	{/if}
	<div class="body" class:grow>{@render children()}</div>
</section>

<style>
	.panel {
		padding: var(--sp-5);
		border-bottom: 1px solid var(--edge-soft);
		display: flex;
		flex-direction: column;
		/* Nicht schrumpfen. In einer scrollenden Schiene würde Flex das
		   Panel sonst stauchen, und der Inhalt liefe sichtbar über das
		   nächste — Text auf Text. */
		flex: none;
		min-height: 0;
	}

	.panel:last-child {
		border-bottom: 0;
	}

	.grow {
		flex: 1;
		min-height: 0;
	}

	header {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		margin-bottom: var(--sp-4);
		color: var(--ink-3);
	}

	h2 {
		margin: 0;
		flex: none;
	}

	.count {
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}

	.actions {
		margin-left: auto;
		display: flex;
		gap: var(--sp-2);
	}

	.body.grow {
		overflow-y: auto;
	}
</style>

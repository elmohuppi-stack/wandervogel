<script lang="ts">
	/**
	 * Ein Knopf, der nur aus einem Symbol besteht.
	 *
	 * `label` ist Pflicht, nicht optional: ohne Beschriftung wäre der Knopf
	 * für Screenreader ein leerer Kasten. Sie wird zugleich der native
	 * Tooltip — für alle anderen.
	 */
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons';

	interface Props extends HTMLButtonAttributes {
		icon: IconName;
		label: string;
		size?: 'sm' | 'md';
		tone?: 'default' | 'danger';
		/** Für Umschalter: setzt aria-pressed und die gedrückte Fläche. */
		pressed?: boolean;
	}

	let { icon, label, size = 'md', tone = 'default', pressed, ...rest }: Props = $props();
</script>

<button
	type="button"
	class="ib {size} {tone}"
	aria-label={label}
	title={label}
	aria-pressed={pressed}
	{...rest}
>
	<Icon name={icon} size={size === 'sm' ? 14 : 16} />
</button>

<style>
	.ib {
		display: inline-grid;
		place-items: center;
		border: 1px solid transparent;
		border-radius: var(--r-sm);
		background: transparent;
		color: var(--ink-3);
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}

	.md {
		width: var(--hit-sm);
		height: var(--hit-sm);
	}
	.sm {
		width: 22px;
		height: 22px;
	}

	.ib:hover:not(:disabled) {
		background: var(--surface-2);
		color: var(--ink);
	}

	.danger:hover:not(:disabled) {
		background: var(--bad-bg);
		color: var(--bad);
	}

	.ib[aria-pressed='true'] {
		background: var(--surface-2);
		border-color: var(--edge);
		color: var(--ink);
	}

	.ib:disabled {
		cursor: default;
		opacity: 0.4;
	}
</style>

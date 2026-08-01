<script lang="ts">
	/**
	 * Eine Kennzahl: Symbol, Beschriftung, Zahl, Einheit.
	 *
	 * Die Einheit steht kleiner und dichter an der Zahl — sonst liest man
	 * „620" und „hm" als zwei Angaben. Zahlen laufen tabellarisch, damit
	 * sie beim Aktualisieren nicht springen.
	 */
	import Icon from './Icon.svelte';
	import type { IconName } from './icons';

	interface Props {
		icon?: IconName;
		iconRotate?: 0 | 180;
		label: string;
		value: string;
		unit?: string;
		size?: 'sm' | 'lg';
	}

	let { icon, iconRotate = 0, label, value, unit, size = 'sm' }: Props = $props();
</script>

<div class="tile {size}">
	<div class="head">
		{#if icon}<Icon name={icon} size={12} rotate={iconRotate} />{/if}
		<span class="lbl">{label}</span>
	</div>
	<div class="val num">{value}{#if unit}<span class="unit">{unit}</span>{/if}</div>
</div>

<style>
	.tile {
		min-width: 0;
	}

	.head {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		color: var(--ink-3);
	}

	.lbl {
		font-size: var(--fs-xs);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.val {
		font-size: var(--fs-lg);
		font-weight: 600;
		line-height: 1.2;
		color: var(--ink);
	}

	.lg .val {
		font-size: var(--fs-xl);
	}

	.unit {
		font-size: var(--fs-sm);
		font-weight: 400;
		color: var(--ink-2);
		margin-left: 0.1em;
	}
</style>

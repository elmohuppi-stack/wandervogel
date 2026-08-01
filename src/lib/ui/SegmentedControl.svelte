<script lang="ts">
	/**
	 * Ein Wert aus wenigen, die alle sichtbar bleiben sollen.
	 *
	 * Semantisch eine Radiogruppe, nicht eine Reihe gedrückter Knöpfe: mit
	 * `aria-pressed` sagt ein Screenreader „Knopf, gedrückt" und verschweigt,
	 * dass es Alternativen gibt. Deshalb rollendes tabindex und Pfeiltasten —
	 * ein Tabstopp für die Gruppe, Pfeile wählen darin.
	 */
	import Icon from './Icon.svelte';
	import type { IconName } from './icons';

	export interface Segment {
		value: string;
		label: string;
		icon?: IconName;
		/** Farbpunkt, z. B. die Routenfarbe der Aktivitätsart. */
		colorVar?: string;
	}

	interface Props {
		options: Segment[];
		value: string;
		/** Beschriftung der Gruppe — Pflicht, sonst ist sie namenlos. */
		label: string;
		size?: 'sm' | 'md';
		/** Nur Symbole zeigen; die Beschriftung bleibt für Screenreader da. */
		labelsHidden?: boolean;
		onchange?: (value: string) => void;
	}

	let {
		options,
		value = $bindable(),
		label,
		size = 'md',
		labelsHidden = false,
		onchange
	}: Props = $props();

	let root: HTMLDivElement | undefined = $state();

	function pick(v: string) {
		value = v;
		onchange?.(v);
	}

	function onkeydown(e: KeyboardEvent) {
		const dir =
			e.key === 'ArrowRight' || e.key === 'ArrowDown'
				? 1
				: e.key === 'ArrowLeft' || e.key === 'ArrowUp'
					? -1
					: 0;
		if (!dir) return;
		e.preventDefault();
		const i = options.findIndex((o) => o.value === value);
		const next = options[(i + dir + options.length) % options.length];
		pick(next.value);
		// Der Fokus muss dem Wert folgen, sonst hängt er auf dem alten Feld.
		root?.querySelector<HTMLButtonElement>(`[data-v="${CSS.escape(next.value)}"]`)?.focus();
	}
</script>

<div
	bind:this={root}
	class="seg {size}"
	role="radiogroup"
	aria-label={label}
	{onkeydown}
	tabindex={-1}
>
	{#each options as o (o.value)}
		<button
			type="button"
			role="radio"
			data-v={o.value}
			aria-checked={value === o.value}
			aria-label={labelsHidden ? o.label : undefined}
			title={labelsHidden ? o.label : undefined}
			tabindex={value === o.value ? 0 : -1}
			onclick={() => pick(o.value)}
		>
			{#if o.colorVar}
				<span class="swatch" style="background: var({o.colorVar})"></span>
			{/if}
			{#if o.icon}<Icon name={o.icon} size={size === 'sm' ? 14 : 16} />{/if}
			{#if !labelsHidden}<span>{o.label}</span>{/if}
		</button>
	{/each}
</div>

<style>
	.seg {
		display: inline-flex;
		gap: 1px;
		background: var(--edge);
		border: 1px solid var(--edge);
		border-radius: var(--r-sm);
		overflow: hidden;
	}

	button {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-3);
		border: 0;
		background: var(--surface);
		color: var(--ink-3);
		cursor: pointer;
		font-size: var(--fs-sm);
		line-height: 1;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}

	.md button {
		min-height: var(--hit-sm);
		padding: 0 var(--sp-5);
	}
	.sm button {
		min-height: 24px;
		padding: 0 var(--sp-4);
		font-size: var(--fs-xs);
	}

	button:hover {
		color: var(--ink);
	}

	button[aria-checked='true'] {
		background: var(--surface-2);
		color: var(--ink);
		font-weight: 600;
	}

	/* Der Ring gehört um die ganze Gruppe, nicht um ein Feld darin —
	   sonst wird er von den Nachbarn beschnitten. */
	button:focus-visible {
		outline: none;
	}
	.seg:has(button:focus-visible) {
		outline: var(--focus-w) solid var(--focus);
		outline-offset: 2px;
	}

	.swatch {
		width: 9px;
		height: 9px;
		border-radius: var(--r-pill);
		flex: none;
	}
</style>

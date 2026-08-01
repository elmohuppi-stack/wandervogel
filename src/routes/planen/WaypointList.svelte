<script lang="ts">
	/**
	 * Die Wegpunkte der Tour, sortierbar durch Ziehen.
	 *
	 * Zwei bewusste Abweichungen vom vorherigen Stand:
	 *
	 * Der Papierkorb ist *immer* sichtbar. Vorher stand er auf opacity 0 und
	 * erschien erst beim Überfahren — auf einem Handy gibt es ihn damit gar
	 * nicht, und beim Überfliegen der Liste sieht man nicht, dass Zeilen
	 * löschbar sind. In einer 288px-Schiene kostet ein 22px-Symbol nichts.
	 *
	 * Die Tastaturbedienung sitzt am Griff, nicht an der Zeile. Vorher war
	 * die ganze Zeile role="button" mit tabindex — mit einem <button> darin,
	 * was ungültig ist und von Screenreadern unterschiedlich behandelt wird.
	 * Jetzt ist der Griff ein echter Knopf: dort landet der Fokus, dort
	 * fasst auch die Maus an, und Alt+Pfeil sortiert um.
	 */
	import type { Waypoint } from '$lib/tour/types';
	import Icon from '$lib/ui/Icon.svelte';
	import IconButton from '$lib/ui/IconButton.svelte';

	interface Props {
		waypoints: Waypoint[];
		onReorder: (from: number, to: number) => void;
		onRemove: (id: string) => void;
	}

	let { waypoints, onReorder, onRemove }: Props = $props();

	let dragFrom = $state<number | null>(null);
	let dragOver = $state<number | null>(null);

	function onListKeydown(e: KeyboardEvent, i: number) {
		if (!e.altKey) return;
		if (e.key === 'ArrowUp' && i > 0) {
			e.preventDefault();
			onReorder(i, i - 1);
		} else if (e.key === 'ArrowDown' && i < waypoints.length - 1) {
			e.preventDefault();
			onReorder(i, i + 1);
		}
	}

	/** Start und Ziel bekommen ein Schildchen; die Nummer bleibt, weil die
	 *  Karte dieselbe Nummer in den Kreis schreibt. */
	function rolle(i: number): string | null {
		if (i === 0) return 'Start';
		if (i === waypoints.length - 1 && waypoints.length > 1) return 'Ziel';
		return null;
	}
</script>

<ul class="wps">
	{#each waypoints as w, i (w.id)}
		<li
			class="wp"
			class:over={dragOver === i}
			draggable="true"
			ondragstart={() => (dragFrom = i)}
			ondragover={(e) => {
				e.preventDefault();
				dragOver = i;
			}}
			ondragleave={() => (dragOver = null)}
			ondrop={(e) => {
				e.preventDefault();
				if (dragFrom !== null) onReorder(dragFrom, i);
				dragFrom = null;
				dragOver = null;
			}}
			ondragend={() => {
				dragFrom = null;
				dragOver = null;
			}}
		>
			<button
				type="button"
				class="grip"
				aria-label="Wegpunkt {i + 1} umsortieren, mit Alt und Pfeiltasten"
				title="Ziehen oder Alt + ↑ ↓"
				onkeydown={(e) => onListKeydown(e, i)}
			>
				<Icon name="grip" size={14} />
			</button>
			<span class="idx num">{i + 1}</span>
			<span class="nm">
				{w.name ?? `${w.lat.toFixed(4)}, ${w.lon.toFixed(4)}`}
				{#if rolle(i)}<span class="rolle">{rolle(i)}</span>{/if}
			</span>
			<IconButton
				icon="trash"
				label="Wegpunkt {i + 1} löschen"
				size="sm"
				tone="danger"
				onclick={() => onRemove(w.id)}
			/>
		</li>
	{/each}
</ul>

<style>
	.wps {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.wp {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: var(--sp-2) var(--sp-2) var(--sp-2) 0;
		border-radius: var(--r-sm);
		cursor: grab;
	}

	.wp:hover {
		background: var(--surface-2);
	}

	.wp.over {
		box-shadow: inset 0 2px 0 var(--route);
	}

	.grip {
		display: grid;
		place-items: center;
		width: 20px;
		height: 22px;
		flex: none;
		border: 0;
		border-radius: var(--r-xs);
		background: transparent;
		color: var(--ink-3);
		cursor: grab;
	}
	.grip:hover {
		color: var(--ink);
	}

	.idx {
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		flex: none;
		border-radius: var(--r-pill);
		background: var(--route);
		color: var(--on-route);
		font-size: 10px;
		font-weight: 700;
	}

	.nm {
		flex: 1;
		min-width: 0;
		font-size: var(--fs-sm);
		font-family: var(--mono);
		color: var(--ink-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.rolle {
		margin-left: var(--sp-3);
		padding: 0 var(--sp-2);
		border-radius: var(--r-xs);
		background: var(--surface-2);
		border: 1px solid var(--edge-soft);
		font-family: var(--sans);
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}
</style>

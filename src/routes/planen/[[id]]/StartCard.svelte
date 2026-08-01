<script lang="ts">
	/**
	 * Der Leerzustand über der Karte.
	 *
	 * Vorher stand hier ein Satz grauer Text. Der eigentliche Mangel war
	 * aber nicht die Länge, sondern dass nirgends steht, wie man die App
	 * bedient: Rechtsklick löscht, Ziehen verschiebt, Ziehen in der Liste
	 * sortiert um. Das erfuhr man bislang erst, *nachdem* man Wegpunkte
	 * hatte — in einer Fußnote der Schiene.
	 *
	 * Die Anforderung „keine Menüs für Standardaktionen" verbietet Menüs,
	 * nicht Erklärungen.
	 */
	import type { ActivityDefinition } from '$lib/geo/activity';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Icon from '$lib/ui/Icon.svelte';

	interface Props {
		def: ActivityDefinition;
		/** Erscheint erst, wenn es die Funktion gibt. Ein ausgegrautes
		 *  Angebot ist schlechter als keines. */
		onImportGpx?: () => void;
	}

	let { def, onImportGpx }: Props = $props();
</script>

<div class="card">
	<EmptyState icon="waypoint" title="Los geht’s">
		In die Karte klicken setzt den Start. Ab dem zweiten Wegpunkt wird die Route entlang
		echter {def.routeLayerLabel} berechnet.

		{#snippet actions()}
			{#if onImportGpx}
				<Button variant="quiet" size="sm" icon="route" onclick={onImportGpx}>
					GPX importieren
				</Button>
			{/if}
		{/snippet}
	</EmptyState>

	<ul class="gesten">
		<li><Icon name="waypoint" size={14} /><b>Klicken</b><span>Wegpunkt setzen</span></li>
		<li><Icon name="grip" size={14} /><b>Ziehen</b><span>Wegpunkt verschieben</span></li>
		<li><Icon name="trash" size={14} /><b>Rechtsklick</b><span>Wegpunkt löschen</span></li>
	</ul>
</div>

<style>
	.card {
		position: absolute;
		/* Unter der Werkzeugzeile: Suche und Standortknopf liegen oben und
		   dürfen bei schmalem Fenster nicht überdeckt werden. */
		top: calc(var(--sp-5) + var(--hit-sm) + var(--sp-4));
		left: 50%;
		translate: -50% 0;
		z-index: var(--z-map-ui);
		max-width: 42ch;
		padding: var(--sp-5) var(--sp-6);
		background: color-mix(in srgb, var(--surface) 94%, transparent);
		backdrop-filter: blur(6px);
		border: 1px solid var(--edge);
		border-radius: var(--r-md);
		box-shadow: var(--el-2);
	}

	.gesten {
		list-style: none;
		margin: var(--sp-5) 0 0;
		padding: var(--sp-5) 0 0;
		border-top: 1px solid var(--edge-soft);
		display: grid;
		gap: var(--sp-3);
	}

	.gesten li {
		display: grid;
		grid-template-columns: auto 6.5rem 1fr;
		align-items: center;
		gap: var(--sp-4);
		font-size: var(--fs-sm);
		color: var(--ink-3);
	}

	b {
		color: var(--ink-2);
		font-weight: 600;
	}
</style>

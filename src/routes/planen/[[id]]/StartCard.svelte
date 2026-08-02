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
	 *
	 * Steht in der Schiene, nicht über der Karte. Der erste Entwurf schwebte
	 * mittig darüber und verdeckte genau das, worauf sich die Anleitung
	 * bezieht — man konnte nicht klicken, wohin sie zeigte.
	 */
	import type { ActivityDefinition } from '$lib/geo/activity';
	import Button from '$lib/ui/Button.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import Panel from '$lib/ui/Panel.svelte';

	interface Props {
		def: ActivityDefinition;
		/** Erscheint erst, wenn es die Funktion gibt. Ein ausgegrautes
		 *  Angebot ist schlechter als keines. */
		onImportGpx?: () => void;
		onSearchRoute?: () => void;
	}

	let { def, onImportGpx, onSearchRoute }: Props = $props();
</script>

<Panel title="Los geht’s" icon="waypoint">
	<p class="text">
		In die Karte klicken setzt den Start. Ab dem zweiten Wegpunkt wird die Route entlang
		echter {def.routeLayerLabel} berechnet.
	</p>

	<div class="wege">
		{#if onSearchRoute}
			<Button variant="quiet" size="sm" wide icon="search" onclick={onSearchRoute}>
				{def.routeLayerLabel} in der Nähe
			</Button>
		{/if}
		{#if onImportGpx}
			<Button variant="quiet" size="sm" wide icon="route" onclick={onImportGpx}>
				GPX importieren
			</Button>
		{/if}
	</div>

	<ul class="gesten">
		<li><Icon name="waypoint" size={14} /><b>Klicken</b><span>Wegpunkt setzen</span></li>
		<li><Icon name="grip" size={14} /><b>Ziehen</b><span>verschieben</span></li>
		<li><Icon name="trash" size={14} /><b>Rechtsklick</b><span>löschen</span></li>
	</ul>
</Panel>

<style>
	.text {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ink-2);
		line-height: 1.5;
	}

	.wege {
		display: grid;
		gap: var(--sp-3);
		margin-top: var(--sp-5);
	}

	.gesten {
		list-style: none;
		margin: var(--sp-5) 0 0;
		padding: var(--sp-4) 0 0;
		border-top: 1px solid var(--edge-soft);
		display: grid;
		gap: var(--sp-3);
	}

	.gesten li {
		display: grid;
		grid-template-columns: auto 5.5rem 1fr;
		align-items: center;
		gap: var(--sp-3);
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}

	b {
		color: var(--ink-2);
		font-weight: 600;
	}
</style>

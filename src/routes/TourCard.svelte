<script lang="ts">
	/**
		 * Eine Tour in der Liste: Umriss, Aktivitätsart, Datum, Name, drei Zahlen.
	 *
	 * Die Klasse heißt `tourkarte` und nicht `karte`: Letzteres trägt auf der
	 * Startseite die Kartenfläche. Solange die Kachel im DOM davor stand, fiel
	 * die Doppelung nicht auf — nach dem Umzug der Liste in die Schiene traf
	 * ein `.karte`-Selektor plötzlich die Landkarte.
	 *
	 * Die ganze Karte ist ein Link und enthält deshalb keinen Knopf — ein
	 * Formular in einem <a> wäre ungültiges HTML. Gelöscht wird in der
	 * Planungsansicht.
	 */
	import * as fmt from '$lib/format';
	import { activity } from '$lib/geo/activity';
	import type { TourListItem } from '$lib/tour/types';
	import Icon from '$lib/ui/Icon.svelte';
	import RouteSketch from '$lib/ui/RouteSketch.svelte';

	interface Props {
		tour: TourListItem;
		active?: boolean;
		onHover?: (id: string | null) => void;
	}

	let { tour, active = false, onHover }: Props = $props();

	const def = $derived(activity(tour.activityType));
	// TourListItem erfüllt MetricInput strukturell — genau dafür ist der
	// Typ in activity.ts strukturell und nicht als RouteResult deklariert.
	const zahlen = $derived(def.listMetrics(tour));
</script>

<a
	class="tourkarte"
	class:active
	href="/planen/{tour.id}"
	style="--route: var({def.colorVar})"
	onmouseenter={() => onHover?.(tour.id)}
	onmouseleave={() => onHover?.(null)}
	onfocusin={() => onHover?.(tour.id)}
	onfocusout={() => onHover?.(null)}
>
	<RouteSketch outline={tour.outline} activityType={tour.activityType} />

	<div class="text">
		<div class="kopf">
			<span class="art"><span class="punkt"></span>{def.label}</span>
			<!--
				Ohne Datum bleibt die Zeile nicht leer. §6.5 führt das Datum
				als Angabe der Tourenkarte; eine Lücke an der Stelle liest
				sich wie ein Darstellungsfehler statt wie eine fehlende
				Angabe. `updatedAt` wäre hier falsch — wann eine Tour zuletzt
				bearbeitet wurde, ist nicht, wann sie stattfindet.
			-->
			{#if tour.date}
				<time datetime={tour.date}>{fmt.day(tour.date)}</time>
			{:else}
				<span class="kein-datum">ohne Datum</span>
			{/if}
		</div>

		<h3>{tour.name}</h3>

		<ul class="zahlen">
			{#each zahlen as m (m.label)}
				<li>
					{#if m.icon}<Icon name={m.icon} rotate={m.iconRotate} size={12} />{/if}
					<span class="num">{m.value}<span class="einheit">{m.unit ?? ''}</span></span>
				</li>
			{/each}
		</ul>
	</div>
</a>

<style>
	.tourkarte {
		display: flex;
		gap: var(--sp-5);
		padding: var(--sp-5);
		border: 1px solid var(--edge-soft);
		border-radius: var(--r-md);
		background: var(--surface);
		text-decoration: none;
		color: inherit;
		transition:
			border-color var(--dur-1) var(--ease),
			box-shadow var(--dur-1) var(--ease);
	}

	.tourkarte:hover,
	.tourkarte.active {
		border-color: var(--route);
		box-shadow: var(--el-1);
	}

	.text {
		flex: 1;
		min-width: 0;
	}

	.kopf {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}

	.art {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
	}

	.punkt {
		width: 8px;
		height: 8px;
		border-radius: var(--r-pill);
		background: var(--route);
	}

	time,
	.kein-datum {
		margin-left: auto;
	}

	.kein-datum {
		font-style: italic;
		opacity: 0.7;
	}

	h3 {
		margin: var(--sp-2) 0 var(--sp-3);
		font-size: var(--fs-base);
		font-weight: 600;
		line-height: 1.25;
		/* Eine Zeile: die Liste soll überfliegbar bleiben. */
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.zahlen {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2) var(--sp-5);
		color: var(--ink-2);
		font-size: var(--fs-sm);
	}

	.zahlen li {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		color: var(--ink-3);
	}

	.zahlen .num {
		color: var(--ink);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.einheit {
		font-weight: 400;
		color: var(--ink-2);
		margin-left: 0.1em;
	}
</style>

<script lang="ts">
	/**
	 * Planungsansicht — das Arbeitsgerät am Laptop.
	 *
	 * Gestaltungsregeln aus den Anforderungen, die hier sichtbar werden:
	 *  · Karte ist die Hauptsache, Bedienelemente treten zurück — aber sie
	 *    sind da und sichtbar; „zurücktreten" heißt nicht „fehlen"
	 *  · keine Menüs für Standardaktionen: Wegpunkt setzen per Klick,
	 *    löschen per Rechtsklick *oder* Papierkorb, verschieben per Ziehen,
	 *    umsortieren durch Ziehen in der Liste
	 *  · Kennzahlen immer sichtbar, nie aufklappen
	 *
	 * Diese Datei hält nur noch Zustand und Layout. Kopfzeile, Leerzustand
	 * und Wegpunktliste liegen daneben.
	 */
	import { activity } from '$lib/geo/activity';
	import MapCanvas from '$lib/map/MapCanvas.svelte';
	import { emptyTour, newId, type RouteResult, type Tour } from '$lib/tour/types';
	import Alert from '$lib/ui/Alert.svelte';
	import Button from '$lib/ui/Button.svelte';
	import ElevationProfile from '$lib/ui/ElevationProfile.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import IconButton from '$lib/ui/IconButton.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import MetricGrid from '$lib/ui/MetricGrid.svelte';
	import Panel from '$lib/ui/Panel.svelte';
	import PlannerTopbar from './PlannerTopbar.svelte';
	import StartCard from './StartCard.svelte';
	import WaypointList from './WaypointList.svelte';

	let tour = $state<Tour>(emptyTour('hike'));
	let route = $state<RouteResult | null>(null);
	let routing = $state(false);
	let routeError = $state<string | null>(null);
	let hoverAt = $state<number | null>(null);
	let profileCollapsed = $state(false);
	let mapRef = $state<ReturnType<typeof MapCanvas> | undefined>();

	const def = $derived(activity(tour.activityType));
	const metrics = $derived(route ? def.metrics(route) : null);

	/* --- Wegpunkte: alles direkt, ohne Menü ------------------------------ */

	function addWaypoint(lon: number, lat: number) {
		tour.waypoints = [...tour.waypoints, { id: newId(), lon, lat }];
	}

	function moveWaypoint(id: string, lon: number, lat: number) {
		tour.waypoints = tour.waypoints.map((w) => (w.id === id ? { ...w, lon, lat } : w));
	}

	function removeWaypoint(id: string) {
		tour.waypoints = tour.waypoints.filter((w) => w.id !== id);
	}

	function reorder(from: number, to: number) {
		if (from === to) return;
		const next = [...tour.waypoints];
		next.splice(to, 0, next.splice(from, 1)[0]);
		tour.waypoints = next;
	}

	function clearAll() {
		tour.waypoints = [];
		route = null;
		routeError = null;
	}

	/* --- Routenberechnung ------------------------------------------------ */

	let recalcTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		// Abhängigkeiten bewusst lesen, damit der Effekt erneut läuft.
		const points = tour.waypoints.map((w) => ({ id: w.id, lon: w.lon, lat: w.lat }));
		const activityType = tour.activityType;

		clearTimeout(recalcTimer);

		if (points.length < 2) {
			route = null;
			routeError = null;
			return;
		}

		// Kurz warten: beim Ziehen eines Wegpunkts würde sonst jede
		// Mausbewegung eine Berechnung auslösen.
		recalcTimer = setTimeout(() => {
			void recalculate(points, activityType);
		}, 250);

		return () => clearTimeout(recalcTimer);
	});

	async function recalculate(
		waypoints: { id: string; lon: number; lat: number }[],
		activityType: Tour['activityType']
	) {
		routing = true;
		routeError = null;
		try {
			const res = await fetch('/api/route', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ activityType, waypoints })
			});
			const data = await res.json();

			if (!res.ok) {
				routeError = data.error ?? 'Routenberechnung fehlgeschlagen';
				route = null;
			} else {
				route = data.route;
			}
		} catch {
			routeError = 'Server nicht erreichbar';
			route = null;
		} finally {
			routing = false;
		}
	}

	/* --- Einklappzustand des Profils merken ------------------------------ */

	$effect(() => {
		const stored = localStorage.getItem('wv.profileCollapsed');
		if (stored !== null) profileCollapsed = stored === '1';
	});

	$effect(() => {
		localStorage.setItem('wv.profileCollapsed', profileCollapsed ? '1' : '0');
	});
</script>

<svelte:head>
	<title>{tour.name} — Wandervogel</title>
</svelte:head>

<div class="app" style="--route: var({def.colorVar})">
	<PlannerTopbar bind:name={tour.name} bind:activityType={tour.activityType} {routing} />

	<!-- Karte: die Hauptsache. -->
	<main class="map-area">
		<MapCanvas
			bind:this={mapRef}
			activityType={tour.activityType}
			waypoints={tour.waypoints}
			{route}
			markerAt={hoverAt}
			onAddWaypoint={addWaypoint}
			onMoveWaypoint={moveWaypoint}
			onRemoveWaypoint={removeWaypoint}
		/>

		{#if tour.waypoints.length === 0}
			<StartCard {def} />
		{/if}

		{#if routeError}
			<div class="fehler">
				<Alert tone="bad">{routeError}</Alert>
			</div>
		{/if}
	</main>

	<!-- Rechte Schiene: Kennzahlen und Wegpunkte, immer sichtbar. -->
	<aside class="rail">
		<Panel title="Kennzahlen" icon="gauge">
			{#if metrics}
				<MetricGrid {metrics} />
				<p class="formel">
					<Icon name="info" size={12} />
					<code>{def.durationExplainer.short}</code>
					{def.durationExplainer.long}
				</p>
			{:else}
				<EmptyState icon="gauge" size="sm">
					Zwei Wegpunkte genügen für die erste Berechnung.
				</EmptyState>
			{/if}
		</Panel>

		<Panel title="Wegpunkte" icon="waypoint" count={tour.waypoints.length} grow>
			{#snippet actions()}
				{#if tour.waypoints.length > 0}
					<IconButton
						icon="trash"
						label="Alle Wegpunkte löschen"
						size="sm"
						tone="danger"
						onclick={clearAll}
					/>
				{/if}
			{/snippet}

			{#if tour.waypoints.length === 0}
				<EmptyState icon="waypoint" size="sm">In die Karte klicken setzt den ersten.</EmptyState>
			{:else}
				<WaypointList
					waypoints={tour.waypoints}
					onReorder={reorder}
					onRemove={removeWaypoint}
				/>
			{/if}
		</Panel>

		{#if route}
			<Panel>
				<Button variant="quiet" wide icon="crosshair" onclick={() => mapRef?.fitToRoute()}>
					Auf Tour zentrieren
				</Button>
			</Panel>
		{/if}
	</aside>

	<ElevationProfile
		{route}
		activityType={tour.activityType}
		bind:collapsed={profileCollapsed}
		bind:hoverAt
	/>
</div>

<style>
	.app {
		display: grid;
		grid-template-columns: 1fr var(--rail-w);
		grid-template-rows: var(--topbar-h) 1fr auto;
		height: 100dvh;
		overflow: hidden;
	}

	.map-area {
		position: relative;
		min-height: 0;
	}

	.rail {
		/* Über beide Zeilen: das Höhenprofil gehört zur Karte, die Schiene
		   läuft daneben bis zum unteren Rand. Sonst bleibt unten rechts
		   eine graue Lücke. */
		grid-row: 2 / span 2;
		grid-column: 2;
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: var(--surface);
		border-left: 1px solid var(--edge);
		overflow: hidden;
	}

	.fehler {
		position: absolute;
		bottom: var(--sp-5);
		left: 50%;
		translate: -50% 0;
		z-index: var(--z-map-ui);
		max-width: 44ch;
		box-shadow: var(--el-2);
	}

	.formel {
		display: flex;
		align-items: baseline;
		gap: var(--sp-3);
		margin: var(--sp-5) 0 0;
		font-size: var(--fs-xs);
		color: var(--ink-3);
		line-height: 1.4;
	}

	.formel code {
		flex: none;
		padding: 0 var(--sp-2);
		border: 1px solid var(--edge-soft);
		border-radius: var(--r-xs);
		background: var(--surface-2);
		font-family: var(--mono);
	}

	/* Schmal: Schiene unter die Karte. Kein responsive Kompromiss — die
	   Feldansicht fürs Handy wird eine eigene Oberfläche, das hier hilft
	   nur einem schmalen Laptopfenster. */
	@media (max-width: 900px) {
		.app {
			grid-template-columns: 1fr;
			grid-template-rows: var(--topbar-h) 1fr minmax(0, 45vh) auto;
		}
		.rail {
			grid-row: 3;
			grid-column: 1;
			border-left: 0;
			border-top: 1px solid var(--edge);
		}
	}
</style>

<script lang="ts">
	/**
	 * Planungsansicht — das Arbeitsgerät am Laptop.
	 *
	 * Gestaltungsregeln aus den Anforderungen, die hier sichtbar werden:
	 *  · Karte ist die Hauptsache, Bedienelemente treten zurück
	 *  · keine Navigationsleiste, nur eine schmale Zeile
	 *  · keine Menüs für Standardaktionen: Wegpunkt setzen per Klick,
	 *    löschen per Rechtsklick, verschieben per Ziehen, umsortieren
	 *    durch Ziehen in der Liste
	 *  · Kennzahlen immer sichtbar, nie aufklappen
	 */
	import * as fmt from '$lib/format';
	import { ACTIVITY_TYPES, activity } from '$lib/geo/activity';
	import MapCanvas from '$lib/map/MapCanvas.svelte';
	import { emptyTour, newId, type RouteResult, type Tour } from '$lib/tour/types';
	import ElevationProfile from '$lib/ui/ElevationProfile.svelte';

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

	/* --- Liste umsortieren ----------------------------------------------- */

	let dragFrom = $state<number | null>(null);
	let dragOver = $state<number | null>(null);

	function onListKeydown(e: KeyboardEvent, i: number) {
		if (!e.altKey) return;
		if (e.key === 'ArrowUp' && i > 0) {
			e.preventDefault();
			reorder(i, i - 1);
		} else if (e.key === 'ArrowDown' && i < tour.waypoints.length - 1) {
			e.preventDefault();
			reorder(i, i + 1);
		}
	}
</script>

<svelte:head>
	<title>{tour.name} — Wandervogel</title>
</svelte:head>

<div class="app" style="--route: var({def.colorVar})">
	<!-- Eine schmale Zeile statt einer Navigationsleiste. -->
	<header class="topbar">
		<span class="mark" aria-hidden="true">W</span>

		<input
			class="tour-name"
			bind:value={tour.name}
			aria-label="Name der Tour"
			spellcheck="false"
		/>

		<div class="act" role="group" aria-label="Aktivitätsart">
			{#each ACTIVITY_TYPES as type (type)}
				{@const a = activity(type)}
				<button
					type="button"
					aria-pressed={tour.activityType === type}
					onclick={() => (tour.activityType = type)}
				>
					<span class="swatch" style="background: var({a.colorVar})"></span>{a.label}
				</button>
			{/each}
		</div>

		<span class="spacer"></span>

		{#if routing}
			<span class="status">Route wird berechnet …</span>
		{/if}

		<a class="quiet" href="/planen">Touren</a>
	</header>

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
			<div class="onboarding">
				<b>In die Karte klicken</b>
				setzt den ersten Wegpunkt. Ab dem zweiten wird die Route entlang echter
				{def.id === 'hike' ? 'Wanderwege' : 'Radwege'} berechnet.
			</div>
		{/if}

		{#if routeError}
			<div class="error" role="alert">
				{routeError}
			</div>
		{/if}
	</main>

	<!-- Rechte Schiene: Kennzahlen und Wegpunkte, immer sichtbar. -->
	<aside class="rail">
		<section class="rail-sec">
			<h2 class="label">Kennzahlen</h2>
			{#if metrics}
				<dl class="metrics">
					{#each metrics as m (m.label)}
						<div>
							<dt>{m.label}</dt>
							<dd class="num">{m.value}{#if m.unit}<span class="u">{m.unit}</span>{/if}</dd>
						</div>
					{/each}
				</dl>
				<p class="formula">
					<code>{def.durationExplainer.short}</code>
					{def.durationExplainer.long}
				</p>
			{:else}
				<p class="hint-text">Zwei Wegpunkte genügen für die erste Berechnung.</p>
			{/if}
		</section>

		<section class="rail-sec grow">
			<h2 class="label">
				Wegpunkte
				{#if tour.waypoints.length > 0}
					<button type="button" class="link" onclick={clearAll}>alle löschen</button>
				{/if}
			</h2>

			{#if tour.waypoints.length === 0}
				<p class="hint-text">Noch keine.</p>
			{:else}
				<ul class="wps">
					{#each tour.waypoints as w, i (w.id)}
						<li>
							<!-- Die greifbare Zeile ist ein eigenes Element: ein <li> darf
							     keinen Tabindex und keine Zeigerereignisse tragen. -->
							<div
								class="wp"
								class:over={dragOver === i}
								role="button"
								tabindex="0"
								draggable="true"
								aria-label="Wegpunkt {i + 1}, mit Alt und Pfeiltasten umsortieren"
								ondragstart={() => (dragFrom = i)}
								ondragover={(e) => {
									e.preventDefault();
									dragOver = i;
								}}
								ondragleave={() => (dragOver = null)}
								ondrop={(e) => {
									e.preventDefault();
									if (dragFrom !== null) reorder(dragFrom, i);
									dragFrom = null;
									dragOver = null;
								}}
								ondragend={() => {
									dragFrom = null;
									dragOver = null;
								}}
								onkeydown={(e) => onListKeydown(e, i)}
							>
								<span class="grip" aria-hidden="true">⠿</span>
								<span class="idx num">{i + 1}</span>
								<span class="nm">{w.name ?? `${w.lat.toFixed(4)}, ${w.lon.toFixed(4)}`}</span>
								<button
									type="button"
									class="del"
									aria-label="Wegpunkt {i + 1} löschen"
									onclick={() => removeWaypoint(w.id)}>×</button
								>
							</div>
						</li>
					{/each}
				</ul>
				<p class="hint-text">
					Ziehen sortiert um · Alt + ↑ ↓ mit Tastatur · Rechtsklick auf der Karte löscht
				</p>
			{/if}
		</section>

		{#if route}
			<section class="rail-sec">
				<button type="button" class="wide" onclick={() => mapRef?.fitToRoute()}>
					Auf Tour zentrieren
				</button>
			</section>
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
		height: 100vh;
		height: 100dvh;
		background: var(--surface);
	}

	/* --- schmale Kopfzeile --- */
	.topbar {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0 0.8rem;
		border-bottom: 1px solid var(--edge-soft);
		min-width: 0;
	}
	.mark {
		width: 22px;
		height: 22px;
		flex: none;
		border-radius: 50%;
		background: var(--ink);
		color: var(--surface);
		display: grid;
		place-items: center;
		font-size: 11px;
		font-weight: 700;
	}
	.tour-name {
		font: inherit;
		font-weight: 570;
		color: inherit;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 2px;
		padding: 0.18rem 0.4rem;
		min-width: 8ch;
		max-width: 34ch;
		flex: 0 1 auto;
	}
	.tour-name:hover {
		border-color: var(--edge);
		background: var(--surface-2);
	}
	.tour-name:focus {
		border-color: var(--edge);
		background: var(--surface);
		outline: none;
	}
	.spacer {
		flex: 1;
	}
	.status {
		font-size: var(--fs-sm);
		color: var(--ink-3);
	}
	.quiet {
		font-size: var(--fs-sm);
		color: var(--ink-3);
		text-decoration: none;
		padding: 0.2rem 0.3rem;
	}
	.quiet:hover {
		color: var(--ink);
		text-decoration: underline;
	}

	.act {
		display: flex;
		gap: 2px;
		padding: 2px;
		border: 1px solid var(--edge);
		border-radius: var(--r);
		background: var(--surface-2);
		flex: none;
	}
	.act button {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: var(--fs-sm);
		font-weight: 550;
		padding: 0.25rem 0.6rem;
		border: 0;
		border-radius: 2px;
		background: transparent;
		color: var(--ink-3);
		cursor: pointer;
	}
	.act button[aria-pressed='true'] {
		background: var(--surface);
		color: var(--ink);
	}
	.swatch {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex: none;
	}

	/* --- Karte --- */
	.map-area {
		position: relative;
		overflow: hidden;
		background: var(--paper-2);
	}

	.onboarding,
	.error {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		max-width: min(46ch, calc(100% - 2rem));
		padding: 0.5rem 0.8rem;
		border-radius: var(--r);
		font-size: var(--fs-sm);
		box-shadow: var(--shadow);
		z-index: 2;
	}
	.onboarding {
		top: 0.8rem;
		background: color-mix(in srgb, var(--surface) 94%, transparent);
		border: 1px solid var(--edge);
		color: var(--ink-2);
		backdrop-filter: blur(6px);
	}
	.onboarding b {
		color: var(--ink);
	}
	.error {
		bottom: 0.8rem;
		background: var(--bad-bg);
		border: 1px solid var(--bad);
		color: var(--bad);
		font-weight: 500;
	}

	/* --- rechte Schiene --- */
	.rail {
		border-left: 1px solid var(--edge-soft);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-height: 0;
	}
	.rail-sec {
		padding: 0.75rem 0.8rem;
		border-bottom: 1px solid var(--edge-soft);
		min-height: 0;
	}
	.rail-sec:last-child {
		border-bottom: 0;
	}
	.rail-sec.grow {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.rail h2 {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin: 0 0 0.55rem;
	}

	.hint-text {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}

	.link {
		margin-left: auto;
		border: 0;
		background: none;
		padding: 0;
		font-size: var(--fs-xs);
		font-weight: 500;
		text-transform: none;
		letter-spacing: 0;
		color: var(--ink-3);
		text-decoration: underline;
		cursor: pointer;
	}
	.link:hover {
		color: var(--ink);
	}

	/* Kennzahlen: zwei Spalten, immer sichtbar */
	.metrics {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.1rem 0.8rem;
		margin: 0;
	}
	.metrics dt {
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}
	.metrics dd {
		margin: 0;
		font-size: var(--fs-lg);
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.metrics .u {
		font-size: var(--fs-sm);
		font-weight: 500;
		color: var(--ink-2);
		margin-left: 0.1em;
	}
	.formula {
		margin: 0.5rem 0 0;
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}
	.formula code {
		font-family: var(--mono);
		background: var(--surface-2);
		padding: 0.05rem 0.3rem;
		border-radius: 2px;
	}

	/* Wegpunkte */
	.wps {
		list-style: none;
		margin: 0 0 0.5rem;
		padding: 0;
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}
	.wp {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.34rem 0.3rem;
		border-radius: 2px;
		border: 1px solid transparent;
		font-size: var(--fs-sm);
		cursor: grab;
	}
	.wp:hover {
		background: var(--surface-2);
	}
	.wp.over {
		border-color: var(--route-bike);
	}
	.grip {
		color: var(--ink-3);
		font-size: 12px;
		line-height: 1;
		flex: none;
	}
	.idx {
		width: 17px;
		height: 17px;
		flex: none;
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-size: 10px;
		font-weight: 700;
		color: #fff;
		background: var(--route);
	}
	.nm {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--mono);
		font-size: var(--fs-xs);
		color: var(--ink-2);
	}
	.del {
		flex: none;
		border: 0;
		background: none;
		padding: 0 0.2rem;
		font-size: 15px;
		line-height: 1;
		color: var(--ink-3);
		cursor: pointer;
		opacity: 0;
	}
	.wp:hover .del,
	.del:focus-visible {
		opacity: 1;
	}
	.del:hover {
		color: var(--bad);
	}

	button.wide {
		width: 100%;
		padding: 0.4rem;
		border: 1px solid var(--edge);
		border-radius: var(--r);
		background: var(--surface-2);
		font-size: var(--fs-sm);
		font-weight: 500;
		cursor: pointer;
	}
	button.wide:hover {
		border-color: var(--ink-3);
	}

	/* Auf schmalen Geräten ist das nicht die richtige Ansicht — die
	   Feldansicht kommt separat. Bis dahin: Schiene unter die Karte. */
	@media (max-width: 860px) {
		.app {
			grid-template-columns: 1fr;
			grid-template-rows: var(--topbar-h) 1fr auto auto;
		}
		.rail {
			border-left: 0;
			border-top: 1px solid var(--edge);
			max-height: 40vh;
		}
	}
</style>

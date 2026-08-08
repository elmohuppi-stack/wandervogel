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
	import { untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { beforeNavigate, goto, replaceState } from '$app/navigation';
	import { DEFAULT_ACTIVITY, activity } from '$lib/geo/activity';
	import MapCanvas from '$lib/map/MapCanvas.svelte';
	import { sampleElevations } from '$lib/geo/elevation';
	import { deriveStats } from '$lib/geo/stats';
	import { hasElevation, lineToWaypoints, thin } from '$lib/tour/uebernehmen';
	import { emptyTour, newId, type RouteResult, type Tour } from '$lib/tour/types';
	import Alert from '$lib/ui/Alert.svelte';
	import Button from '$lib/ui/Button.svelte';
	import ConfirmDialog from '$lib/ui/ConfirmDialog.svelte';
	import ElevationProfile from '$lib/ui/ElevationProfile.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import IconButton from '$lib/ui/IconButton.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import MetricGrid from '$lib/ui/MetricGrid.svelte';
	import MapTools from '$lib/ui/MapTools.svelte';
	import Panel from '$lib/ui/Panel.svelte';
	import PlaceSearch from '$lib/ui/PlaceSearch.svelte';
	import RouteImport, { type Vorschau } from './RouteImport.svelte';
	import PlannerTopbar from './PlannerTopbar.svelte';
	import StartCard from './StartCard.svelte';
	import WaypointList from './WaypointList.svelte';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// untrack: hier ist wirklich nur der Anfangswert gemeint. Den Abgleich
	// bei einem Wechsel der Adresse macht der Effekt weiter unten — die
	// Komponente hängt sich dabei nämlich *nicht* neu ein.
	let tour = $state<Tour>(untrack(() => data.tour ?? emptyTour(DEFAULT_ACTIVITY)));
	let route = $state<RouteResult | null>(untrack(() => data.tour?.route ?? null));
	let routing = $state(false);
	let routeError = $state<string | null>(null);
	let hoverAt = $state<number | null>(null);
	let profileCollapsed = $state(browser && localStorage.getItem('wv.profileCollapsed') === '1');
	let mapRef = $state<ReturnType<typeof MapCanvas> | undefined>();

	let saving = $state(false);
	let saveError = $state<string | null>(null);
	/** Wir gehen selbst zur Anmeldung — dann keine Rückfrage beim Verlassen. */
	let zurAnmeldung = $state(false);
	/** Rückfragen. Beide gehen über denselben Dialog. */
	let verlassenOffen = $state(false);
	let loeschenOffen = $state(false);
	/** Wohin es nach dem Bestätigen weitergeht, und der Riegel dafür. */
	let ziel: URL | null = null;
	let darfVerlassen = false;
	let loeschForm: HTMLFormElement | undefined = $state();
	let ortungsfehler = $state<string | null>(null);
	/**
	 * Markierte Routen einblenden. Aus als Vorgabe (Anforderungen 7:
	 * „Kartenlayer sparsam"), die Wahl überlebt aber den Neustart.
	 *
	 * Gelesen beim Einhängen, geschrieben im Umschalter — nicht über zwei
	 * Effekte, von denen einer liest und einer schreibt. Deren Korrektheit
	 * hängt an der Deklarationsreihenfolge, und genau davor warnt der
	 * Kommentar in theme.svelte.ts.
	 */
	let wegeOverlay = $state(browser && localStorage.getItem('wv.wegeOverlay') === '1');
	let importRef = $state<ReturnType<typeof RouteImport> | undefined>();
	let vorschau = $state<Vorschau | null>(null);
	let importBelegt = $state(false);

	/** Die Vorschaulinie für die Karte — ausgedünnt, sie ist nur zum Sehen. */
	const vorschauLinie = $derived(
		vorschau ? thin(vorschau.coordinates, 1500).map(([lon, lat]) => [lon, lat] as [number, number]) : null
	);

	// Neue Vorschau ins Bild holen.
	$effect(() => {
		if (vorschauLinie && vorschauLinie.length > 1) mapRef?.fitToLine(vorschauLinie, 80);
	});

	/**
	 * Vorschau zur Tour machen.
	 *
	 * Die Linie wird **genau** übernommen, nicht neu geroutet. Der erste
	 * Versuch setzte Wegpunkte und ließ BRouter rechnen; nachgemessen am
	 * Nibelungensteig fehlten dabei 16 % der Strecke, weil der Router
	 * Kurven abschneidet. Auch 60 Wegpunkte brachten nur −7 % — und eine
	 * unbenutzbare Liste.
	 *
	 * Fehlen die Höhen (OSM kennt keine), holen wir sie aus demselben
	 * Höhenmodell, aus dem die Karte ihr Relief zeichnet.
	 *
	 * Wegpunkte kommen trotzdem, wenige und gleichmäßig: damit sich ein
	 * Stück herausschneiden lässt, wie Anforderung 6.2 es verlangt. Wer
	 * einen davon zieht, löst bewusst eine Neuberechnung aus.
	 */
	let uebernimmt = $state(false);

	async function uebernehmen(v: Vorschau) {
		if (uebernimmt) return;
		uebernimmt = true;
		routeError = null;
		try {
			let coords = v.coordinates;

			if (!hasElevation(coords)) {
				const hoehen = await sampleElevations(coords.map(([lon, lat]) => [lon, lat]));
				coords = coords.map(([lon, lat], i) => [lon, lat, hoehen[i] ?? 0]);
			}

			tour.name = v.name.slice(0, 200);
			tour.waypoints = lineToWaypoints(coords, 12);
			route = { coordinates: coords, ...deriveStats(coords, tour.activityType) };
			// Sagt dem Neuberechnungs-Effekt: für diesen Stand gibt es schon
			// eine Route. Ohne das würde er sie sofort überschreiben.
			routeKey = geometryKey(tour);
			vorschau = null;
		} catch {
			routeError = 'Höhen konnten nicht ermittelt werden.';
		} finally {
			uebernimmt = false;
		}
	}

	function wegeUmschalten() {
		wegeOverlay = !wegeOverlay;
		localStorage.setItem('wv.wegeOverlay', wegeOverlay ? '1' : '0');
	}
	/** Fingerabdruck des zuletzt gespeicherten Standes. */
	let savedSignature = $state(untrack(() => signature(data.tour ?? emptyTour(DEFAULT_ACTIVITY))));

	const def = $derived(activity(tour.activityType));
	const metrics = $derived(route ? def.metrics(route) : null);
	const dirty = $derived(signature(tour) !== savedSignature);

	function signature(t: Tour): string {
		return JSON.stringify({
			name: t.name,
			activityType: t.activityType,
			date: t.date ?? null,
			note: t.note ?? null,
			waypoints: t.waypoints
		});
	}

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

	/**
	 * Wofür die aktuelle Route gilt.
	 *
	 * Vorbelegt aus der geladenen Tour — und das ist der Grund, warum es
	 * diesen Schlüssel gibt: ohne ihn feuert der Effekt beim Einhängen und
	 * berechnet eine Route neu, die gerade aus der Datenbank kam. Ist
	 * BRouter dabei aus oder fehlt das Segment, ersetzt er die geladene
	 * Route durch null. Die gespeicherte Tour sähe leer aus, obwohl sie es
	 * nicht ist.
	 */
	let routeKey = $state(untrack(() => (data.tour ? geometryKey(data.tour) : '')));

	function geometryKey(t: Tour): string {
		return JSON.stringify([t.activityType, t.waypoints.map((w) => [w.lon, w.lat])]);
	}

	/**
	 * Zustand nachziehen, wenn eine andere Tour geladen wird.
	 *
	 * `/planen/x → /planen/y` benutzt dieselbe Komponente weiter, die
	 * lokalen Zustände blieben sonst auf der alten Tour stehen. Nicht mit
	 * {#key}: das hängt MapLibre neu ein und verliert den Kartenausschnitt.
	 */
	let geladeneId = $state(untrack(() => data.tour?.id ?? null));

	$effect(() => {
		const id = data.tour?.id ?? null;
		if (id === geladeneId) return;
		geladeneId = id;
		tour = data.tour ?? emptyTour(DEFAULT_ACTIVITY);
		route = data.tour?.route ?? null;
		routeKey = data.tour ? geometryKey(data.tour) : '';
		savedSignature = signature(tour);
		routeError = null;
		saveError = null;
		// Beim Wechsel auf eine andere Tour den Ausschnitt mitnehmen.
		aufTourZentrieren();
	});

	/**
	 * Ausschnitt auf eine geladene Tour setzen.
	 *
	 * Nur beim Öffnen und beim Wechsel der Tour — nicht bei jeder
	 * Routenänderung. Wer gerade einen Wegpunkt zieht, will nicht, dass die
	 * Karte unter der Hand springt.
	 */
	function aufTourZentrieren() {
		if (route) mapRef?.fitToRoute();
	}

	$effect(() => {
		// Abhängigkeiten bewusst lesen, damit der Effekt erneut läuft.
		const points = tour.waypoints.map((w) => ({ id: w.id, lon: w.lon, lat: w.lat }));
		const activityType = tour.activityType;
		const key = geometryKey(tour);

		clearTimeout(recalcTimer);

		if (key === routeKey) return; // Nichts Geometrisches hat sich geändert.

		if (points.length < 2) {
			route = null;
			routeError = null;
			routeKey = key;
			return;
		}

		// Kurz warten: beim Ziehen eines Wegpunkts würde sonst jede
		// Mausbewegung eine Berechnung auslösen.
		recalcTimer = setTimeout(() => {
			void recalculate(points, activityType, key);
		}, 250);

		return () => clearTimeout(recalcTimer);
	});

	async function recalculate(
		waypoints: { id: string; lon: number; lat: number }[],
		activityType: Tour['activityType'],
		key: string
	) {
		routing = true;
		routeError = null;
		try {
			const res = await fetch('/api/route', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ activityType, waypoints })
			});
			const antwort = await res.json();

			if (!res.ok) {
				routeError = antwort.error ?? 'Routenberechnung fehlgeschlagen';
				route = null;
			} else {
				route = antwort.route;
			}
			routeKey = key;
		} catch {
			routeError = 'Server nicht erreichbar';
			route = null;
		} finally {
			routing = false;
		}
	}

	/* --- Speichern -------------------------------------------------------- */

	async function save() {
		if (saving || !route) return;

		/*
		 * Gäste dürfen planen, aber nicht behalten.
		 *
		 * Statt einer Fehlermeldung führt der Weg zur Anmeldung — und die
		 * Arbeit überlebt: der Entwurf liegt in localStorage, wird hier
		 * ausdrücklich noch einmal geschrieben und nach der Rückkehr wieder
		 * eingelesen. Ohne dieses eine `saveDraft()` verlöre genau der
		 * Klick die Tour, der sie retten sollte.
		 */
		if (!data.user) {
			saveDraft();
			zurAnmeldung = true;
			goto(`/anmelden?weiter=${encodeURIComponent('/planen')}`);
			return;
		}

		saving = true;
		saveError = null;
		try {
			const neu = !tour.id;
			const res = await fetch(neu ? '/api/tours' : `/api/tours/${tour.id}`, {
				method: neu ? 'POST' : 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ...tour, route })
			});
			/*
			 * Sitzung unterwegs abgelaufen — derselbe Weg wie beim Gast.
			 *
			 * Eine Sitzung kann enden, während die Seite offen steht: sie läuft
			 * ab, ein Admin deaktiviert das Konto, oder man meldet sich in
			 * einem zweiten Tab ab. Die Seite weiß davon nichts, denn ihr
			 * `data.user` stammt vom letzten Laden. Ohne diesen Zweig endete
			 * der Klick in „Nicht angemeldet" — einer Meldung, die stimmt und
			 * trotzdem nicht weiterhilft, weil sie die Tour im Ungewissen
			 * lässt. Jetzt wird der Entwurf gesichert und der Weg führt zur
			 * Anmeldung, von der aus man zurückkommt.
			 */
			if (res.status === 401) {
				saveDraft();
				zurAnmeldung = true;
				await goto(`/anmelden?weiter=${encodeURIComponent('/planen')}`);
				return;
			}

			const antwort = await res.json();
			if (!res.ok) {
				saveError = antwort.error ?? 'Speichern fehlgeschlagen';
				return;
			}
			if (neu) {
				tour.id = antwort.id;
				// Flache Adressänderung: replaceState aus $app/navigation lässt
				// load *nicht* erneut laufen und hängt MapLibre nicht neu ein.
				// Mit goto() flackerte die Karte bei jedem ersten Speichern.
				replaceState(`/planen/${antwort.id}`, {});
			}
			savedSignature = signature(tour);
			clearDraft();
		} catch {
			saveError = 'Server nicht erreichbar';
		} finally {
			saving = false;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			void save();
		}
	}

	// Ungespeichertes nicht stillschweigend verlieren.
	//
	// Der Gang zur Anmeldung ist davon ausgenommen: dort wird die Tour ja
	// gerade gerettet, und eine Rückfrage „trotzdem verlassen?" wäre nicht
	// nur überflüssig, sondern irreführend — sie klänge nach Datenverlust,
	// wo der Entwurf eine Zeile zuvor geschrieben wurde.
	beforeNavigate((nav) => {
		if (!dirty || zurAnmeldung || darfVerlassen) return;

		/*
		 * Beim Schließen des Tabs oder Neuladen kann nur der Browser fragen —
		 * eine eigene Oberfläche bekommt dort keine Gelegenheit mehr. `cancel()`
		 * löst dessen Standardabfrage aus; alles andere übernimmt der Dialog.
		 */
		nav.cancel();
		if (nav.type === 'leave') return;

		ziel = nav.to?.url ?? null;
		verlassenOffen = true;
	});

	function verlassenBestaetigt() {
		// Kein $state: der Riegel muss schon gelten, wenn goto() den Hook
		// im selben Zug erneut auslöst.
		darfVerlassen = true;
		if (ziel) void goto(ziel);
	}

	/* --- Lokaler Entwurf --------------------------------------------------
	   Gespeichert wird ausdrücklich; ein Absturz oder ein Neuladen darf
	   trotzdem nichts kosten. Nur für *neue* Touren — eine gespeicherte hat
	   ihren Stand schon auf dem Server.

	   Ohne Geometrie: die ist in 250 ms nachgerechnet und würde das
	   5-MB-Kontingent nach wenigen Touren sprengen.

	   Das ist Absturzsicherheit, kein Offline-Betrieb — den kennen die
	   Anforderungen seit dem 7. August 2026 nicht mehr (§11). Der Entwurf
	   ist dort ausdrücklich als Ausnahme benannt und bleibt. */

	const DRAFT_KEY = 'wv.draft';
	let draftTimer: ReturnType<typeof setTimeout> | undefined;

	function clearDraft() {
		localStorage.removeItem(DRAFT_KEY);
	}

	/** Sofort schreiben, ohne die halbe Sekunde Verzögerung des Effekts. */
	function saveDraft() {
		if (!browser || tour.id) return;
		if (tour.waypoints.length > 0) localStorage.setItem(DRAFT_KEY, signature(tour));
		else clearDraft();
	}

	// Verzögert, damit nicht jedes Ziehen eines Wegpunkts schreibt. Beim
	// Gang zur Anmeldung reicht das nicht — dort ruft save() saveDraft()
	// unmittelbar auf, sonst wäre die Tour nach 500 ms Fahrtwind weg.
	$effect(() => {
		if (tour.id) return;
		const stand = signature(tour);
		clearTimeout(draftTimer);
		draftTimer = setTimeout(() => {
			if (tour.waypoints.length > 0) localStorage.setItem(DRAFT_KEY, stand);
			else clearDraft();
		}, 500);
		return () => clearTimeout(draftTimer);
	});

	$effect(() => {
		if (untrack(() => tour.id)) return;
		const roh = localStorage.getItem(DRAFT_KEY);
		if (!roh) return;
		try {
			const d = JSON.parse(roh);
			if (!Array.isArray(d.waypoints) || d.waypoints.length === 0) return;
			tour.name = d.name ?? tour.name;
			tour.activityType = d.activityType ?? tour.activityType;
			tour.date = d.date ?? undefined;
			tour.note = d.note ?? undefined;
			tour.waypoints = d.waypoints;
		} catch {
			// Kaputter Entwurf ist kein Grund, die Seite nicht zu zeigen.
			clearDraft();
		}
	});

	/* --- Einklappzustand des Profils merken ------------------------------
	   Geschrieben, wenn er sich ändert; gelesen beim Einhängen. Vorher
	   waren es zwei Effekte, deren Zusammenspiel an ihrer Reihenfolge hing. */

	let letzterProfilstand = untrack(() => profileCollapsed);
	$effect(() => {
		if (profileCollapsed === letzterProfilstand) return;
		letzterProfilstand = profileCollapsed;
		localStorage.setItem('wv.profileCollapsed', profileCollapsed ? '1' : '0');
	});


</script>

<svelte:head>
	<title>{tour.name} — Wandervogel</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<div class="app" style="--route: var({def.colorVar})">
	<PlannerTopbar
		bind:name={tour.name}
		bind:activityType={tour.activityType}
		{routing}
		{saving}
		{dirty}
		saved={!!tour.id}
		canSave={!!route}
		angemeldet={!!data.user}
		onSave={save}
	/>

	<!-- Karte: die Hauptsache. -->
	<main class="map-area">
		<MapCanvas
			bind:this={mapRef}
			activityType={tour.activityType}
			waypoints={tour.waypoints}
			{route}
			markerAt={hoverAt}
			showRouteOverlay={wegeOverlay}
			startAtPosition={!data.tour}
			onReady={aufTourZentrieren}
			previewLine={vorschauLinie}
			onAddWaypoint={addWaypoint}
			onMoveWaypoint={moveWaypoint}
			onRemoveWaypoint={removeWaypoint}
		/>

		<!-- Werkzeuge der Karte liegen auf der Karte, nicht in der Kopfzeile:
		     sie gehören zu dem, worauf sie wirken. -->
		<div class="werkzeuge-links">
			<PlaceSearch onSelect={(o) => mapRef?.flyToPlace(o.lon, o.lat, o.bbox)} />
		</div>

		<MapTools>
			<IconButton
				icon="layers"
				label="{def.routeLayerLabel} {wegeOverlay ? 'ausblenden' : 'einblenden'}"
				pressed={wegeOverlay}
				onclick={wegeUmschalten}
			/>
			<IconButton
				icon="location-fix"
				label="Auf meinen Standort"
				onclick={async () => {
					await mapRef?.locate();
					ortungsfehler = mapRef?.locateState().error ?? null;
				}}
			/>
		</MapTools>

		{#if wegeOverlay}
			<!-- Sagen, was man sieht. Ein farbiges Netz ohne Erklärung ist
			     genau das Beiwerk, das die Anforderungen ablehnen. -->
			<div class="legende">
				<Icon name="layers" size={12} />
				{def.routeLayerLabel} — markierte Routen aus OpenStreetMap
			</div>
		{/if}

		{#if routeError || saveError || ortungsfehler}
			<div class="fehler">
				<Alert
					tone="bad"
					onDismiss={() => {
						saveError = null;
						ortungsfehler = null;
					}}
				>
					{routeError ?? saveError ?? ortungsfehler}
				</Alert>
			</div>
		{/if}
	</main>

	<!-- Rechte Schiene: Kennzahlen und Wegpunkte, immer sichtbar.
	     Auch alles, was sonst über der Karte schweben würde — die Karte
	     ist die Hauptsache und darf nichts verdecken. -->
	<aside class="rail">
		<RouteImport
			bind:this={importRef}
			activityType={tour.activityType}
			bind:vorschau
			laeuftUebernahme={uebernimmt}
			bounds={() => mapRef?.bounds() ?? null}
			bind:belegt={importBelegt}
			onAdopt={uebernehmen}
		/>

		{#if tour.waypoints.length === 0 && !importBelegt}
			<StartCard
				{def}
				onImportGpx={() => importRef?.gpxWaehlen()}
				onSearchRoute={() => importRef?.routeSuchen()}
			/>
		{/if}

		<!-- Datum und Notiz sind Angaben zur Tour, keine Kennzahlen. Die
		     Regel „nie erst aufklappen" gilt den Zahlen; trotzdem bekommt
		     auch das hier kein Akkordeon. -->
		<Panel title="Tour" icon="route">
			<div class="meta">
				<label>
					<span class="feldname">Datum</span>
					<input type="date" bind:value={() => tour.date ?? '', (v) => (tour.date = v || undefined)} />
				</label>
				<label>
					<span class="feldname">Notiz</span>
					<textarea
						rows="2"
						bind:value={() => tour.note ?? '', (v) => (tour.note = v || undefined)}
						placeholder="Anfahrt, Einkehr, Besonderheiten …"
					></textarea>
				</label>
			</div>
		</Panel>

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

		{#if route || tour.id}
			<Panel>
				<div class="aktionen">
				{#if route}
					<Button variant="quiet" wide icon="crosshair" onclick={() => mapRef?.fitToRoute()}>
						Auf Tour zentrieren
					</Button>
				{/if}
				{#if tour.id}
					<Button
						variant="quiet"
						wide
						icon="route"
						href="/api/tours/{tour.id}/gpx"
						download
					>
						Als GPX exportieren
					</Button>

					<!-- Löschen läuft über eine Formularaktion der Startseite:
					     eine zerstörende Handlung, ein Weg. -->
					<form method="post" action="/?/delete" class="loeschen" bind:this={loeschForm}>
						<input type="hidden" name="id" value={tour.id} />
						<Button
							variant="danger"
							size="sm"
							icon="trash"
							type="button"
							onclick={() => (loeschenOffen = true)}
						>
							Tour löschen
						</Button>
					</form>
				{/if}
				</div>
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

<!-- Beide Rückfragen, ein Baustein. Vorher waren es zwei confirm(), die die
     Adresse der Seite als Überschrift trugen und auf jedem Betriebssystem
     anders aussahen. -->
<ConfirmDialog
	bind:open={verlassenOffen}
	title="Ungespeicherte Änderungen"
	icon="alert"
	confirmLabel="Verlassen"
	confirmIcon="chevron-left"
	cancelLabel="Hierbleiben"
	onConfirm={verlassenBestaetigt}
>
	An dieser Tour sind Änderungen, die noch nicht gespeichert sind. Beim Verlassen gehen sie
	verloren.
</ConfirmDialog>

<ConfirmDialog
	bind:open={loeschenOffen}
	title="Tour löschen"
	icon="trash"
	tone="danger"
	confirmLabel="Endgültig löschen"
	confirmIcon="trash"
	onConfirm={() => loeschForm?.submit()}
>
	„{tour.name}" wird endgültig entfernt. Das lässt sich nicht rückgängig machen — ein
	GPX-Export vorher wäre die einzige Sicherung.
</ConfirmDialog>

<style>
	.app {
		display: grid;
		grid-template-columns: 1fr var(--rail-w);
		grid-template-rows: var(--topbar-h) 1fr auto;
		height: 100%;
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
		/* Die Schiene trägt jetzt auch die Suche und die Vorschau. Bei
		   kleinem Fenster wird das zu viel — dann scrollt sie als Ganzes. */
		overflow-y: auto;
	}

	.werkzeuge-links {
		position: absolute;
		top: var(--sp-5);
		left: var(--sp-5);
		z-index: var(--z-map-ui);
		width: min(22rem, calc(100% - 2 * var(--sp-5) - var(--hit-sm) - var(--sp-4)));
	}

	.legende {
		position: absolute;
		bottom: var(--sp-5);
		left: var(--sp-5);
		z-index: var(--z-map-ui);
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: var(--sp-3) var(--sp-4);
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		border: 1px solid var(--edge);
		border-radius: var(--r-sm);
		box-shadow: var(--el-1);
		font-size: var(--fs-xs);
		color: var(--ink-2);
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

	.meta {
		display: grid;
		gap: var(--sp-4);
	}
	.meta label {
		display: grid;
		gap: var(--sp-2);
	}
	.feldname {
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}
	.meta input,
	.meta textarea {
		width: 100%;
		padding: var(--sp-3) var(--sp-4);
		border: 1px solid var(--edge);
		border-radius: var(--r-sm);
		background: var(--paper-2);
		color: var(--ink);
		font: inherit;
		font-size: var(--fs-sm);
		resize: vertical;
	}

	.aktionen {
		display: grid;
		gap: var(--sp-4);
	}

	.loeschen {
		display: flex;
		justify-content: center;
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

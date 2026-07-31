<script lang="ts">
	/**
	 * Die Karte. Besitzt die MapLibre-Instanz und reicht Interaktionen als
	 * Callbacks nach oben — der Zustand (Wegpunkte, Route) liegt beim Aufrufer.
	 *
	 * MapLibre ist imperativ und zustandsbehaftet. Genau deshalb wird es hier
	 * direkt angesprochen und nicht in eine deklarative Hülle gepackt: wir
	 * halten das Kartenobjekt und mutieren es, statt es bei jeder Änderung
	 * neu beschreiben zu lassen.
	 *
	 * Hinweis zu den Importen: MapLibre 6 hat keinen Default-Export mehr,
	 * alles kommt benannt herein.
	 */
	import { onMount } from 'svelte';
	import {
		Map as MlMap,
		NavigationControl,
		ScaleControl,
		addProtocol,
		type GeoJSONSource
	} from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import mlcontour from 'maplibre-contour';
	import type { Feature, FeatureCollection, Point } from 'geojson';
	import { CONTOUR_THRESHOLDS, config } from '$lib/config';
	import { activity, type ActivityType } from '$lib/geo/activity';
	import type { RouteResult, Waypoint } from '$lib/tour/types';

	interface Props {
		activityType: ActivityType;
		waypoints: Waypoint[];
		route: RouteResult | null;
		/** Position auf der Route, die hervorgehoben wird (0–1) — vom Höhenprofil. */
		markerAt?: number | null;
		onAddWaypoint?: (lon: number, lat: number) => void;
		onMoveWaypoint?: (id: string, lon: number, lat: number) => void;
		onRemoveWaypoint?: (id: string) => void;
	}

	let {
		activityType,
		waypoints,
		route,
		markerAt = null,
		onAddWaypoint,
		onMoveWaypoint,
		onRemoveWaypoint
	}: Props = $props();

	let container: HTMLDivElement;
	let map: MlMap | undefined;
	let ready = $state(false);

	const SRC_ROUTE = 'wv-route';
	const SRC_WP = 'wv-waypoints';
	const SRC_MARKER = 'wv-marker';
	const LYR_ROUTE = 'wv-route-line';
	const LYR_WP = 'wv-waypoints-circle';

	/** Farbwerte kommen aus den Design-Tokens, damit Karte und Oberfläche
	 *  nie auseinanderlaufen und der Dunkelmodus mitgenommen wird. */
	function token(name: string, fallback = '#000'): string {
		if (typeof window === 'undefined') return fallback;
		const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
		return v || fallback;
	}

	function routeColor(): string {
		return token(activity(activityType).colorVar, '#b3382a');
	}

	/* ------------------------------------------------------------------
	   GeoJSON aus dem Zustand
	   ------------------------------------------------------------------ */

	const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

	function routeFeature(): FeatureCollection {
		if (!route || route.coordinates.length < 2) return EMPTY;
		return {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					properties: {},
					geometry: {
						type: 'LineString',
						// Höhe wird nicht mitgegeben — MapLibre braucht sie nicht
						// und dritte Koordinaten irritieren manche Ausdrücke.
						coordinates: route.coordinates.map(([lon, lat]) => [lon, lat])
					}
				}
			]
		};
	}

	function waypointFeatures(): FeatureCollection<Point> {
		return {
			type: 'FeatureCollection',
			features: waypoints.map((w, i) => ({
				type: 'Feature',
				properties: { id: w.id, index: i + 1, name: w.name ?? '' },
				geometry: { type: 'Point', coordinates: [w.lon, w.lat] }
			}))
		};
	}

	function markerFeature(): FeatureCollection {
		if (markerAt == null || !route || route.coordinates.length < 2) return EMPTY;
		const last = route.coordinates.length - 1;
		const i = Math.max(0, Math.min(Math.round(markerAt * last), last));
		const [lon, lat] = route.coordinates[i];
		return {
			type: 'FeatureCollection',
			features: [
				{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lon, lat] } }
			]
		};
	}

	function setData(id: string, data: FeatureCollection) {
		const src = map?.getSource(id) as GeoJSONSource | undefined;
		src?.setData(data);
	}

	/* ------------------------------------------------------------------
	   Aufbau
	   ------------------------------------------------------------------ */

	onMount(() => {
		// Höhendaten laufen über den eigenen Server. Ein gemeinsamer DemSource
		// versorgt Schummerung *und* Höhenlinien, damit jede Kachel nur
		// einmal geholt und dekodiert wird.
		const dem = new mlcontour.DemSource({
			// Bewusst zusammengesetzt statt über `new URL()`: das würde die
			// Platzhalter zu %7Bz%7D prozentkodieren, und maplibre-contour
			// könnte sie nicht mehr durch Kachelkoordinaten ersetzen.
			url: window.location.origin + config.demTileUrl,
			encoding: config.demEncoding,
			maxzoom: config.demMaxZoom,
			worker: true
		});
		dem.setupMaplibre({ addProtocol });

		const m = new MlMap({
			container,
			style: config.basemapStyleUrl,
			center: config.initialView.center,
			zoom: config.initialView.zoom,
			attributionControl: { compact: true },
			// Klare Karte schlägt schnelle Karte: Beschriftungen dürfen nicht
			// über Höhenlinien flackern.
			fadeDuration: 0
		});
		map = m;

		m.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
		m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');

		m.on('load', () => {
			const styleLayers = m.getStyle().layers ?? [];

			// Relief und Höhenlinien gehören *unter* die Beschriftungen.
			const firstSymbol = styleLayers.find((l) => l.type === 'symbol')?.id;

			/**
			 * Schriftstapel aus der Basiskarte übernehmen.
			 *
			 * Ohne Angabe nimmt MapLibre `Open Sans Regular, Arial Unicode MS
			 * Regular` an — den bietet OpenFreeMap nicht, das ergibt bei jedem
			 * Laden eine 404-Anfrage. Aus dem Style gelesen funktioniert es mit
			 * jeder Basiskarte, auch nach dem Wechsel auf eigene PMTiles.
			 */
			const textFont =
				styleLayers
					.filter((l) => l.type === 'symbol')
					.map((l) => (l.layout as { 'text-font'?: string[] } | undefined)?.['text-font'])
					.find((f): f is string[] => Array.isArray(f) && f.length > 0) ?? undefined;

			m.addSource('wv-dem', {
				type: 'raster-dem',
				// `tiles`, nicht `url`: `url` erwartet ein TileJSON-Dokument und
				// würde `dem-shared://{z}/{x}/{y}` wörtlich anfordern, ohne die
				// Platzhalter zu ersetzen. Das Relief bliebe still aus.
				tiles: [dem.sharedDemProtocolUrl],
				tileSize: 256,
				maxzoom: config.demMaxZoom
			});

			m.addLayer(
				{
					id: 'wv-hillshade',
					type: 'hillshade',
					source: 'wv-dem',
					paint: {
						// Zurückhaltend: das Relief soll die Karte stützen, nicht
						// dominieren. Kräftigere Werte lassen bei überzoomten
						// Höhendaten harte dunkle Flecken entstehen, unter denen
						// Wege und Beschriftungen verschwinden.
						'hillshade-exaggeration': 0.16,
						'hillshade-shadow-color': '#6b6152',
						'hillshade-highlight-color': '#fffdf8',
						'hillshade-accent-color': '#8c8272'
					}
				},
				firstSymbol
			);

			m.addSource('wv-contours', {
				type: 'vector',
				tiles: [
					dem.contourProtocolUrl({
						thresholds: CONTOUR_THRESHOLDS,
						elevationKey: 'ele',
						levelKey: 'level',
						contourLayer: 'contours',
						// 512er-Kacheln nachnutzen statt neun Kacheln zu holen.
						overzoom: 1
					})
				],
				maxzoom: 15
			});

			m.addLayer(
				{
					id: 'wv-contour-lines',
					type: 'line',
					source: 'wv-contours',
					'source-layer': 'contours',
					paint: {
						'line-color': token('--contour', '#a08a6b'),
						// Jede fünfte Linie betont — so lesen sich Wanderkarten.
						'line-width': ['match', ['get', 'level'], 1, 1.1, 0.6],
						'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 11.5, 0.55]
					}
				},
				firstSymbol
			);

			m.addLayer(
				{
					id: 'wv-contour-labels',
					type: 'symbol',
					source: 'wv-contours',
					'source-layer': 'contours',
					filter: ['>', ['get', 'level'], 0],
					layout: {
						'symbol-placement': 'line',
						'text-field': ['concat', ['to-string', ['get', 'ele']], ' m'],
						'text-size': 10,
						'text-max-angle': 25,
						...(textFont ? { 'text-font': textFont } : {})
					},
					paint: {
						'text-color': token('--contour-index', '#8a7250'),
						'text-halo-color': token('--paper-2', '#f4f6f1'),
						'text-halo-width': 1.4
					}
				},
				firstSymbol
			);

			/* --- eigene Ebenen: Route, Wegpunkte, Profilmarker --- */

			m.addSource(SRC_ROUTE, { type: 'geojson', data: routeFeature() });
			m.addSource(SRC_WP, { type: 'geojson', data: waypointFeatures() });
			m.addSource(SRC_MARKER, { type: 'geojson', data: markerFeature() });

			// Weiße Fassung darunter — hält die Route auf jedem Untergrund lesbar.
			m.addLayer({
				id: 'wv-route-casing',
				type: 'line',
				source: SRC_ROUTE,
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.75 }
			});

			m.addLayer({
				id: LYR_ROUTE,
				type: 'line',
				source: SRC_ROUTE,
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: { 'line-color': routeColor(), 'line-width': 4 }
			});

			m.addLayer({
				id: 'wv-marker-dot',
				type: 'circle',
				source: SRC_MARKER,
				paint: {
					'circle-radius': 6,
					'circle-color': token('--ink', '#171b17'),
					'circle-stroke-color': token('--surface', '#ffffff'),
					'circle-stroke-width': 2.5
				}
			});

			m.addLayer({
				id: LYR_WP,
				type: 'circle',
				source: SRC_WP,
				paint: {
					'circle-radius': 9,
					'circle-color': routeColor(),
					'circle-stroke-color': '#ffffff',
					'circle-stroke-width': 2
				}
			});

			m.addLayer({
				id: 'wv-waypoints-label',
				type: 'symbol',
				source: SRC_WP,
				layout: {
					'text-field': ['to-string', ['get', 'index']],
					'text-size': 11,
					'text-allow-overlap': true,
					'text-ignore-placement': true,
					...(textFont ? { 'text-font': textFont } : {})
				},
				paint: { 'text-color': '#ffffff' }
			});

			wireInteractions(m);
			ready = true;
		});

		return () => {
			m.remove();
			map = undefined;
		};
	});

	/* ------------------------------------------------------------------
	   Interaktion — ohne Menüs, das war die Anforderung
	   ------------------------------------------------------------------ */

	function wireInteractions(m: MlMap) {
		let dragId: string | null = null;

		// Klick auf freie Karte hängt einen Wegpunkt an.
		m.on('click', (e) => {
			if (dragId) return;
			const hits = m.queryRenderedFeatures(e.point, { layers: [LYR_WP] });
			if (hits.length > 0) return; // Klick galt einem Wegpunkt
			onAddWaypoint?.(e.lngLat.lng, e.lngLat.lat);
		});

		// Rechtsklick auf einen Wegpunkt löscht ihn.
		m.on('contextmenu', (e) => {
			const hits = m.queryRenderedFeatures(e.point, { layers: [LYR_WP] });
			const id = hits[0]?.properties?.id;
			if (typeof id === 'string') {
				e.preventDefault();
				onRemoveWaypoint?.(id);
			}
		});

		m.on('mouseenter', LYR_WP, () => {
			m.getCanvas().style.cursor = 'grab';
		});
		m.on('mouseleave', LYR_WP, () => {
			if (!dragId) m.getCanvas().style.cursor = '';
		});

		// Ziehen: Karte kurz stillstellen, Punkt folgt dem Zeiger.
		m.on('mousedown', LYR_WP, (e) => {
			const id = e.features?.[0]?.properties?.id;
			if (typeof id !== 'string') return;
			e.preventDefault();
			dragId = id;
			m.dragPan.disable();
			m.getCanvas().style.cursor = 'grabbing';
		});

		m.on('mousemove', (e) => {
			if (!dragId) return;
			// Nur die Anzeige mitziehen; der Zustand wird beim Loslassen gesetzt,
			// sonst würde bei jeder Mausbewegung eine Route berechnet.
			const data = waypointFeatures();
			const f = data.features.find((x: Feature<Point>) => x.properties?.id === dragId);
			if (f) {
				f.geometry.coordinates = [e.lngLat.lng, e.lngLat.lat];
				setData(SRC_WP, data);
			}
		});

		m.on('mouseup', (e) => {
			if (!dragId) return;
			const id = dragId;
			dragId = null;
			m.dragPan.enable();
			m.getCanvas().style.cursor = '';
			onMoveWaypoint?.(id, e.lngLat.lng, e.lngLat.lat);
		});
	}

	/* ------------------------------------------------------------------
	   Auf Zustandsänderungen reagieren
	   ------------------------------------------------------------------ */

	$effect(() => {
		if (!ready) return;
		void route;
		setData(SRC_ROUTE, routeFeature());
	});

	$effect(() => {
		if (!ready) return;
		void waypoints;
		setData(SRC_WP, waypointFeatures());
	});

	$effect(() => {
		if (!ready) return;
		void markerAt;
		setData(SRC_MARKER, markerFeature());
	});

	// Aktivitätsart wechselt die Routenfarbe — Topo-Konvention.
	$effect(() => {
		if (!ready || !map) return;
		const c = routeColor();
		map.setPaintProperty(LYR_ROUTE, 'line-color', c);
		map.setPaintProperty(LYR_WP, 'circle-color', c);
	});

	/** Ausschnitt auf die Tour setzen. Von außen aufrufbar. */
	export function fitToRoute(padding = 60) {
		if (!map || !route || route.coordinates.length < 2) return;
		let minX = 180;
		let minY = 90;
		let maxX = -180;
		let maxY = -90;
		for (const [lon, lat] of route.coordinates) {
			if (lon < minX) minX = lon;
			if (lat < minY) minY = lat;
			if (lon > maxX) maxX = lon;
			if (lat > maxY) maxY = lat;
		}
		map.fitBounds(
			[
				[minX, minY],
				[maxX, maxY]
			],
			{ padding, duration: 400 }
		);
	}
</script>

<div class="map" bind:this={container} data-ready={ready}></div>

<style>
	.map {
		position: absolute;
		inset: 0;
		background: var(--paper-2);
	}

	/* MapLibres eigene Bedienelemente an die Tokens angleichen —
	   sie sollen zurücktreten, nicht mit der Karte konkurrieren. */
	.map :global(.maplibregl-ctrl-group) {
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		border: 1px solid var(--edge);
		border-radius: var(--r);
		box-shadow: none;
	}
	.map :global(.maplibregl-ctrl-group button + button) {
		border-top-color: var(--edge-soft);
	}
	.map :global(.maplibregl-ctrl-scale) {
		background: transparent;
		border-color: var(--ink-3);
		color: var(--ink-2);
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}
	.map :global(.maplibregl-ctrl-attrib) {
		background: color-mix(in srgb, var(--surface) 80%, transparent);
		font-size: 10px;
	}
</style>

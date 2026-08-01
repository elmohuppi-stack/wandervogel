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
	import { Map as MlMap, type GeoJSONSource } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import type { Feature, FeatureCollection, Point } from 'geojson';
	import { activity, type ActivityType } from '$lib/geo/activity';
	import { prefersReducedMotion, resolveColorToken, theme } from '$lib/ui/theme.svelte';
	import type { RouteResult, Waypoint } from '$lib/tour/types';
	import { addTerrainLayers, createMap } from './basemap';
	import { paintFor } from './theme-paint';

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
	const SRC_POS = 'wv-position';
	const LYR_ROUTE = 'wv-route-line';
	const LYR_WP = 'wv-waypoints-circle';

	/** Eigener Standort, sobald er einmal abgefragt wurde. */
	let position = $state<{ lon: number; lat: number; accuracyM: number } | null>(null);
	let locating = $state(false);
	let locateError = $state<string | null>(null);

	function routeColor(): string {
		return resolveColorToken(activity(activityType).mapColorVar, '#b3382a');
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

	/**
	 * Standort mit Genauigkeitskreis.
	 *
	 * Der Kreis ist ein echtes Vieleck in Metern, kein `circle-radius` in
	 * Pixeln: eine Pixelangabe bliebe beim Zoomen gleich groß und behauptete
	 * damit beim Herauszoomen eine Genauigkeit von Kilometern. Was die
	 * Ortung nicht weiß, darf die Karte nicht behaupten.
	 */
	function positionFeatures(): FeatureCollection {
		if (!position) return EMPTY;
		const { lon, lat, accuracyM } = position;

		const SEITEN = 64;
		const mProGradLat = 111320;
		const mProGradLon = mProGradLat * Math.cos((lat * Math.PI) / 180);
		const ring: [number, number][] = [];
		for (let i = 0; i <= SEITEN; i++) {
			const w = (i / SEITEN) * 2 * Math.PI;
			ring.push([
				lon + (Math.cos(w) * accuracyM) / mProGradLon,
				lat + (Math.sin(w) * accuracyM) / mProGradLat
			]);
		}

		return {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					properties: { kind: 'accuracy' },
					geometry: { type: 'Polygon', coordinates: [ring] }
				},
				{
					type: 'Feature',
					properties: { kind: 'dot' },
					geometry: { type: 'Point', coordinates: [lon, lat] }
				}
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
		const m = createMap(container);
		map = m;

		m.on('load', () => {
			// Relief und Höhenlinien kommen aus der geteilten Grundlage; sie
			// liefert zugleich den Schriftstapel und die Einhängestelle.
			const { firstSymbolId, textFont } = addTerrainLayers(m);
			void firstSymbolId;

			/* --- eigene Ebenen: Route, Wegpunkte, Profilmarker --- */

			m.addSource(SRC_ROUTE, { type: 'geojson', data: routeFeature() });
			m.addSource(SRC_WP, { type: 'geojson', data: waypointFeatures() });
			m.addSource(SRC_MARKER, { type: 'geojson', data: markerFeature() });

			// Fassung darunter — hält die Route auf jedem Untergrund lesbar.
			// Hell ist sie weiß, dunkel fast schwarz; deshalb ein Token.
			m.addLayer({
				id: 'wv-route-casing',
				type: 'line',
				source: SRC_ROUTE,
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: {
					'line-color': resolveColorToken('--route-casing', '#ffffff'),
					'line-width': 8,
					'line-opacity': 0.75
				}
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
					'circle-color': resolveColorToken('--ink', '#171b17'),
					'circle-stroke-color': resolveColorToken('--surface', '#ffffff'),
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
					'circle-stroke-color': resolveColorToken('--route-casing', '#ffffff'),
					'circle-stroke-width': 2
				}
			});

			/* --- eigener Standort, über allem --- */

			m.addSource(SRC_POS, { type: 'geojson', data: positionFeatures() });

			m.addLayer({
				id: 'wv-position-accuracy',
				type: 'fill',
				source: SRC_POS,
				filter: ['==', ['get', 'kind'], 'accuracy'],
				paint: {
					'fill-color': resolveColorToken('--position', '#2f6fd0'),
					'fill-opacity': 0.12
				}
			});

			m.addLayer({
				id: 'wv-position-ring',
				type: 'line',
				source: SRC_POS,
				filter: ['==', ['get', 'kind'], 'accuracy'],
				paint: {
					'line-color': resolveColorToken('--position', '#2f6fd0'),
					'line-width': 1,
					'line-opacity': 0.5
				}
			});

			m.addLayer({
				id: 'wv-position-dot',
				type: 'circle',
				source: SRC_POS,
				filter: ['==', ['get', 'kind'], 'dot'],
				paint: {
					'circle-radius': 6,
					'circle-color': resolveColorToken('--position', '#2f6fd0'),
					'circle-stroke-color': resolveColorToken('--route-casing', '#ffffff'),
					'circle-stroke-width': 2.5
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
				paint: { 'text-color': resolveColorToken('--map-on-route', '#ffffff') }
			});

			wireInteractions(m);
			ready = true;
		});

		return () => {
			for (const c of cleanups) c();
			cleanups.length = 0;
			m.remove();
			map = undefined;
		};
	});

	/* ------------------------------------------------------------------
	   Interaktion — ohne Menüs, das war die Anforderung
	   ------------------------------------------------------------------ */

	/** Aufräumarbeiten, die `m.remove()` nicht selbst erledigt. */
	const cleanups: (() => void)[] = [];

	function wireInteractions(m: MlMap) {
		let dragId: string | null = null;

		// Klick auf freie Karte hängt einen Wegpunkt an.
		m.on('click', (e) => {
			if (dragId) return;
			const hits = m.queryRenderedFeatures(e.point, { layers: [LYR_WP] });
			if (hits.length > 0) return; // Klick galt einem Wegpunkt
			onAddWaypoint?.(e.lngLat.lng, e.lngLat.lat);
		});

		/**
		 * Rechtsklick auf einen Wegpunkt löscht ihn.
		 *
		 * Bewusst am DOM-Ereignis und nicht an `m.on('contextmenu')`.
		 * MapLibres BlockableMapEventHandler setzt in `reset()` ein
		 * `_ignoreContextMenu = true`, das nur ein *linker* mousedown wieder
		 * aufhebt. Nach der ersten Interaktion mit der Karte verschluckt es
		 * deshalb jeden Rechtsklick — still, ohne Fehler. Nachgemessen: der
		 * Handler wurde kein einziges Mal aufgerufen.
		 */
		const canvasContainer = m.getCanvasContainer();
		const onContextMenu = (ev: MouseEvent) => {
			const rect = m.getCanvas().getBoundingClientRect();
			const point: [number, number] = [ev.clientX - rect.left, ev.clientY - rect.top];
			const hits = m.queryRenderedFeatures(point, { layers: [LYR_WP] });
			const id = hits[0]?.properties?.id;
			if (typeof id === 'string') {
				ev.preventDefault();
				onRemoveWaypoint?.(id);
			}
		};
		canvasContainer.addEventListener('contextmenu', onContextMenu);
		cleanups.push(() => canvasContainer.removeEventListener('contextmenu', onContextMenu));

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

	/**
	 * Farben neu setzen, wenn die Aktivitätsart oder das Thema wechselt.
	 *
	 * `theme.resolved` wird absichtlich gelesen, auch wenn der Wert hier
	 * nicht gebraucht wird: er ist die Abhängigkeit, die den Effekt beim
	 * Umschalten erneut auslöst. Das Attribut auf dem Wurzelelement steht
	 * zu diesem Zeitpunkt schon, deshalb liefern die Tokens die neuen Werte.
	 */
	$effect(() => {
		void theme.resolved;
		void activityType;
		if (!ready || !map) return;
		for (const [layer, prop, value] of paintFor(activityType)) {
			map.setPaintProperty(layer, prop, value);
		}
	});

	$effect(() => {
		if (!ready) return;
		void position;
		setData(SRC_POS, positionFeatures());
	});

	/* ------------------------------------------------------------------
	   Von außen aufrufbar
	   ------------------------------------------------------------------ */

	/**
	 * Eigenen Standort bestimmen und anfahren.
	 *
	 * Einmalig, nicht als Dauerbeobachtung: beim Planen am Laptop will man
	 * wissen, wo man ist, nicht verfolgt werden. Die Feldansicht bekommt
	 * später ein watchPosition.
	 */
	export async function locate(): Promise<void> {
		if (locating) return;
		locateError = null;

		if (!('geolocation' in navigator)) {
			locateError = 'Dieser Browser kennt keine Ortung.';
			return;
		}

		locating = true;
		try {
			const pos = await new Promise<GeolocationPosition>((ok, fail) =>
				navigator.geolocation.getCurrentPosition(ok, fail, {
					enableHighAccuracy: true,
					timeout: 12000,
					maximumAge: 30000
				})
			);
			position = {
				lon: pos.coords.longitude,
				lat: pos.coords.latitude,
				accuracyM: Math.max(pos.coords.accuracy, 5)
			};
			map?.flyTo({
				center: [position.lon, position.lat],
				zoom: Math.max(map.getZoom(), 14),
				duration: prefersReducedMotion() ? 0 : 600
			});
		} catch (e) {
			const code = (e as GeolocationPositionError)?.code;
			locateError =
				code === 1
					? 'Ortung abgelehnt. Im Browser für diese Seite erlauben.'
					: code === 3
						? 'Ortung hat zu lange gedauert.'
						: 'Standort nicht ermittelbar.';
		} finally {
			locating = false;
		}
	}

	export function locateState() {
		return { locating, error: locateError, hasPosition: position !== null };
	}

	/** Auf einen Ort aus der Suche springen. */
	export function flyToPlace(
		lon: number,
		lat: number,
		bbox?: [number, number, number, number]
	) {
		if (!map) return;
		const duration = prefersReducedMotion() ? 0 : 600;

		// Eine Stadt hat eine Ausdehnung, ein Gipfel nicht. Nominatim gibt
		// auch für Punkte eine winzige Box zurück — die würde bis in den
		// Maximalzoom springen.
		const gross = bbox && (bbox[2] - bbox[0] > 0.002 || bbox[3] - bbox[1] > 0.002);
		if (gross && bbox) {
			map.fitBounds(
				[
					[bbox[0], bbox[1]],
					[bbox[2], bbox[3]]
				],
				{ padding: 80, maxZoom: 15, duration }
			);
		} else {
			map.flyTo({ center: [lon, lat], zoom: 14, duration });
		}
	}

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
			// Die globale Regel in app.css erreicht MapLibre nicht — das ist
			// JavaScript, kein CSS-Übergang.
			{ padding, duration: prefersReducedMotion() ? 0 : 400 }
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
		border-radius: var(--r-sm);
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

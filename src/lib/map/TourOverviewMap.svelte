<script lang="ts">
	/**
	 * Alle Touren als Linien. Lesend, ohne Wegpunktwerkzeug.
	 *
	 * Eine eigene Komponente statt eines `readonly`-Schalters in MapCanvas:
	 * dessen ganzes Wesen — Klick setzt Wegpunkt, Rechtsklick löscht, Ziehen
	 * verschiebt — ist genau das, was die Übersicht nicht haben darf. Fünf
	 * Verhalten hinter einer Fahne in der zustandsreichsten Datei des
	 * Projekts zu verstecken wäre ein schlechter Tausch. Geteilt wird
	 * stattdessen das Teure: die Kartengrundlage aus basemap.ts.
	 */
	import { onMount } from 'svelte';
	import { Map as MlMap, type GeoJSONSource } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import type { FeatureCollection } from 'geojson';
	import { activity } from '$lib/geo/activity';
	import type { TourListItem } from '$lib/tour/types';
	import { prefersReducedMotion, resolveColorToken, theme } from '$lib/ui/theme.svelte';
	import { addTerrainLayers, createMap } from './basemap';
	import {
		addPositionLayers,
		locateOnce,
		positionFeatures,
		SRC_POSITION,
		type Position
	} from './position';

	interface Props {
		tours: TourListItem[];
		/** Überfahrene Tour — Liste und Karte teilen sich diesen Zustand. */
		hoveredId?: string | null;
		onSelect?: (id: string) => void;
		/**
		 * Der Nutzer hat den Ausschnitt selbst verschoben.
		 *
		 * Nur echte Bewegungen: was die Karte auf eigene Anweisung tut
		 * (Anflug auf einen Ort, auf den Standort, auf alle Touren), zählt
		 * nicht — sonst erschiene der Knopf „in diesem Gebiet suchen"
		 * schon beim Laden.
		 */
		onUserMoved?: (bbox: [number, number, number, number]) => void;
	}

	let { tours, hoveredId = $bindable(null), onSelect, onUserMoved }: Props = $props();

	let container: HTMLDivElement;
	let map: MlMap | undefined;
	let ready = $state(false);

	const SRC = 'wv-tours';
	const LYR = 'wv-tours-line';
	const LYR_HL = 'wv-tours-highlight';

	/** Eigener Standort. Beim Stöbern im Archiv nützlich: welche Tour
	 *  beginnt eigentlich in der Nähe? */
	let position = $state<Position | null>(null);
	let locating = $state(false);
	let locateError = $state<string | null>(null);

	/** Zählt die von uns selbst ausgelösten Bewegungen mit, damit ihr
	 *  `moveend` nicht als Nutzeraktion durchgeht. */
	let eigeneBewegungen = 0;

	function eigeneBewegung() {
		eigeneBewegungen += 1;
	}

	function collection(): FeatureCollection {
		return {
			type: 'FeatureCollection',
			features: tours
				.filter((t) => t.outline.length >= 2)
				.map((t) => ({
					type: 'Feature',
					properties: {
						id: t.id,
						name: t.name,
						// Farbe aus der Naht aufgelöst und mitgegeben. Der
						// Malausdruck ist dann nur ['get','color'] — kein
						// ['match','hike',…,'bike',…], das man bei einer dritten
						// Aktivitätsart zu ergänzen vergäße.
						color: resolveColorToken(activity(t.activityType).mapColorVar, '#b3382a')
					},
					geometry: { type: 'LineString', coordinates: t.outline }
				}))
		};
	}

	onMount(() => {
		const m = createMap(container, { scale: false });
		map = m;

		m.on('load', () => {
			addTerrainLayers(m);

			m.addSource(SRC, { type: 'geojson', data: collection() });

			// Dünn und leise: die Anforderung warnt ausdrücklich davor, alle
			// Routen gleichzeitig bunt übereinanderzulegen. Keine
			// Beschriftung auf den Linien, nie.
			m.addLayer({
				id: 'wv-tours-casing',
				type: 'line',
				source: SRC,
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: {
					'line-color': resolveColorToken('--route-casing', '#ffffff'),
					'line-width': 5,
					'line-opacity': 0.7
				}
			});

			m.addLayer({
				id: LYR,
				type: 'line',
				source: SRC,
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-opacity': 0.85 }
			});

			// Hervorhebung als eigene Ebene mit Filter: einen Filter zu
			// setzen ist billig, die Daten neu hochzuladen wäre es nicht.
			m.addLayer({
				id: LYR_HL,
				type: 'line',
				source: SRC,
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				filter: ['==', ['get', 'id'], ''],
				paint: { 'line-color': ['get', 'color'], 'line-width': 5 }
			});

			addPositionLayers(m, position);

			m.on('mousemove', LYR, (e) => {
				const id = e.features?.[0]?.properties?.id;
				if (typeof id === 'string') {
					hoveredId = id;
					m.getCanvas().style.cursor = 'pointer';
				}
			});
			m.on('mouseleave', LYR, () => {
				hoveredId = null;
				m.getCanvas().style.cursor = '';
			});
			m.on('click', LYR, (e) => {
				const id = e.features?.[0]?.properties?.id;
				if (typeof id === 'string') onSelect?.(id);
			});

			m.on('moveend', () => {
				if (eigeneBewegungen > 0) {
					eigeneBewegungen -= 1;
					return;
				}
				const b = m.getBounds();
				onUserMoved?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
			});

			ready = true;
			fitToTours();
		});

		return () => {
			m.remove();
			map = undefined;
		};
	});

	$effect(() => {
		void tours;
		void theme.resolved;
		if (!ready) return;
		(map?.getSource(SRC) as GeoJSONSource | undefined)?.setData(collection());
	});

	$effect(() => {
		if (!ready || !map) return;
		map.setFilter(LYR_HL, ['==', ['get', 'id'], hoveredId ?? '']);
	});

	$effect(() => {
		void position;
		if (!ready) return;
		(map?.getSource(SRC_POSITION) as GeoJSONSource | undefined)?.setData(
			positionFeatures(position)
		);
	});

	/* ------------------------------------------------------------------
	   Von außen aufrufbar
	   ------------------------------------------------------------------ */

	export async function locate(): Promise<void> {
		if (locating) return;
		locating = true;
		locateError = null;
		const r = await locateOnce();
		locating = false;

		if (!r.ok) {
			locateError = r.error;
			return;
		}
		position = r.position;
		eigeneBewegung();
		map?.flyTo({
			center: [position.lon, position.lat],
			zoom: Math.max(map.getZoom(), 12),
			duration: prefersReducedMotion() ? 0 : 600
		});
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
		eigeneBewegung();
		const gross = bbox && (bbox[2] - bbox[0] > 0.002 || bbox[3] - bbox[1] > 0.002);
		if (gross && bbox) {
			map.fitBounds(
				[
					[bbox[0], bbox[1]],
					[bbox[2], bbox[3]]
				],
				{ padding: 80, maxZoom: 14, duration }
			);
		} else {
			map.flyTo({ center: [lon, lat], zoom: 12, duration });
		}
	}

	/** Ausschnitt über alle Touren. Liest die Bounding Boxen, nicht die
	 *  Geometrien — vier Zahlen je Tour statt tausend Punkte. */
	export function fitToTours(padding = 48) {
		if (!map || tours.length === 0) return;
		let minX = 180;
		let minY = 90;
		let maxX = -180;
		let maxY = -90;
		for (const t of tours) {
			if (t.bbox[0] < minX) minX = t.bbox[0];
			if (t.bbox[1] < minY) minY = t.bbox[1];
			if (t.bbox[2] > maxX) maxX = t.bbox[2];
			if (t.bbox[3] > maxY) maxY = t.bbox[3];
		}
		const duration = prefersReducedMotion() ? 0 : 400;
		eigeneBewegung();

		// Eine einzige, sehr kurze Tour ergibt eine entartete Box, auf die
		// fitBounds bis in den Maximalzoom springt.
		if (maxX - minX < 1e-6 && maxY - minY < 1e-6) {
			map.flyTo({ center: [minX, minY], zoom: 13, duration });
			return;
		}
		map.fitBounds(
			[
				[minX, minY],
				[maxX, maxY]
			],
			{ padding, maxZoom: 12, duration }
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

	.map :global(.maplibregl-ctrl-group) {
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		border: 1px solid var(--edge);
		border-radius: var(--r-sm);
		box-shadow: none;
	}
	.map :global(.maplibregl-ctrl-attrib) {
		background: color-mix(in srgb, var(--surface) 80%, transparent);
		font-size: 10px;
	}
</style>

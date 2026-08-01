/**
 * Die Kartengrundlage: Instanz, Relief, Höhenlinien.
 *
 * Herausgelöst, weil zwei Karten sie brauchen — die Planungsansicht und die
 * Tourenübersicht. Die drei teuer erkauften Erkenntnisse aus dem
 * Kartenaufbau (Worker-Ausschluss, `tiles` statt `url`, Schriftstapel aus
 * dem Style lesen) stehen damit an genau einer Stelle und müssen nicht ein
 * zweites Mal erarbeitet werden.
 *
 * Was hier *nicht* hingehört: alles Interaktive. Die Übersichtskarte darf
 * gerade nicht auf Klicks Wegpunkte setzen.
 */

import { Map as MlMap, NavigationControl, ScaleControl, addProtocol } from 'maplibre-gl';
import mlcontour from 'maplibre-contour';
import { CONTOUR_THRESHOLDS, config } from '$lib/config';
import { resolveColorToken } from '$lib/ui/theme.svelte';

export interface MapOptions {
	center?: [number, number];
	zoom?: number;
	/** Bedienelemente einblenden. Die Übersichtskarte kommt ohne Maßstab aus. */
	scale?: boolean;
}

export function createMap(container: HTMLDivElement, opts: MapOptions = {}): MlMap {
	const m = new MlMap({
		container,
		style: config.basemapStyleUrl,
		center: opts.center ?? config.initialView.center,
		zoom: opts.zoom ?? config.initialView.zoom,
		attributionControl: { compact: true },
		// Klare Karte schlägt schnelle Karte: Beschriftungen dürfen nicht
		// über Höhenlinien flackern.
		fadeDuration: 0
	});

	m.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
	if (opts.scale !== false) m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');

	return m;
}

export interface TerrainInfo {
	/** Ebene, *vor* der eigene Linien eingehängt werden — unter die Beschriftung. */
	firstSymbolId?: string;
	/** Schriftstapel der Basiskarte, für eigene Symbolebenen. */
	textFont?: string[];
}

/**
 * Relief und Höhenlinien aufbauen. Gibt zurück, was der Aufrufer für seine
 * eigenen Ebenen braucht.
 */
export function addTerrainLayers(m: MlMap): TerrainInfo {
	const styleLayers = m.getStyle().layers ?? [];

	// Relief und Höhenlinien gehören *unter* die Beschriftungen.
	const firstSymbolId = styleLayers.find((l) => l.type === 'symbol')?.id;

	/**
	 * Schriftstapel aus der Basiskarte übernehmen.
	 *
	 * Ohne Angabe nimmt MapLibre `Open Sans Regular, Arial Unicode MS
	 * Regular` an — den bietet OpenFreeMap nicht, das ergibt bei jedem Laden
	 * eine 404-Anfrage. Aus dem Style gelesen funktioniert es mit jeder
	 * Basiskarte, auch nach dem Wechsel auf eigene PMTiles.
	 */
	const textFont =
		styleLayers
			.filter((l) => l.type === 'symbol')
			.map((l) => (l.layout as { 'text-font'?: string[] } | undefined)?.['text-font'])
			.find((f): f is string[] => Array.isArray(f) && f.length > 0) ?? undefined;

	// Höhendaten laufen über den eigenen Server. Ein gemeinsamer DemSource
	// versorgt Schummerung *und* Höhenlinien, damit jede Kachel nur einmal
	// geholt und dekodiert wird.
	const dem = new mlcontour.DemSource({
		// Bewusst zusammengesetzt statt über `new URL()`: das würde die
		// Platzhalter zu %7Bz%7D prozentkodieren, und maplibre-contour könnte
		// sie nicht mehr durch Kachelkoordinaten ersetzen.
		url: window.location.origin + config.demTileUrl,
		encoding: config.demEncoding,
		maxzoom: config.demMaxZoom,
		worker: true
	});
	dem.setupMaplibre({ addProtocol });

	m.addSource('wv-dem', {
		type: 'raster-dem',
		// `tiles`, nicht `url`: `url` erwartet ein TileJSON-Dokument und würde
		// `dem-shared://{z}/{x}/{y}` wörtlich anfordern, ohne die Platzhalter
		// zu ersetzen. Das Relief bliebe still aus.
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
				// Höhendaten harte dunkle Flecken entstehen, unter denen Wege
				// und Beschriftungen verschwinden.
				'hillshade-exaggeration': 0.16,
				'hillshade-shadow-color': resolveColorToken('--hs-shadow', '#6b6152'),
				'hillshade-highlight-color': resolveColorToken('--hs-highlight', '#fffdf8'),
				'hillshade-accent-color': resolveColorToken('--hs-accent', '#8c8272')
			}
		},
		firstSymbolId
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
				'line-color': resolveColorToken('--contour', '#a08a6b'),
				// Jede fünfte Linie betont — so lesen sich Wanderkarten.
				'line-width': ['match', ['get', 'level'], 1, 1.1, 0.6],
				'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 11.5, 0.55]
			}
		},
		firstSymbolId
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
				'text-color': resolveColorToken('--contour-index', '#8a7250'),
				'text-halo-color': resolveColorToken('--paper-2', '#f4f6f1'),
				'text-halo-width': 1.4
			}
		},
		firstSymbolId
	);

	return { firstSymbolId, textFont };
}

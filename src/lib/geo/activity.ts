/**
 * Aktivitätsart — die Naht, an der Wandern und Radfahren auseinandergehen.
 *
 * Das ist die zentrale Entscheidung aus Variante C: die App hat *eine*
 * Oberfläche, und alles Aktivitätsabhängige wird aus dieser einen Definition
 * abgeleitet statt an fünfzig Stellen hart gesetzt. Wer eine dritte Art
 * ergänzen will, schreibt hier einen Eintrag und nichts anderes.
 *
 * Regel für den weiteren Ausbau: es darf nirgendwo im Code
 * `if (activity === 'hike')` stehen. Wenn etwas fehlt, gehört es als Feld
 * in diese Definition.
 */

import * as fmt from '$lib/format';
import {
	BIKE_DEFAULTS,
	HIKE_DEFAULTS,
	bikeDurationS,
	hikeDurationS,
	type Segment
} from './duration';

/**
 * Eingabe für die Kennzahlen. Absichtlich strukturell und nicht
 * `RouteResult`: `tour/types` importiert diese Datei, ein Rückimport wäre
 * ein Zyklus.
 */
export interface MetricInput {
	distanceM: number;
	ascentM: number;
	descentM: number;
	minEleM: number;
	maxEleM: number;
	durationS: number;
}

export interface Metric {
	label: string;
	value: string;
	unit?: string;
}

export const ACTIVITY_TYPES = ['hike', 'bike'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export function isActivityType(v: unknown): v is ActivityType {
	return typeof v === 'string' && (ACTIVITY_TYPES as readonly string[]).includes(v);
}

/** POI-Gruppen, die beim Planen und unterwegs angeboten werden. */
export type PoiCategory =
	| 'hut'
	| 'water'
	| 'food'
	| 'bus'
	| 'train'
	| 'bike_shop'
	| 'bike_repair'
	| 'viewpoint'
	| 'shelter';

export interface ActivityDefinition {
	id: ActivityType;
	/** Beschriftung in der Oberfläche. */
	label: string;
	/** CSS-Variable der Routenfarbe in der Oberfläche — Topo-Konvention:
	 *  Wandern rot, Rad blau. Wechselt mit Hell und Dunkel. */
	colorVar: string;
	/** Dieselbe Farbe *auf der Karte*. Getrennt, weil die Basiskarte in
	 *  beiden Modi hell ist: dort gilt das kräftige Topo-Rot, auf einem
	 *  dunklen Panel das aufgehellte. */
	mapColorVar: string;
	/** Profildatei, die BRouter erhält. */
	brouterProfile: string;
	/** OSM-Relationstyp für das Routen-Overlay. */
	osmRouteType: 'hiking' | 'bicycle';
	/** Beschriftung des Layer-Chips über der Karte. */
	routeLayerLabel: string;
	/** POI-Gruppen in Anzeigereihenfolge. */
	poiCategories: PoiCategory[];
	/** Rechnet Segmente in Sekunden um. */
	durationS: (segments: Segment[]) => number;
	/**
	 * Kennzahlen der Tour, in Anzeigereihenfolge.
	 *
	 * Steht hier statt in der Oberfläche, damit es im ganzen Code kein
	 * `if (activityType === 'hike')` gibt. Wer eine Aktivitätsart ergänzt,
	 * beschreibt ihre Kennzahlen hier — und nirgends sonst.
	 */
	metrics: (r: MetricInput) => Metric[];
	/** Menschenlesbare Formel für die Oberfläche — die Anforderung
	 *  verlangt Nachvollziehbarkeit, nicht eine Blackbox. */
	durationExplainer: { short: string; long: string };
	/** Vorbelegung für den Offline-Download. Radtouren sind länger und
	 *  brauchen weniger Detail als eine Gratwanderung. */
	offline: { corridorM: number; maxZoom: number };
	/** Startzoom der Feldansicht. */
	fieldZoom: number;
	/** Ab welcher Abweichung gewarnt wird. Auf dem Rad ist man schneller
	 *  weit weg, verfährt sich aber seltener kleinräumig. */
	offRouteThresholdM: number;
}

export const ACTIVITIES: Record<ActivityType, ActivityDefinition> = {
	hike: {
		id: 'hike',
		label: 'Wandern',
		colorVar: '--route-hike',
		mapColorVar: '--map-route-hike',
		brouterProfile: 'hiking-mountain',
		osmRouteType: 'hiking',
		routeLayerLabel: 'Wanderwege',
		poiCategories: ['hut', 'water', 'food', 'shelter', 'viewpoint', 'bus'],
		durationS: (s) => hikeDurationS(s, HIKE_DEFAULTS),
		metrics: (r) => [
			{ label: 'Länge', value: fmt.km(r.distanceM), unit: 'km' },
			{ label: 'Dauer', value: fmt.duration(r.durationS), unit: 'h' },
			{ label: 'Aufstieg', value: fmt.hm(r.ascentM), unit: 'hm' },
			{ label: 'Abstieg', value: fmt.hm(r.descentM), unit: 'hm' },
			{ label: 'Höchster Punkt', value: fmt.hm(r.maxEleM), unit: 'm' },
			{ label: 'Tiefster Punkt', value: fmt.hm(r.minEleM), unit: 'm' }
		],
		durationExplainer: {
			short: 'DAV',
			long: `Aufstieg ${HIKE_DEFAULTS.ascentMPerH} hm/h · Strecke ${HIKE_DEFAULTS.flatSpeedKmh} km/h`
		},
		offline: { corridorM: 2500, maxZoom: 15 },
		fieldZoom: 15,
		offRouteThresholdM: 50
	},
	bike: {
		id: 'bike',
		label: 'Rad',
		colorVar: '--route-bike',
		mapColorVar: '--map-route-bike',
		brouterProfile: 'trekking',
		osmRouteType: 'bicycle',
		routeLayerLabel: 'Radrouten',
		poiCategories: ['water', 'food', 'bike_shop', 'bike_repair', 'train', 'viewpoint'],
		durationS: (s) => bikeDurationS(s, BIKE_DEFAULTS),
		metrics: (r) => [
			{ label: 'Länge', value: fmt.km(r.distanceM), unit: 'km' },
			{ label: 'Dauer', value: fmt.duration(r.durationS), unit: 'h' },
			{ label: 'Aufstieg', value: fmt.hm(r.ascentM), unit: 'hm' },
			{ label: 'Abstieg', value: fmt.hm(r.descentM), unit: 'hm' },
			{
				label: 'Ø Geschwindigkeit',
				value:
					r.durationS > 0
						? fmt.speed(r.distanceM / 1000 / (r.durationS / 3600))
						: '–',
				unit: 'km/h'
			},
			{ label: 'Höchster Punkt', value: fmt.hm(r.maxEleM), unit: 'm' }
		],
		durationExplainer: {
			short: 'Rad',
			long: `Grundtempo ${BIKE_DEFAULTS.baseSpeedKmh} km/h · Steigung und Untergrund gewichtet`
		},
		offline: { corridorM: 4000, maxZoom: 14 },
		fieldZoom: 14,
		offRouteThresholdM: 80
	}
};

export const DEFAULT_ACTIVITY: ActivityType = 'hike';

export function activity(type: ActivityType): ActivityDefinition {
	return ACTIVITIES[type];
}

/** Beschriftungen der POI-Gruppen, getrennt gehalten, damit sie später
 *  in eine Übersetzungsdatei wandern können. */
export const POI_LABELS: Record<PoiCategory, string> = {
	hut: 'Hütte',
	water: 'Trinkwasser',
	food: 'Einkehr',
	bus: 'Bushaltestelle',
	train: 'Bahnhof',
	bike_shop: 'Radladen',
	bike_repair: 'Reparaturstation',
	viewpoint: 'Aussicht',
	shelter: 'Schutzhütte'
};

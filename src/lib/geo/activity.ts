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
// Nur der Typ — zur Laufzeit bleibt diese Datei ohne Abhängigkeit zur
// Oberfläche, und ein Zyklus ist ausgeschlossen.
import type { IconName } from '$lib/ui/icons';
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
	/** Symbol der Kachel. Steht hier, damit die Schiene die Zuordnung nicht
	 *  doch wieder nach Aktivitätsart treffen muss. */
	icon?: IconName;
	/** Das Symbol um 180° gedreht — der Berg wird zum tiefsten Punkt. */
	iconRotate?: 0 | 180;
	/** Groß dargestellt. Höchstens zwei je Aktivitätsart, sonst ist nichts
	 *  mehr betont. */
	emphasis?: boolean;
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
	/** Symbol für Umschalter, Tourenliste und später die Feldansicht. */
	icon: IconName;
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
	/**
	 * Name der Kachelebene im Routen-Overlay.
	 *
	 * Steht getrennt von `osmRouteType`, weil OSM die Relation `bicycle`
	 * nennt und die Kachelquelle `cycling`. Eine Umrechnung im Aufrufer
	 * wäre wieder eine Verzweigung nach Aktivitätsart.
	 */
	overlayLayer: string;
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
	/**
	 * Die drei Zahlen, die auf eine Tourenkarte passen.
	 *
	 * Bewusst eine eigene Funktion und nicht `metrics(r).slice(0, 3)`: das
	 * koppelte die Liste an die Reihenfolge im Planer, und wer dort eine
	 * Kennzahl voranstellt, änderte unbemerkt das Archiv mit.
	 */
	listMetrics: (r: MetricInput) => Metric[];
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
		icon: 'hike',
		colorVar: '--route-hike',
		mapColorVar: '--map-route-hike',
		brouterProfile: 'hiking-mountain',
		osmRouteType: 'hiking',
		overlayLayer: 'hiking',
		routeLayerLabel: 'Wanderwege',
		poiCategories: ['hut', 'water', 'food', 'shelter', 'viewpoint', 'bus'],
		durationS: (s) => hikeDurationS(s, HIKE_DEFAULTS),
		// Beim Wandern entscheidet der Aufstieg über den Tag, nicht die Uhr.
		metrics: (r) => [
			{ label: 'Länge', value: fmt.km(r.distanceM), unit: 'km', icon: 'ruler', emphasis: true },
			{ label: 'Aufstieg', value: fmt.hm(r.ascentM), unit: 'hm', icon: 'ascent', emphasis: true },
			{ label: 'Dauer', value: fmt.duration(r.durationS), unit: 'h', icon: 'clock' },
			{ label: 'Abstieg', value: fmt.hm(r.descentM), unit: 'hm', icon: 'descent' },
			{ label: 'Höchster Punkt', value: fmt.hm(r.maxEleM), unit: 'm', icon: 'mountain' },
			{
				label: 'Tiefster Punkt',
				value: fmt.hm(r.minEleM),
				unit: 'm',
				icon: 'mountain',
				iconRotate: 180
			}
		],
		listMetrics: (r) => [
			{ label: 'Länge', value: fmt.km(r.distanceM), unit: 'km', icon: 'ruler' },
			{ label: 'Dauer', value: fmt.duration(r.durationS), unit: 'h', icon: 'clock' },
			{ label: 'Aufstieg', value: fmt.hm(r.ascentM), unit: 'hm', icon: 'ascent' }
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
		icon: 'bike',
		colorVar: '--route-bike',
		mapColorVar: '--map-route-bike',
		brouterProfile: 'trekking',
		osmRouteType: 'bicycle',
		overlayLayer: 'cycling',
		routeLayerLabel: 'Radwege',
		poiCategories: ['water', 'food', 'bike_shop', 'bike_repair', 'train', 'viewpoint'],
		durationS: (s) => bikeDurationS(s, BIKE_DEFAULTS),
		// Auf dem Rad plant man nach Strecke und Zeit; der Aufstieg ist
		// wichtig, aber nicht die Leitzahl.
		metrics: (r) => [
			{ label: 'Länge', value: fmt.km(r.distanceM), unit: 'km', icon: 'ruler', emphasis: true },
			{
				label: 'Dauer',
				value: fmt.duration(r.durationS),
				unit: 'h',
				icon: 'clock',
				emphasis: true
			},
			{ label: 'Aufstieg', value: fmt.hm(r.ascentM), unit: 'hm', icon: 'ascent' },
			{ label: 'Abstieg', value: fmt.hm(r.descentM), unit: 'hm', icon: 'descent' },
			{
				label: 'Ø Geschwindigkeit',
				value: r.durationS > 0 ? fmt.speed(r.distanceM / 1000 / (r.durationS / 3600)) : '–',
				unit: 'km/h',
				icon: 'gauge'
			},
			{ label: 'Höchster Punkt', value: fmt.hm(r.maxEleM), unit: 'm', icon: 'mountain' }
		],
		listMetrics: (r) => [
			{ label: 'Länge', value: fmt.km(r.distanceM), unit: 'km', icon: 'ruler' },
			{ label: 'Dauer', value: fmt.duration(r.durationS), unit: 'h', icon: 'clock' },
			{ label: 'Aufstieg', value: fmt.hm(r.ascentM), unit: 'hm', icon: 'ascent' }
		],
		durationExplainer: {
			// „Rad" allein las sich neben „DAV" wie eine Abkürzung, die es
			// nicht gibt.
			short: 'Rad-Modell',
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

/**
 * Beschriftung und Symbol je POI-Gruppe.
 *
 * Beides an einer Stelle: eine zweite Tabelle nur für Symbole hätte beim
 * Ergänzen einer Gruppe still eine Lücke gelassen — Record erzwingt
 * Vollständigkeit nur dort, wo alles zusammensteht.
 *
 * Noch ungenutzt; POIs kommen laut Anforderungen 6.2 mit dem OSM-Extrakt.
 */
export const POI_META: Record<PoiCategory, { label: string; icon: IconName }> = {
	hut: { label: 'Hütte', icon: 'hut' },
	water: { label: 'Trinkwasser', icon: 'water' },
	food: { label: 'Einkehr', icon: 'food' },
	bus: { label: 'Bushaltestelle', icon: 'bus' },
	train: { label: 'Bahnhof', icon: 'train' },
	bike_shop: { label: 'Radladen', icon: 'bike-shop' },
	bike_repair: { label: 'Reparaturstation', icon: 'bike-repair' },
	viewpoint: { label: 'Aussicht', icon: 'viewpoint' },
	shelter: { label: 'Schutzhütte', icon: 'shelter' }
};

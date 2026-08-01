import type { ActivityType } from '$lib/geo/activity';

/** Ein vom Nutzer gesetzter Ankerpunkt. Die Route dazwischen berechnet BRouter. */
export interface Waypoint {
	id: string;
	lon: number;
	lat: number;
	/** Aus der Ortssuche oder vom Nutzer benannt. */
	name?: string;
}

/** Ergebnis einer Routenberechnung. */
export interface RouteResult {
	/** Stützpunkte als `[lon, lat, ele]`. */
	coordinates: [number, number, number][];
	distanceM: number;
	ascentM: number;
	descentM: number;
	minEleM: number;
	maxEleM: number;
	durationS: number;
}

export interface Tour {
	id?: string;
	name: string;
	activityType: ActivityType;
	date?: string;
	note?: string;
	waypoints: Waypoint[];
	route: RouteResult | null;
	visibility: 'private' | 'instance';
}

/**
 * Eine Tour, wie die Listenansicht sie braucht — ohne die volle Geometrie.
 *
 * Erfüllt strukturell `MetricInput`; genau deshalb ist der dort als
 * Strukturtyp und nicht als `RouteResult` deklariert. Die Tourenkarte kann
 * damit `def.listMetrics(tour)` direkt aufrufen.
 */
export interface TourListItem {
	id: string;
	name: string;
	activityType: ActivityType;
	date: string | null;
	note: string | null;
	distanceM: number;
	ascentM: number;
	descentM: number;
	durationS: number;
	minEleM: number;
	maxEleM: number;
	/** Vereinfachte Linie für Übersichtskarte und Skizze, `[lon, lat]`. */
	outline: [number, number][];
	/** `[minLon, minLat, maxLon, maxLat]` — direkt für `fitBounds`. */
	bbox: [number, number, number, number];
	updatedAt: string;
}

export function emptyTour(activityType: ActivityType): Tour {
	return {
		name: 'Neue Tour',
		activityType,
		waypoints: [],
		route: null,
		visibility: 'private'
	};
}

/** Kurze eindeutige Kennung für noch nicht gespeicherte Wegpunkte. */
export function newId(): string {
	return crypto.randomUUID();
}

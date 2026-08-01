/**
 * Eingaben prüfen — geteilt zwischen Routing und Speichern.
 *
 * Rein, ohne Serverabhängigkeiten: dieselben Regeln sollen später auch beim
 * GPX-Import und beim Übernehmen einer OSM-Relation gelten.
 *
 * Alle Meldungen sind deutsch und benennen den Ort des Fehlers. Wer eine
 * kaputte Tour speichert, soll erfahren welcher Wegpunkt es war.
 */

import { isActivityType, type ActivityType } from '$lib/geo/activity';
import type { Waypoint } from './types';

export function parseWaypoints(input: unknown): Waypoint[] {
	if (!Array.isArray(input)) throw new Error('waypoints muss ein Array sein');

	return input.map((w, i) => {
		const lon = Number((w as Waypoint)?.lon);
		const lat = Number((w as Waypoint)?.lat);

		if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
			throw new Error(`Wegpunkt ${i + 1}: ungültige Länge`);
		}
		if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
			throw new Error(`Wegpunkt ${i + 1}: ungültige Breite`);
		}

		const id = (w as Waypoint)?.id;
		const name = (w as Waypoint)?.name;
		return {
			id: typeof id === 'string' ? id : String(i),
			lon,
			lat,
			...(typeof name === 'string' && name ? { name } : {})
		};
	});
}

/** Stützpunkte der berechneten Route als `[lon, lat, ele]`. */
export function parseCoordinates(input: unknown): [number, number, number][] {
	if (!Array.isArray(input)) throw new Error('Die Route enthält keine Stützpunkte');

	return input.map((c, i) => {
		const lon = Number((c as number[])?.[0]);
		const lat = Number((c as number[])?.[1]);
		// Höhe darf fehlen — über See liefert das Höhenmodell nichts.
		const ele = Number((c as number[])?.[2] ?? 0);

		if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
			throw new Error(`Stützpunkt ${i + 1}: ungültige Länge`);
		}
		if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
			throw new Error(`Stützpunkt ${i + 1}: ungültige Breite`);
		}
		return [lon, lat, Number.isFinite(ele) ? ele : 0];
	});
}

export interface TourInput {
	name: string;
	activityType: ActivityType;
	date: string | null;
	note: string | null;
	visibility: 'private' | 'instance';
	waypoints: Waypoint[];
	/**
	 * Nur die Stützpunkte. Kennzahlen rechnet der Server aus genau diesem
	 * Array — mitgeschickte Werte werden ignoriert, damit Geometrie und
	 * Zahlen einander nicht widersprechen können.
	 */
	coordinates: [number, number, number][];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseTourInput(input: unknown): TourInput {
	const o = (input ?? {}) as Record<string, unknown>;

	const name = typeof o.name === 'string' ? o.name.trim() : '';
	if (!name) throw new Error('Name darf nicht leer sein');
	if (name.length > 200) throw new Error('Name ist zu lang (höchstens 200 Zeichen)');

	if (!isActivityType(o.activityType)) throw new Error('Unbekannte Aktivitätsart');

	const date = typeof o.date === 'string' && o.date ? o.date : null;
	if (date && !ISO_DATE.test(date)) throw new Error('Datum muss JJJJ-MM-TT sein');

	const note = typeof o.note === 'string' && o.note.trim() ? o.note.trim() : null;

	const visibility = o.visibility === 'instance' ? 'instance' : 'private';

	const waypoints = parseWaypoints(o.waypoints);
	if (waypoints.length < 2) throw new Error('Eine Tour braucht mindestens zwei Wegpunkte');

	const route = (o.route ?? {}) as Record<string, unknown>;
	const coordinates = parseCoordinates(route.coordinates);
	if (coordinates.length < 2) throw new Error('Die Route ist leer — erst berechnen, dann speichern');

	return { name, activityType: o.activityType, date, note, visibility, waypoints, coordinates };
}

/**
 * Touren lesen und schreiben.
 *
 * **Die Regel dieses Moduls:** Der Client schickt nur `coordinates`. Jede
 * Zahl rechnet der Server aus genau dieser Linie — mitgeschickte Kennzahlen
 * werden ignoriert. Damit können Geometrie und Zahlen nicht auseinander
 * laufen, weil sie aus einem Array in einer Anfrage entstehen.
 *
 * Die geometrischen Ableitungen (vereinfachte Linie, Bounding Box) entstehen
 * im *selben* SQL-Statement wie das Insert. Ein Trigger wäre auch gegen psql
 * dicht, aber drizzle-kit erzeugt keine Trigger — man müsste ihn in die
 * Migration schreiben und jedes push meldete danach eine Abweichung.
 */

import { deriveStats } from '$lib/server/brouter';
import type { ActivityType } from '$lib/geo/activity';
import type { TourInput } from '$lib/tour/parse';
import type { RouteResult, Tour, TourListItem, Waypoint } from '$lib/tour/types';
import { toDbError } from './errors';
import { sql } from './index';

export type TourSort = 'updated' | 'date' | 'name' | 'distance' | 'ascent' | 'duration';

export interface TourQuery {
	activityType?: ActivityType | null;
	q?: string | null;
	sort?: TourSort;
	/** Ausschnitt `[minLon, minLat, maxLon, maxLat]` — der Regionsfilter. */
	bbox?: [number, number, number, number] | null;
}

/**
 * Erlaubte Sortierungen. Eine Auswahlliste und keine Zeichenkette aus der
 * URL — sonst stünde hier eine Einladung zur SQL-Injektion.
 *
 * Die Richtung steckt in der Option, damit die Oberfläche keinen zweiten
 * Umschalter für auf- und absteigend braucht.
 */
const SORT: Record<TourSort, string> = {
	updated: 'updated_at desc',
	// Touren ohne Datum ans Ende, nicht an den Anfang.
	date: 'date desc nulls last',
	// Nutzt die ICU-de-DE-Kollation der Datenbank: Ärmelkanal vor Bach.
	name: 'name asc',
	distance: 'distance_m desc',
	ascent: 'ascent_m desc',
	duration: 'duration_s desc'
};

/* ---------------------------------------------------------------- Lesen */

export async function listTours(ownerId: string, q: TourQuery = {}): Promise<TourListItem[]> {
	const order = SORT[q.sort ?? 'updated'] ?? SORT.updated;
	try {
		const rows = await sql`
			select
				id, name, activity_type, date, note,
				distance_m, ascent_m, descent_m, duration_s, min_ele_m, max_ele_m,
				min_lon, min_lat, max_lon, max_lat, updated_at,
				-- Sechs Nachkommastellen sind rund 11 cm und halbieren die
				-- Nutzlast. -> 'coordinates' liefert gleich das nackte Array.
				ST_AsGeoJSON(geom_overview, 6)::json -> 'coordinates' as outline
			from tours
			where owner_id = ${ownerId}
				${q.activityType ? sql`and activity_type = ${q.activityType}` : sql``}
				${q.q ? sql`and (name ilike ${'%' + q.q + '%'} or note ilike ${'%' + q.q + '%'})` : sql``}
				${
					q.bbox
						? sql`and geom && ST_MakeEnvelope(${q.bbox[0]}, ${q.bbox[1]}, ${q.bbox[2]}, ${q.bbox[3]}, 4326)`
						: sql``
				}
			order by ${sql.unsafe(order)}
		`;
		return rows.map(rowToListItem);
	} catch (e) {
		throw toDbError(e);
	}
}

export async function getTour(ownerId: string, id: string): Promise<Tour | null> {
	try {
		const rows = await sql`
			select
				id, name, activity_type, date, note, visibility, waypoints,
				distance_m, ascent_m, descent_m, duration_s, min_ele_m, max_ele_m,
				ST_AsGeoJSON(geom, 7)::json -> 'coordinates' as coordinates
			from tours
			where owner_id = ${ownerId} and id = ${id}
		`;
		return rows[0] ? rowToTour(rows[0]) : null;
	} catch (e) {
		throw toDbError(e);
	}
}

/* --------------------------------------------------------------- Schreiben */

export async function createTour(ownerId: string, input: TourInput): Promise<string> {
	const s = deriveStats(input.coordinates, input.activityType);
	const line = geoJsonLine(input.coordinates);
	try {
		const rows = await sql`
			with g as (select ST_SetSRID(ST_GeomFromGeoJSON(${line}), 4326) as geom)
			insert into tours (
				owner_id, name, activity_type, date, note, visibility, waypoints,
				geom, geom_overview,
				distance_m, ascent_m, descent_m, duration_s, min_ele_m, max_ele_m,
				min_lon, min_lat, max_lon, max_lat
			)
			select
				${ownerId}, ${input.name}, ${input.activityType}, ${input.date},
				${input.note}, ${input.visibility}, ${JSON.stringify(input.waypoints)}::jsonb,
				g.geom, ${SIMPLIFY},
				${s.distanceM}, ${s.ascentM}, ${s.descentM}, ${s.durationS},
				${s.minEleM}, ${s.maxEleM},
				ST_XMin(g.geom), ST_YMin(g.geom), ST_XMax(g.geom), ST_YMax(g.geom)
			from g
			returning id
		`;
		return rows[0].id as string;
	} catch (e) {
		throw toDbError(e);
	}
}

export async function updateTour(
	ownerId: string,
	id: string,
	input: TourInput
): Promise<boolean> {
	const s = deriveStats(input.coordinates, input.activityType);
	const line = geoJsonLine(input.coordinates);
	try {
		const rows = await sql`
			with g as (select ST_SetSRID(ST_GeomFromGeoJSON(${line}), 4326) as geom)
			update tours set
				name = ${input.name},
				activity_type = ${input.activityType},
				date = ${input.date},
				note = ${input.note},
				visibility = ${input.visibility},
				waypoints = ${JSON.stringify(input.waypoints)}::jsonb,
				geom = g.geom,
				geom_overview = ${SIMPLIFY},
				distance_m = ${s.distanceM},
				ascent_m = ${s.ascentM},
				descent_m = ${s.descentM},
				duration_s = ${s.durationS},
				min_ele_m = ${s.minEleM},
				max_ele_m = ${s.maxEleM},
				min_lon = ST_XMin(g.geom), min_lat = ST_YMin(g.geom),
				max_lon = ST_XMax(g.geom), max_lat = ST_YMax(g.geom),
				updated_at = now()
			from g
			where owner_id = ${ownerId} and id = ${id}
			returning tours.id
		`;
		return rows.length > 0;
	} catch (e) {
		throw toDbError(e);
	}
}

export async function deleteTour(ownerId: string, id: string): Promise<boolean> {
	try {
		const rows = await sql`
			delete from tours where owner_id = ${ownerId} and id = ${id} returning id
		`;
		return rows.length > 0;
	} catch (e) {
		throw toDbError(e);
	}
}

/* ------------------------------------------------------------------ Innen */

/**
 * Vereinfachen in Web-Mercator mit 25 m Toleranz.
 *
 * Nicht in 4326 mit einer Gradtoleranz: ein Grad ist kein Meter, und der
 * Fehler änderte sich mit der geografischen Breite — dieselbe Zahl ergäbe
 * in Norwegen etwas anderes als in Sizilien.
 */
const SIMPLIFY = sql`ST_Transform(ST_Simplify(ST_Transform(ST_Force2D(g.geom), 3857), 25), 4326)`;

function geoJsonLine(coords: [number, number, number][]): string {
	return JSON.stringify({ type: 'LineString', coordinates: coords });
}

type Row = Record<string, unknown>;

function rowToListItem(r: Row): TourListItem {
	return {
		id: r.id as string,
		name: r.name as string,
		activityType: r.activity_type as ActivityType,
		date: (r.date as string | null) ?? null,
		note: (r.note as string | null) ?? null,
		distanceM: Number(r.distance_m),
		ascentM: Number(r.ascent_m),
		descentM: Number(r.descent_m),
		durationS: Number(r.duration_s),
		minEleM: Number(r.min_ele_m),
		maxEleM: Number(r.max_ele_m),
		outline: (r.outline as [number, number][]) ?? [],
		bbox: [Number(r.min_lon), Number(r.min_lat), Number(r.max_lon), Number(r.max_lat)],
		updatedAt: new Date(r.updated_at as string).toISOString()
	};
}

function rowToTour(r: Row): Tour {
	const route: RouteResult = {
		coordinates: (r.coordinates as [number, number, number][]) ?? [],
		distanceM: Number(r.distance_m),
		ascentM: Number(r.ascent_m),
		descentM: Number(r.descent_m),
		durationS: Number(r.duration_s),
		minEleM: Number(r.min_ele_m),
		maxEleM: Number(r.max_ele_m)
	};
	return {
		id: r.id as string,
		name: r.name as string,
		activityType: r.activity_type as ActivityType,
		// Die Spalten sind nullable, `Tour` deklariert sie optional. Genau
		// eine Stelle übersetzt das, damit es nicht überall auftaucht.
		date: (r.date as string | null) ?? undefined,
		note: (r.note as string | null) ?? undefined,
		visibility: r.visibility as 'private' | 'instance',
		waypoints: (r.waypoints as Waypoint[]) ?? [],
		route
	};
}

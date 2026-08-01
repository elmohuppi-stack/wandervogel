/**
 * Datenmodell.
 *
 * Eine Tabelle. Kein `tour_routes` daneben: eine Tour hat per Definition
 * genau eine geplante Route, ein 1:1-Verbund wäre ein Join auf jedem Lesen
 * für nichts. Aufgezeichnete Tracks werden eine eigene Tabelle (1:n), und
 * Routenvarianten aus 6.2 KANN wären eine additive Migration.
 */

import { sql } from 'drizzle-orm';
import {
	check,
	customType,
	doublePrecision,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import type { ActivityType } from '$lib/geo/activity';
import type { Waypoint } from '$lib/tour/types';

/**
 * PostGIS-Linie mit Höhe.
 *
 * Drizzles eingebautes `geometry()` bildet nur Punkte ab — sein
 * `mapFromDriverValue` gibt `[number, number]` zurück. Hier zählt allein der
 * DDL-Typ; gelesen und geschrieben wird über ST_AsGeoJSON und
 * ST_GeomFromGeoJSON in den Abfragen.
 */
const lineStringZ = customType<{ data: string; driverParam: string }>({
	dataType: () => 'geometry(LineStringZ, 4326)'
});

const lineString = customType<{ data: string; driverParam: string }>({
	dataType: () => 'geometry(LineString, 4326)'
});

export const tours = pgTable(
	'tours',
	{
		id: uuid().primaryKey().default(sql`gen_random_uuid()`),

		/**
		 * Steht von Tag eins da, obwohl es noch keine Anmeldung gibt, und
		 * jede Abfrage filtert darauf. Wenn die Anmeldung kommt, liest eine
		 * einzige Zeile in hooks.server.ts die Sitzung statt der festen
		 * Kennung — kein Umbau durch fünf Schichten. Der Fremdschlüssel auf
		 * `users` kommt mit derselben Migration.
		 */
		ownerId: uuid().notNull(),

		/** Sortiert nach deutscher Kollation — dafür wurde die Datenbank mit
		 *  ICU und de-DE aufgesetzt. */
		name: text().notNull(),

		/**
		 * Bewusst `text` und kein pg-Enum.
		 *
		 * Ein Enum hieße, dass eine dritte Aktivitätsart eine Migration
		 * braucht und die Liste der Arten an zwei Stellen steht. Genau das
		 * verbietet die Regel in geo/activity.ts. Geprüft wird in TypeScript
		 * mit dem vorhandenen isActivityType().
		 *
		 * `visibility` bekommt dagegen einen CHECK: das ist wirklich eine
		 * geschlossene Menge, die sich nicht mit der App weiterentwickelt.
		 */
		activityType: text().$type<ActivityType>().notNull(),

		/** Tagestour — kein Zeitstempel, nur der Tag. */
		date: text(),
		note: text(),
		visibility: text().$type<'private' | 'instance'>().notNull().default('private'),

		/**
		 * Die Anker des Nutzers, geordnet und benannt.
		 *
		 * Absichtlich nicht als PostGIS-MultiPoint: das verlöre beides — die
		 * Reihenfolge ist dort nicht garantiert und einen Namen kann ein
		 * Punkt nicht tragen. Räumlich gesucht wird ohnehin auf der Route.
		 */
		waypoints: jsonb().$type<Waypoint[]>().notNull(),

		/** Die berechnete Route. Maßgeblich für alles Räumliche. */
		geom: lineStringZ().notNull(),

		/**
		 * Dieselbe Linie, auf 25 m vereinfacht und ohne Höhe.
		 *
		 * Speist Übersichtskarte und Kartenskizze. Ohne sie müsste die
		 * Startseite die vollen Geometrien ausliefern: eine 40-km-Tour hat
		 * 2000–6000 Stützpunkte, fünfzig davon wären rund 15 MB.
		 */
		geomOverview: lineString().notNull(),

		/**
		 * Kennzahlen mitgeführt, damit die Liste ohne Routenberechnung
		 * rendert. ST_Length gäbe die Distanz her, aber nicht die Dauer —
		 * die kommt aus der DAV-Formel bzw. dem Radmodell in geo/duration.ts,
		 * und die kann PostGIS nicht auswerten. Sobald eine Zahl gespeichert
		 * wird, gehören alle dazu, sonst widersprechen sie einander.
		 */
		distanceM: doublePrecision().notNull(),
		ascentM: doublePrecision().notNull(),
		descentM: doublePrecision().notNull(),
		durationS: doublePrecision().notNull(),
		minEleM: doublePrecision().notNull(),
		maxEleM: doublePrecision().notNull(),

		/** Direkt für map.fitBounds — vier Zahlen statt ein Polygon je Zeile. */
		minLon: doublePrecision().notNull(),
		minLat: doublePrecision().notNull(),
		maxLon: doublePrecision().notNull(),
		maxLat: doublePrecision().notNull(),

		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('tours_owner_updated_idx').on(t.ownerId, t.updatedAt.desc()),
		index('tours_owner_activity_idx').on(t.ownerId, t.activityType),
		// Für den Regionsfilter aus 6.5 und später ST_DWithin auf POIs.
		index('tours_geom_idx').using('gist', t.geom),
		check('tours_visibility_check', sql`${t.visibility} in ('private', 'instance')`)
	]
);

export type TourRow = typeof tours.$inferSelect;

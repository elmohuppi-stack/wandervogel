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

/**
 * Nutzer und Rollen (Anforderungen 6.1).
 *
 * `role` ist wie `activityType` bewusst `text` mit CHECK statt pg-Enum —
 * ein Enum zu erweitern ist in Postgres eine Migration, und die Rolle
 * `guest` steht in 6.1 bereits als KANN in Aussicht.
 *
 * `active` statt Löschen: 6.1 verlangt „deaktivieren", nicht „entfernen".
 * Ein gelöschter Nutzer nähme seine Touren mit oder hinterließe verwaiste
 * Zeilen; ein deaktivierter behält beides und kommt nur nicht mehr herein.
 */
export const users = pgTable(
	'users',
	{
		id: uuid().primaryKey().default(sql`gen_random_uuid()`),

		/**
		 * Anmeldename. Klein geschrieben gespeichert, damit „Elmar" und
		 * „elmar" nicht zwei Konten sind — die Groß-/Kleinschreibung beim
		 * Anmelden ist eine Fehlerquelle ohne jeden Nutzen.
		 */
		username: text().notNull().unique(),

		/** Anzeigename, so wie die Person geschrieben werden will. */
		displayName: text().notNull(),

		/**
		 * scrypt aus node:crypto, Format `scrypt$N$r$p$salt$hash` (base64url).
		 *
		 * Kein argon2 und kein bcrypt: beide sind native Module mit
		 * Build-Schritt. Auf einem Host mit 3,7 GB und elf Apps ist eine
		 * Abhängigkeit, die beim Deploy kompiliert, ein Risiko ohne Gegenwert
		 * — scrypt ist in Node eingebaut und für Passwörter zugelassen.
		 * Die Parameter stehen im Hash, damit sie sich später erhöhen lassen,
		 * ohne alte Passwörter ungültig zu machen.
		 */
		passwordHash: text().notNull(),

		role: text().$type<'admin' | 'user'>().notNull().default('user'),

		/** Deaktivierte Nutzer kommen nicht herein; ihre Touren bleiben. */
		active: text().$type<'yes' | 'no'>().notNull().default('yes'),

		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		check('users_role_check', sql`${t.role} in ('admin', 'user')`),
		check('users_active_check', sql`${t.active} in ('yes', 'no')`)
	]
);

export type UserRow = typeof users.$inferSelect;

/**
 * Sitzungen in der Datenbank, nicht als JWT.
 *
 * Der Grund steht in 6.1: ein Admin muss einen Nutzer **deaktivieren**
 * können. Ein signiertes Token lässt sich bis zum Ablauf nicht zurückrufen
 * — der deaktivierte Nutzer arbeitete weiter, und das Häkchen in der
 * Verwaltung wäre eine Lüge. Eine Sitzungszeile ist mit einem DELETE weg.
 *
 * Gespeichert wird der SHA-256 der Kennung, nicht die Kennung selbst. Wer
 * die Tabelle liest, kann sich damit nicht anmelden.
 */
export const sessions = pgTable(
	'sessions',
	{
		/** SHA-256 des Cookie-Werts, hex. */
		tokenHash: text().primaryKey(),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: timestamp({ withTimezone: true }).notNull(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('sessions_user_idx').on(t.userId)]
);

export const tours = pgTable(
	'tours',
	{
		id: uuid().primaryKey().default(sql`gen_random_uuid()`),

		/**
		 * Stand von Tag eins da, als es noch keine Anmeldung gab, und jede
		 * Abfrage filterte darauf. Die Rechnung ist aufgegangen: für die
		 * Anmeldung war hier nur der Fremdschlüssel zu ergänzen, und in
		 * hooks.server.ts wurde eine Konstante durch die Sitzung ersetzt.
		 *
		 * `onDelete: 'restrict'` mit Absicht — 6.1 kennt Deaktivieren, nicht
		 * Löschen. Wer einen Nutzer doch entfernen will, muss sich vorher
		 * entscheiden, was mit seinen Touren geschieht.
		 */
		ownerId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),

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

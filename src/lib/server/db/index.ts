/**
 * Verbindung zur Datenbank.
 *
 * `$env/dynamic/private`, nicht `static`: sonst würde die Verbindungsurl in
 * das Docker-Image gebacken und ließe sich im Betrieb nicht mehr ändern.
 */

import { env } from '$env/dynamic/private';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

if (!env.DATABASE_URL) {
	throw new Error('DATABASE_URL fehlt. Steht sie in .env? Vorlage: .env.example');
}

/**
 * In der Entwicklung wird der Klient am globalen Objekt geparkt.
 *
 * Vite lädt Servermodule bei jeder Änderung neu. Ohne diesen Halt entstünde
 * bei jedem Speichern ein frischer Verbindungspool, und nach etwa zwanzig
 * Änderungen wären Postgres' Verbindungen aufgebraucht.
 */
const globalForDb = globalThis as unknown as { __wvClient?: postgres.Sql };

const client =
	globalForDb.__wvClient ??
	postgres(env.DATABASE_URL, {
		// Zehn Verbindungen passen zur genannten Serverklasse (2–4 vCPU).
		max: 10,
		onnotice: () => {}
	});

if (import.meta.env.DEV) globalForDb.__wvClient = client;

export const db = drizzle(client, { schema });

/** Für die Abfragen, die rohes SQL brauchen — alles Geometrische. */
export { client as sql };

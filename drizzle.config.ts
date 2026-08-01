import { defineConfig } from 'drizzle-kit';

// DATABASE_URL kommt aus .env, geladen von den make-Zielen — kein dotenv als
// Abhängigkeit. `make db-*` macht `set -a; . ./.env; set +a`, genau wie
// `make preview`.
if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL fehlt. Aufruf über `make db-migrate`, nicht direkt.');
}

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dbCredentials: { url: process.env.DATABASE_URL },

	/**
	 * Diese beiden Filter sind die einzige Stelle im Projekt, die Daten
	 * zerstören kann.
	 *
	 * Das PostGIS-Image bringt die Erweiterungen postgis_tiger_geocoder und
	 * postgis_topology mit, dazu die Schemata tiger, tiger_data, topology und
	 * die Tabelle spatial_ref_sys. Nachgemessen, sie sind wirklich da. Ohne
	 * die Filter hält drizzle-kit sie für verwaistes Zeug aus einem alten
	 * Schema und schlägt vor, alles zu löschen — und mit ihm die
	 * PostGIS-Installation.
	 */
	schemaFilter: ['public'],
	extensionsFilters: ['postgis'],

	casing: 'snake_case',
	verbose: true,
	strict: true
});

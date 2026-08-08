/**
 * Migrationen anwenden — auch im Produktionsbild.
 *
 * **Warum nicht `drizzle-kit migrate`.** `drizzle-kit` ist eine
 * Entwicklungsabhängigkeit und liegt im Produktionsbild nicht. Es dorthin zu
 * holen hieße, das halbe Build-Werkzeug mitzuschleppen.
 *
 * `drizzle-orm` dagegen ist Laufzeitabhängigkeit — ohne sie startet der Server
 * gar nicht — und bringt denselben Migrator mit. Er liest dasselbe
 * `drizzle/`-Verzeichnis und dieselbe `meta/_journal.json`, führt dieselbe
 * Tabelle `__drizzle_migrations` und ist damit austauschbar mit dem, was
 * `make db-migrate` lokal tut.
 *
 * **Als eigener Schritt und nicht beim Start des Servers.** Migrationen beim
 * Hochfahren auszuführen sieht bequem aus, verschiebt aber einen Fehler in
 * den Startvorgang: die App käme dann gar nicht hoch, und man sucht in den
 * Serverlogs statt in einer Ausgabe, die man angefordert hat. Ein eigener
 * Schritt scheitert dort, wo man hinschaut.
 *
 *   Entwicklung:  make db-migrate
 *   Server:       docker compose -f docker-compose.prod.yml run --rm app \
 *                   node scripts/migrate.mjs
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
	console.error('DATABASE_URL fehlt.');
	process.exit(1);
}

// `max: 1` ist Pflicht, nicht Sparsamkeit: der Migrator nimmt eine
// Beratungssperre, und die gilt je Verbindung. Mit einem Pool könnte ein
// späteres Statement auf einer anderen Verbindung landen als die Sperre.
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

try {
	const vorher = await angewandt(sql);
	await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
	const nachher = await angewandt(sql);

	const neu = nachher - vorher;
	console.log(
		neu === 0
			? `✓ Keine offenen Migrationen (${nachher} bereits angewandt).`
			: `✓ ${neu} Migration(en) angewandt, jetzt ${nachher} insgesamt.`
	);
} catch (e) {
	console.error('✗ Migration fehlgeschlagen:', e.message);
	process.exitCode = 1;
} finally {
	await sql.end();
}

/** Wie viele Migrationen sind bereits verbucht? Vor dem ersten Lauf: keine Tabelle. */
async function angewandt(sql) {
	const [z] = await sql`
		select count(*)::int as n
		from information_schema.tables
		where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
	`;
	if (z.n === 0) return 0;
	const [r] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
	return r.n;
}

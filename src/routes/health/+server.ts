import { sql } from '$lib/server/db';
import type { RequestHandler } from './$types';

/**
 * Healthcheck für Docker und den Betrieb.
 *
 * **Er prüft die Datenbankverbindung mit, und das ist der ganze Punkt.**
 * Ein Endpunkt, der nur „der Prozess lebt" meldet, ist im einzigen Moment
 * nutzlos, in dem man ihn braucht: knoras `/health` tat genau das und
 * antwortete während eines Umschaltfensters mit `ok`, während die App
 * 500er auslieferte (OFFENE-PROBLEME 21).
 *
 * Ohne Anmeldung erreichbar — Docker bringt kein Sitzungscookie mit.
 * Deshalb steht `/health` in der Erlaubnisliste von hooks.server.ts, und
 * deshalb gibt er **nichts** preis: keine Versionen, keine Zählstände,
 * keine Fehlermeldung der Datenbank. Nur ob es geht.
 */
export const GET: RequestHandler = async () => {
	try {
		// `select 1` und kein Tabellenzugriff: der Healthcheck soll die
		// Verbindung prüfen, nicht das Schema — sonst meldet er rot, während
		// eine Migration läuft.
		await sql`select 1`;
	} catch {
		return new Response(JSON.stringify({ status: 'degraded', db: false }), {
			status: 503,
			headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
		});
	}

	return new Response(JSON.stringify({ status: 'ok', db: true }), {
		status: 200,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
	});
};

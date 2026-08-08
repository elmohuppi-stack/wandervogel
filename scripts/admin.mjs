/**
 * Legt einen Admin an — der einzige Weg in eine frische Installation.
 *
 * Selbstregistrierung gibt es laut Anforderungen 6.1 nicht (Standard: aus),
 * also braucht es eine Tür von außen. Sie führt über die Datenbank und
 * nicht über die HTTP-API, denn die verlangt eine Sitzung, die es ohne
 * ersten Nutzer nicht geben kann.
 *
 * Das Hashen kommt aus `src/lib/server/password.ts` — dieselbe Funktion,
 * die die App benutzt. Node 22 strippt Typen von selbst, deshalb lässt sich
 * das Modul hier direkt importieren, statt das Format nachzubauen.
 *
 *   make db-admin NAME=elmar PASS='…' ANZEIGE='Elmar Hepp'
 *
 * Ist der Nutzer schon da, wird sein Passwort neu gesetzt und die Rolle auf
 * admin gehoben — damit ist das Skript zugleich die Notbremse für ein
 * vergessenes Admin-Passwort.
 */

import postgres from 'postgres';
import { hashPassword, pruefePasswort } from '../src/lib/server/password.ts';
import { normalizeUsername, pruefeUsername } from '../src/lib/server/username.ts';

const UEBERNAHME_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Passwort verdeckt abfragen.
 *
 * **Warum nicht als Umgebungsvariable.** `PASS=…` steht in der Shell-History,
 * im Prozessbaum (`ps`) und je nach Setup im Auditlog. Über SSH kommt dazu,
 * dass die äußeren Anführungszeichen des `ssh host '…'` mit den inneren
 * kollidieren — man baut dann Zitatakrobatik, bei der ein Passwort mit
 * Sonderzeichen still falsch ankommt.
 *
 * `PASS` bleibt trotzdem erlaubt: die Prüfskripte brauchen einen Weg ohne
 * Eingabe. Aber es ist nicht mehr der empfohlene.
 */
function frageVerdeckt(text) {
	return new Promise((resolve, reject) => {
		const ein = process.stdin;
		if (!ein.isTTY) {
			reject(new Error('Kein Terminal — Passwort über PASS= übergeben oder mit -it aufrufen.'));
			return;
		}
		process.stdout.write(text);
		ein.setRawMode(true);
		ein.resume();
		ein.setEncoding('utf8');

		let wert = '';
		const beenden = () => {
			ein.setRawMode(false);
			ein.pause();
			ein.removeListener('data', aufZeichen);
			process.stdout.write('\n');
		};
		const aufZeichen = (z) => {
			for (const ch of z) {
				if (ch === '\r' || ch === '\n') {
					beenden();
					resolve(wert);
					return;
				}
				if (ch === '\u0003') {
					// Strg-C: abbrechen, ohne das Terminal im Rohmodus zu hinterlassen.
					beenden();
					process.exit(130);
				}
				if (ch === '\u007f' || ch === '\b') wert = wert.slice(0, -1);
				else if (ch >= ' ') wert += ch;
			}
		};
		ein.on('data', aufZeichen);
	});
}

const name = normalizeUsername(process.env.NAME ?? process.argv[2] ?? '');
const anzeige = (process.env.ANZEIGE ?? process.argv[3] ?? '').trim() || name;

if (!name) {
	// Ohne eckige Klammern: `[ANZEIGE=…]` ist in zsh ein Dateimuster und
	// scheitert beim Kopieren mit „no matches found".
	console.error('Der Anmeldename fehlt. Das Passwort wird verdeckt abgefragt.');
	console.error('');
	console.error('Auf dem Entwicklungsrechner:');
	console.error("  make db-admin NAME=elmar ANZEIGE='Elmar Hepp'");
	console.error('');
	console.error('Im laufenden Container auf dem Server:');
	console.error('  docker compose -f docker-compose.prod.yml exec -it wandervogel \\');
	console.error("    node scripts/admin.mjs elmar 'Elmar Hepp'");
	console.error('');
	console.error('Der Anzeigename ist optional; ohne Angabe wird der Anmeldename genommen.');
	process.exit(1);
}
const namensfehler = pruefeUsername(name);
if (namensfehler) {
	console.error(namensfehler);
	process.exit(1);
}

let pass = process.env.PASS ?? '';
if (!pass) {
	pass = await frageVerdeckt(`Passwort für „${name}": `);
	const wiederholung = await frageVerdeckt('Zur Sicherheit noch einmal:  ');
	if (pass !== wiederholung) {
		console.error('Die beiden Eingaben sind nicht gleich.');
		process.exit(1);
	}
}

const passfehler = pruefePasswort(pass);
if (passfehler) {
	console.error(passfehler);
	process.exit(1);
}
if (!process.env.DATABASE_URL) {
	console.error('DATABASE_URL fehlt — über `make db-admin` aufrufen, nicht direkt.');
	process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

try {
	const hash = await hashPassword(pass);

	const [nutzer] = await sql`
		insert into users (username, display_name, password_hash, role, active)
		values (${name}, ${anzeige}, ${hash}, 'admin', 'yes')
		on conflict (username) do update
			set password_hash = excluded.password_hash,
			    role          = 'admin',
			    active        = 'yes',
			    updated_at    = now()
		returning id, (xmax = 0) as neu
	`;

	console.log(nutzer.neu ? `✓ Admin „${name}" angelegt.` : `✓ Admin „${name}" aktualisiert.`);

	// Alle offenen Sitzungen beenden: bei einem zurückgesetzten Passwort ist
	// genau das der Zweck des Aufrufs.
	if (!nutzer.neu) await sql`delete from sessions where user_id = ${nutzer.id}`;

	/*
	 * Touren aus der Zeit vor der Anmeldung übernehmen.
	 *
	 * Migration 0001 hat für die alte Eigentümer-Konstante ein gesperrtes
	 * Übergangskonto angelegt, damit der Fremdschlüssel hält. Hier geht sein
	 * Bestand an den ersten echten Admin über, danach ist es entbehrlich.
	 */
	const [uebergang] = await sql`select id from users where id = ${UEBERNAHME_ID}`;
	if (uebergang && nutzer.id !== UEBERNAHME_ID) {
		const verschoben = await sql`
			update tours set owner_id = ${nutzer.id} where owner_id = ${UEBERNAHME_ID} returning id
		`;
		await sql`delete from users where id = ${UEBERNAHME_ID}`;
		console.log(
			verschoben.length > 0
				? `✓ ${verschoben.length} Tour(en) aus der Zeit vor der Anmeldung übernommen.`
				: '✓ Übergangskonto entfernt, es hielt keine Touren.'
		);
	}

	const [{ count }] = await sql`select count(*)::int as count from users where active = 'yes'`;
	console.log(`  ${count} aktive(r) Nutzer insgesamt.`);
} catch (e) {
	console.error('✗ Fehlgeschlagen:', e.message);
	process.exitCode = 1;
} finally {
	await sql.end();
}

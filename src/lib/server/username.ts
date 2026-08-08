/**
 * Der Anmeldename: normalisieren und prüfen.
 *
 * **Diese Datei importiert nichts** — kein `$app`, kein `$env`, keine
 * Datenbank. Aus demselben Grund wie `password.ts`: `data/admin.mjs` legt
 * den ersten Admin außerhalb von SvelteKit an und braucht dieselbe Regel.
 * Node 22 strippt Typen von selbst, also kann das Skript hier direkt
 * importieren.
 *
 * Die Regel stand vorher an zwei Stellen — im Skript und in der Verwaltung —
 * und die beiden liefen sofort auseinander: `elmar.hepp@gmail.com` wurde
 * abgelehnt, obwohl Anforderungen 6.1 „Login mit Benutzername **oder
 * E-Mail**" verlangt. Genau dafür gibt es dieses Modul.
 */

/** Mindestlänge. Kürzer ist kein Name, sondern ein Tippfehler. */
export const MIN_LAENGE = 3;

/**
 * Erlaubte Zeichen.
 *
 * `@` und `+` sind dabei, weil eine E-Mail-Adresse ein gültiger Anmeldename
 * ist — inklusive der Plus-Adressierung, die viele Anbieter kennen. Nicht
 * dabei ist alles, was in einer URL, einem Cookie oder einer Meldung
 * überrascht: Leerzeichen, Anführungszeichen, Schrägstriche.
 */
const ERLAUBT = /^[a-z0-9._+@-]+$/;

/**
 * Kleinschreiben ist keine Kosmetik, sondern die Identität des Kontos.
 *
 * „Elmar" und „elmar" sollen dasselbe Konto sein — der Unterschied beim
 * Anmelden ist eine Fehlerquelle ohne jeden Nutzen. Bei E-Mail-Adressen
 * behandeln praktisch alle Anbieter den lokalen Teil ohnehin unabhängig
 * von der Groß- und Kleinschreibung.
 */
export const normalizeUsername = (s: string) => s.trim().toLowerCase();

/** Gibt die Fehlermeldung zurück — oder `null`, wenn der Name taugt. */
export function pruefeUsername(roh: string): string | null {
	const name = normalizeUsername(roh);
	if (name.length < MIN_LAENGE) {
		return `Benutzername braucht mindestens ${MIN_LAENGE} Zeichen.`;
	}
	if (!ERLAUBT.test(name)) {
		return 'Benutzername: nur Buchstaben, Ziffern und . _ - + @ — eine E-Mail-Adresse geht.';
	}
	return null;
}

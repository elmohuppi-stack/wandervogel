/**
 * Eigentümerschaft, solange es noch keine Anmeldung gibt.
 *
 * Die Spalte `owner_id` steht von Tag eins in der Tabelle und jede Abfrage
 * filtert darauf. Eine `users`-Tabelle ohne Passwort- und Sitzungsspalten
 * wäre dagegen eine Attrappe, die zu halbfertiger Anmeldung einlädt.
 *
 * Wenn die Anmeldung kommt (Anforderungen 6.1), liest hooks.server.ts die
 * Sitzung statt dieser Konstanten. Kein Aufrufer ändert sich.
 */
export const SINGLE_OWNER_ID = '00000000-0000-4000-8000-000000000001';

import { randomBytes } from 'node:crypto';
import { fail, redirect } from '@sveltejs/kit';
import {
	createSession,
	hashPassword,
	pruneSessions,
	setSessionCookie,
	verifyPassword
} from '$lib/server/auth';
import { findByUsername } from '$lib/server/db/users';
import { toDbError } from '$lib/server/db/errors';
import type { Actions, PageServerLoad } from './$types';

/**
 * Anmeldung (Anforderungen 6.1).
 *
 * Als Formularaktion und nicht als `fetch`: so funktioniert die Anmeldung
 * auch ohne JavaScript, und der Browser bietet das Passwort zum Speichern
 * an — bei einem XHR-Login tut er das nicht zuverlässig.
 */

export const load: PageServerLoad = async ({ url }) => ({
	weiter: url.searchParams.get('weiter') ?? '/'
});

/**
 * Wohin nach dem Anmelden.
 *
 * Nur eigene, absolute Pfade. Ohne diese Prüfung wäre `?weiter=` eine
 * offene Weiterleitung: ein Link auf die eigene Anmeldeseite, der danach
 * auf einer fremden Seite landet — die klassische Phishing-Brücke.
 */
function sicheresZiel(roh: FormDataEntryValue | null): string {
	const s = typeof roh === 'string' ? roh : '';
	// `//host` und `/\host` sind für den Browser absolute Adressen.
	if (!s.startsWith('/') || s.startsWith('//') || s.startsWith('/\\')) return '/';
	return s;
}

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const daten = await request.formData();
		const username = String(daten.get('username') ?? '');
		const passwort = String(daten.get('passwort') ?? '');
		const weiter = sicheresZiel(daten.get('weiter'));

		if (!username.trim() || !passwort) {
			return fail(400, { fehler: 'Benutzername und Passwort ausfüllen.', username });
		}

		try {
			const nutzer = await findByUsername(username);

			/*
			 * Die Prüfung läuft auch ohne Treffer durch.
			 *
			 * Sonst antwortete ein unbekannter Name in Millisekunden und ein
			 * bekannter erst nach dem scrypt-Lauf — daraus ließe sich die
			 * Liste der Konten ablesen. Der Vergleichswert ist ein gültiger,
			 * aber unerreichbarer Hash mit denselben Kosten.
			 */
			const hash = nutzer?.passwordHash ?? (await dummyHash());
			const stimmt = await verifyPassword(passwort, hash);

			// Eine einzige Meldung für alle drei Fälle: Name unbekannt,
			// Passwort falsch, Konto deaktiviert. Wer von außen probiert, soll
			// nicht erfahren, welcher davon zutrifft.
			if (!nutzer || !stimmt || nutzer.active !== 'yes') {
				return fail(400, { fehler: 'Benutzername oder Passwort stimmt nicht.', username });
			}

			await pruneSessions();
			const { token, expiresAt } = await createSession(nutzer.id);
			setSessionCookie(cookies, token, expiresAt);
		} catch (e) {
			const fehler = toDbError(e);
			return fail(503, { fehler: fehler.message, username });
		}

		redirect(303, weiter);
	}
};

/**
 * Ein echter Hash mit den aktuellen Kosten, dessen Passwort niemand kennt —
 * 32 zufällige Bytes, die beim Erzeugen verworfen werden.
 *
 * Bewusst berechnet und nicht als Zeichenkette hier hineingeschrieben: ein
 * abgetippter Hash mit falscher Länge oder falschen Kostenparametern ließe
 * `verifyPassword` sofort aussteigen, statt zu rechnen. Genau das wollte
 * dieser Wert verhindern — und der Fehler wäre unsichtbar, weil das
 * Ergebnis (`false`) ja richtig bliebe.
 *
 * Einmal je Prozess, beim ersten unbekannten Benutzernamen.
 */
let dummy: Promise<string> | undefined;
const dummyHash = () => (dummy ??= hashPassword(randomBytes(32).toString('hex')));

import { redirect, type Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	clearSessionCookie,
	readSession,
	setSessionCookie
} from '$lib/server/auth';
import { grenzeFuer, pruefe } from '$lib/server/ratelimit';

/**
 * Sitzung lesen, Zugang regeln, Gäste bremsen.
 *
 * **Die Regel in einem Satz:** Planen darf jeder, behalten nur, wer
 * angemeldet ist.
 *
 * Bis zum 8. August 2026 war alles hinter der Anmeldung. Davor stand hier
 * eine Konstante, und jeder Besucher war derselbe Nutzer. Die heutige
 * Fassung ist der dritte Zustand und der einzige, in dem beides zugleich
 * gilt: die App ist ohne Konto benutzbar, und niemand kommt an fremde Daten.
 *
 * Der Schutz liegt hier und nicht in den einzelnen Routen. Eine vergessene
 * Prüfung in einem neuen Endpunkt wäre ein offenes Schreib-API; eine
 * Erlaubnisliste, die man ergänzen *muss*, fällt dagegen sofort auf — die
 * neue Seite leitet zur Anmeldung um, solange sie nicht drinsteht.
 */

/**
 * Seiten ohne Konto.
 *
 * `/planen` ohne Kennung ist die leere Planungsfläche — sie braucht keine
 * gespeicherten Daten. `/planen/<id>` lädt dagegen eine bestimmte Tour und
 * bleibt deshalb geschützt; darum exakter Vergleich statt Präfix.
 *
 * Impressum und Datenschutz sind nicht bloß erlaubt, sondern müssen offen
 * sein: § 5 DDG verlangt „ständig verfügbar", und eine Anbieterkennzeichnung
 * hinter einer Anmeldung ist keine.
 */
const OFFENE_SEITEN = new Set([
	'/',
	'/planen',
	'/anmelden',
	'/impressum',
	'/datenschutz',
	// Docker bringt kein Sitzungscookie mit. Der Endpunkt gibt nichts preis
	// außer „geht" oder „geht nicht" — siehe routes/health.
	'/health'
]);

/**
 * Endpunkte ohne Konto — genau die, die der Planer zum Arbeiten braucht.
 *
 * `/api/tours` fehlt hier mit Absicht: gespeicherte Touren sind der eine
 * Teil, für den es ein Konto braucht.
 */
const OFFENE_API = ['/api/route', '/api/routen', '/api/dem/', '/api/suche'];

/** Nur für Admins. Präfixe, damit Unterseiten mitgeschützt sind. */
const NUR_ADMIN = ['/verwaltung'];

const istOffen = (pfad: string) =>
	OFFENE_SEITEN.has(pfad) || OFFENE_API.some((p) => pfad.startsWith(p));

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	const sitzung = await readSession(token);
	const pfad = event.url.pathname;

	if (sitzung) {
		event.locals.user = sitzung.user;
		event.locals.ownerId = sitzung.user.id;

		// Gleitende Verlängerung: readSession hat die Zeile schon
		// weitergeschrieben, das Cookie muss nachziehen.
		if (sitzung.verlaengertBis) setSessionCookie(event.cookies, token!, sitzung.verlaengertBis);
	} else if (token) {
		// Abgelaufen, zurückgezogen oder Nutzer deaktiviert: das Cookie ist
		// wertlos und gehört weg, sonst schleppt der Browser es 90 Tage mit.
		clearSessionCookie(event.cookies);
	}

	/*
	 * Gäste bremsen, Angemeldete nicht.
	 *
	 * Hinter den offenen Endpunkten liegen der eigene Router auf einem
	 * kleinen Server und fremde Fair-Use-Dienste. Der Nutzerkreis mit Konto
	 * ist bekannt und klein; das offene Netz ist es nicht.
	 */
	if (!sitzung) {
		const g = grenzeFuer(pfad);
		if (g) {
			const { erlaubt, wartenS } = pruefe(`${event.getClientAddress()}|${g.praefix}`, g.grenze);
			if (!erlaubt) {
				return new Response(
					JSON.stringify({
						error: 'Zu viele Anfragen. Mit einem Konto gibt es diese Grenze nicht.',
						kind: 'rate-limited'
					}),
					{
						status: 429,
						headers: { 'content-type': 'application/json', 'retry-after': String(wartenS) }
					}
				);
			}
		}
	}

	if (!sitzung && !istOffen(pfad)) {
		// API-Anfragen bekommen 401 statt einer Umleitung — ein `fetch`, das
		// stillschweigend die HTML-Anmeldeseite als Antwort erhält, ist der
		// Fehler, den man am längsten sucht.
		if (pfad.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Nicht angemeldet', kind: 'unauthenticated' }), {
				status: 401,
				headers: { 'content-type': 'application/json' }
			});
		}
		// Wohin der Besucher wollte, kommt mit — nach dem Anmelden landet er
		// dort und nicht auf der Startseite.
		redirect(303, `/anmelden?weiter=${encodeURIComponent(pfad + event.url.search)}`);
	}

	if (sitzung && NUR_ADMIN.some((p) => pfad.startsWith(p)) && sitzung.user.role !== 'admin') {
		redirect(303, '/');
	}

	// Ein Gast auf /verwaltung soll sich anmelden können, nicht auf der
	// Startseite landen — deshalb steht das nach der Umleitung oben.
	if (sitzung && pfad === '/anmelden') redirect(303, '/');

	return resolve(event);
};

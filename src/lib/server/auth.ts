/**
 * Sitzungen (Anforderungen 6.1).
 *
 * Das Hashen der Passwörter steht bewusst nebenan in `password.ts`, weil
 * `data/admin.mjs` es außerhalb von SvelteKit braucht. Hier wird es nur
 * durchgereicht, damit Aufrufer eine Anlaufstelle haben.
 *
 * **Sitzungen in der Datenbank, kein JWT.** 6.1 verlangt, dass ein Admin
 * einen Nutzer *deaktivieren* kann. Ein signiertes Token gilt bis zum
 * Ablauf weiter — der deaktivierte Nutzer arbeitete also weiter, und das
 * Häkchen in der Verwaltung wäre eine Lüge. Eine Sitzungszeile ist mit
 * einem DELETE weg.
 */

import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';
import { db } from './db';
import { sessions, users, type UserRow } from './db/schema';

export { hashPassword, verifyPassword } from './password';

/* --- Sitzungen ----------------------------------------------------------- */

export const SESSION_COOKIE = 'wv_session';

/**
 * Neunzig Tage. 6.1 verlangt, dass die Sitzung „auf dem Handy erhalten
 * bleibt" — eine Feldansicht, die einen mitten in der Tour ausloggt, wäre
 * genau der Ärger, den diese App vermeiden soll.
 */
const LAUFZEIT_MS = 90 * 24 * 60 * 60 * 1000;

/** Ab wann eine benutzte Sitzung verlängert wird: wenn die Hälfte um ist. */
const VERLAENGERN_AB_MS = LAUFZEIT_MS / 2;

/** Gespeichert wird der Abdruck, nie die Kennung selbst. Wer die Tabelle
 *  liest, kann sich damit nicht anmelden. */
const abdruck = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(Date.now() + LAUFZEIT_MS);
	await db.insert(sessions).values({ tokenHash: abdruck(token), userId, expiresAt });
	return { token, expiresAt };
}

export interface SessionUser {
	id: string;
	username: string;
	displayName: string;
	role: 'admin' | 'user';
}

const alsSessionUser = (u: UserRow): SessionUser => ({
	id: u.id,
	username: u.username,
	displayName: u.displayName,
	role: u.role
});

/**
 * Liest die Sitzung und gibt den Nutzer zurück — oder `null`.
 *
 * Prüft in einem Zug mit: ist die Sitzung abgelaufen, und ist der Nutzer
 * noch aktiv. Der zweite Teil ist der Grund für die ganze Tabelle: ein
 * deaktivierter Nutzer ist mit der nächsten Anfrage draußen, nicht erst in
 * neunzig Tagen.
 */
export async function readSession(
	token: string | undefined
): Promise<{ user: SessionUser; verlaengertBis: Date | null } | null> {
	if (!token) return null;

	const [treffer] = await db
		.select({ user: users, expiresAt: sessions.expiresAt })
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(and(eq(sessions.tokenHash, abdruck(token)), gt(sessions.expiresAt, new Date())))
		.limit(1);

	if (!treffer || treffer.user.active !== 'yes') return null;

	// Gleitende Verlängerung, aber nicht bei jeder Anfrage — sonst wäre jeder
	// Seitenaufruf ein Schreibvorgang.
	let verlaengertBis: Date | null = null;
	if (treffer.expiresAt.getTime() - Date.now() < VERLAENGERN_AB_MS) {
		verlaengertBis = new Date(Date.now() + LAUFZEIT_MS);
		await db
			.update(sessions)
			.set({ expiresAt: verlaengertBis })
			.where(eq(sessions.tokenHash, abdruck(token)));
	}

	return { user: alsSessionUser(treffer.user), verlaengertBis };
}

export async function deleteSession(token: string | undefined): Promise<void> {
	if (!token) return;
	await db.delete(sessions).where(eq(sessions.tokenHash, abdruck(token)));
}

/**
 * Alle Sitzungen eines Nutzers beenden.
 *
 * Aufgerufen beim Deaktivieren, beim Rollenwechsel und beim Zurücksetzen
 * des Passworts. Ohne das behielte ein herabgestufter Admin seine Rechte
 * bis zum nächsten Anmelden — die Rolle steckt zwar nicht im Cookie, aber
 * ein offener Browser hätte die Verwaltungsseite noch im Zustand.
 */
export async function deleteSessionsOfUser(userId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Abgelaufene Sitzungen wegräumen. Aufgerufen beim Anmelden — das ist
 *  selten genug und braucht keinen eigenen Zeitgeber. */
export async function pruneSessions(): Promise<void> {
	await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/**
 * Das Sitzungscookie setzen — an einer Stelle, damit die Sicherheitsflaggen
 * nicht zwischen Anmelden und Verlängern auseinanderlaufen.
 *
 * `httpOnly`, weil JavaScript die Kennung nie braucht — ein XSS-Fund kann
 * die Sitzung damit nicht auslesen. `sameSite: 'lax'` lässt normale
 * Verweise von außen zu, aber keine fremden Formulare; das ist zugleich
 * der CSRF-Schutz für die Formularaktionen dieser App.
 */
export function setSessionCookie(cookies: Cookies, token: string, expires: Date): void {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		expires
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

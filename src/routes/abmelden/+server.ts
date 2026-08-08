import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, clearSessionCookie, deleteSession } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/**
 * Abmelden.
 *
 * Nur POST. Ein Abmelden per GET wäre über ein `<img src="/abmelden">` auf
 * irgendeiner fremden Seite auslösbar — harmlos im Schaden, aber ärgerlich
 * genug, und die Regel „verändernde Aktionen brauchen POST" gilt hier ohne
 * Ausnahme.
 *
 * Die Sitzungszeile wird gelöscht und nicht nur das Cookie: sonst bliebe
 * die Kennung neunzig Tage gültig, falls sie jemand mitgeschnitten hat.
 */
export const POST: RequestHandler = async ({ cookies }) => {
	await deleteSession(cookies.get(SESSION_COOKIE));
	clearSessionCookie(cookies);
	redirect(303, '/anmelden');
};

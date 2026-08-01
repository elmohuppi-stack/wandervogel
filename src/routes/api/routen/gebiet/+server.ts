import { isActivityType } from '$lib/geo/activity';
import { WaymarkedError, routenImGebiet } from '$lib/server/waymarked';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Welche markierten Routen liegen im Kartenausschnitt?
 *
 * Die Antwort auf „woher soll ich die Namen kennen". `bbox` kommt in
 * Lon/Lat — die Umrechnung nach Web-Mercator, die der Dienst verlangt,
 * passiert im Servermodul.
 */
export const GET: RequestHandler = async ({ url, fetch }) => {
	const roh = url.searchParams.get('bbox');
	const a = url.searchParams.get('activityType');

	if (!isActivityType(a)) return json({ error: 'Unbekannte Aktivitätsart' }, { status: 400 });

	const n = (roh ?? '').split(',').map(Number);
	if (n.length !== 4 || !n.every(Number.isFinite) || n[0] >= n[2] || n[1] >= n[3]) {
		return json({ error: 'Ungültiger Kartenausschnitt' }, { status: 400 });
	}

	try {
		const { treffer, abgeschnitten } = await routenImGebiet(
			[n[0], n[1], n[2], n[3]],
			a,
			fetch
		);
		return json({ results: treffer, abgeschnitten });
	} catch (e) {
		if (e instanceof WaymarkedError) {
			return json({ error: e.message, kind: e.kind }, { status: 503 });
		}
		console.error('Gebietsabfrage fehlgeschlagen:', e);
		return json({ error: 'Unerwarteter Fehler' }, { status: 500 });
	}
};

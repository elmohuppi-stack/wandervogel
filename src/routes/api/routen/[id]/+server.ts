import { isActivityType } from '$lib/geo/activity';
import { WaymarkedError, holeRoute } from '$lib/server/waymarked';
import { thin } from '$lib/tour/uebernehmen';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Eine Route mit Geometrie.
 *
 * `vorschau=1` dünnt die Linie aus. Der Nibelungensteig hat 5485
 * Stützpunkte; zum Anschauen auf der Karte reichen 600, und die Antwort
 * bleibt klein. Zum Übernehmen holt die Oberfläche die volle Linie.
 */
export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const id = Number(params.id);
	const a = url.searchParams.get('activityType');

	if (!Number.isInteger(id) || id <= 0) {
		return json({ error: 'Ungültige Routenkennung' }, { status: 400 });
	}
	if (!isActivityType(a)) return json({ error: 'Unbekannte Aktivitätsart' }, { status: 400 });

	try {
		const route = await holeRoute(id, a, fetch);
		if (url.searchParams.get('vorschau') === '1') {
			return json({ route: { ...route, coordinates: thin(route.coordinates, 600) } });
		}
		return json({ route });
	} catch (e) {
		if (e instanceof WaymarkedError) {
			return json(
				{ error: e.message, kind: e.kind },
				{ status: e.kind === 'not_found' ? 404 : 503 }
			);
		}
		console.error('Route laden fehlgeschlagen:', e);
		return json({ error: 'Unerwarteter Fehler beim Laden der Route' }, { status: 500 });
	}
};

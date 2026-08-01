import { isActivityType } from '$lib/geo/activity';
import { WaymarkedError, sucheRouten } from '$lib/server/waymarked';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Markierte Routen nach Namen suchen — „Nibelungensteig", „EuroVelo 15". */
export const GET: RequestHandler = async ({ url, fetch }) => {
	const q = (url.searchParams.get('q') ?? '').trim();
	const a = url.searchParams.get('activityType');

	if (!isActivityType(a)) return json({ error: 'Unbekannte Aktivitätsart' }, { status: 400 });
	if (q.length < 3) return json({ results: [] });

	try {
		return json({ results: await sucheRouten(q, a, fetch) });
	} catch (e) {
		if (e instanceof WaymarkedError) {
			return json({ error: e.message, kind: e.kind }, { status: 503 });
		}
		console.error('Routensuche fehlgeschlagen:', e);
		return json({ error: 'Unerwarteter Fehler bei der Routensuche' }, { status: 500 });
	}
};

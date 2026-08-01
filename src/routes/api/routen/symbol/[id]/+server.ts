import { isActivityType } from '$lib/geo/activity';
import { WaymarkedError, holeSymbol } from '$lib/server/waymarked';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Das Markierungszeichen einer Route als SVG.
 *
 * Über den eigenen Server, damit der Browser keine Fremdanfrage stellt und
 * die Kennung gesetzt bleibt — dieselbe Regel wie bei Höhendaten und
 * Ortssuche. Die Zeichen ändern sich praktisch nie, deshalb ein Jahr
 * Gültigkeit.
 */
export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const a = url.searchParams.get('activityType');
	if (!isActivityType(a)) error(400, 'Unbekannte Aktivitätsart');

	// Die Kennungen sind maschinengemacht; alles andere wäre ein Versuch,
	// über den Pfad woanders hinzukommen.
	if (!/^[a-zA-Z0-9_-]{1,80}$/.test(params.id)) error(400, 'Ungültige Zeichenkennung');

	try {
		const svg = await holeSymbol(params.id, a, fetch);
		return new Response(svg, {
			headers: {
				'content-type': 'image/svg+xml; charset=utf-8',
				'cache-control': 'public, max-age=31536000, immutable'
			}
		});
	} catch (e) {
		if (e instanceof WaymarkedError) error(e.kind === 'not_found' ? 404 : 503, e.message);
		throw e;
	}
};

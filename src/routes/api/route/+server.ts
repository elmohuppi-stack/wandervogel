import { isActivityType } from '$lib/geo/activity';
import { BrouterError, calculateRoute } from '$lib/server/brouter';
import { parseWaypoints } from '$lib/tour/parse';
import type { Waypoint } from '$lib/tour/types';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Route aus Wegpunkten berechnen.
 *
 * Läuft über den Server, weil BRouter nicht ins Internet gehört und
 * ohnehin keine CORS-Header sendet.
 *
 * `parseWaypoints` liegt in $lib/tour/parse, weil das Speichern dieselbe
 * Prüfung braucht — und später der GPX-Import.
 */

interface RouteRequest {
	activityType: unknown;
	waypoints: unknown;
}

export const POST: RequestHandler = async ({ request, fetch }) => {
	let payload: RouteRequest;
	try {
		payload = (await request.json()) as RouteRequest;
	} catch {
		return json({ error: 'Ungültiges JSON' }, { status: 400 });
	}

	if (!isActivityType(payload.activityType)) {
		return json({ error: 'Unbekannte Aktivitätsart' }, { status: 400 });
	}

	let waypoints: Waypoint[];
	try {
		waypoints = parseWaypoints(payload.waypoints);
	} catch (e) {
		return json({ error: (e as Error).message }, { status: 400 });
	}

	if (waypoints.length < 2) {
		// Kein Fehler, sondern der Normalfall beim Setzen des ersten Punktes.
		return json({ route: null });
	}

	try {
		const route = await calculateRoute(waypoints, payload.activityType, fetch);
		return json({ route });
	} catch (e) {
		if (e instanceof BrouterError) {
			// 'unreachable' und 'no_data' sind Betriebsprobleme, nicht
			// Nutzerfehler — deshalb 503 statt 400, damit die Oberfläche
			// sie anders darstellen kann.
			const status = e.kind === 'unreachable' || e.kind === 'no_data' ? 503 : 422;
			return json({ error: e.message, kind: e.kind }, { status });
		}
		console.error('Routenberechnung fehlgeschlagen:', e);
		return json({ error: 'Unerwarteter Fehler bei der Routenberechnung' }, { status: 500 });
	}
};

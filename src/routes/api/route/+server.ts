import { isActivityType } from '$lib/geo/activity';
import { BrouterError, calculateRoute } from '$lib/server/brouter';
import type { Waypoint } from '$lib/tour/types';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Route aus Wegpunkten berechnen.
 *
 * Läuft über den Server, weil BRouter nicht ins Internet gehört und
 * ohnehin keine CORS-Header sendet.
 */

interface RouteRequest {
	activityType: unknown;
	waypoints: unknown;
}

function parseWaypoints(input: unknown): Waypoint[] {
	if (!Array.isArray(input)) throw new Error('waypoints muss ein Array sein');

	return input.map((w, i) => {
		const lon = Number((w as Waypoint)?.lon);
		const lat = Number((w as Waypoint)?.lat);

		if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
			throw new Error(`Wegpunkt ${i + 1}: ungültige Länge`);
		}
		if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
			throw new Error(`Wegpunkt ${i + 1}: ungültige Breite`);
		}

		const id = (w as Waypoint)?.id;
		return { id: typeof id === 'string' ? id : String(i), lon, lat };
	});
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

import { env } from '$env/dynamic/private';
import { activity, type ActivityType } from '$lib/geo/activity';
// deriveStats liegt in geo/stats, weil GPX-Import und OSM-Übernahme
// dieselbe Rechnung im Browser brauchen. Hier weiterhin exportiert, damit
// die Aufrufer sich nicht ändern müssen.
import { deriveStats } from '$lib/geo/stats';
export { deriveStats };
import type { RouteResult, Waypoint } from '$lib/tour/types';
import type { FeatureCollection } from 'geojson';

/**
 * BRouter-Anbindung.
 *
 * BRouter ist als Fahrrad-Router entstanden und später um Wanderprofile
 * erweitert worden — beide Aktivitätsarten laufen deshalb über *eine*
 * Engine, gesteuert allein durch die Profildatei aus der
 * Aktivitätsdefinition. Die Wegewertung (`sac_scale`, `trail_visibility`,
 * `surface`) steckt in diesen Profilen, nicht in unserem Code.
 *
 * Die Dauer rechnen wir bewusst selbst: BRouters `total-time` folgt einem
 * eigenen Modell, das wir dem Nutzer nicht erklären könnten. Die
 * Anforderung verlangt eine nachvollziehbare Formel.
 */

const BROUTER_URL = env.BROUTER_URL ?? 'http://localhost:17777';

export class BrouterError extends Error {
	constructor(
		message: string,
		readonly kind: 'unreachable' | 'no_route' | 'no_data' | 'bad_request'
	) {
		super(message);
		this.name = 'BrouterError';
	}
}

interface BrouterProperties {
	'track-length'?: string;
	'filtered ascend'?: string;
	'plain-ascend'?: string;
	'total-time'?: string;
	messages?: unknown;
}

/**
 * Welche BRouter-Kacheln dieser Zug braucht.
 *
 * BRouter teilt die Welt in 5°×5°-Felder, benannt nach ihrer Südwestecke:
 * `E10_N45` deckt 10–15° Ost und 45–50° Nord ab. Ohne diese Rechnung sagte
 * die Fehlermeldung nur, dass *irgendwas* fehlt — und man musste selbst
 * herausfinden, welches Feld. Der häufigste Fall ist genau einer: die Karte
 * zeigt die Alpen, geladen ist Südwestdeutschland.
 *
 * Es sind die Kacheln der Wegpunkte, nicht die des Wegs dazwischen. Für
 * eine Route quer über eine Feldgrenze kann also eine dritte fehlen; das
 * zu berechnen hieße, die Route zu kennen, die BRouter gerade nicht liefern
 * konnte.
 */
function fehlendeKacheln(waypoints: Waypoint[]): string {
	const feld = (n: number) => Math.floor(n / 5) * 5;
	const namen = new Set(
		waypoints.map((w) => {
			const lon = feld(w.lon);
			const lat = feld(w.lat);
			return `${lon < 0 ? 'W' + -lon : 'E' + lon}_${lat < 0 ? 'S' + -lat : 'N' + lat}`;
		})
	);
	return [...namen].join(', ');
}

export async function calculateRoute(
	waypoints: Waypoint[],
	activityType: ActivityType,
	fetchFn: typeof fetch = fetch
): Promise<RouteResult> {
	if (waypoints.length < 2) {
		throw new BrouterError('Mindestens zwei Wegpunkte nötig', 'bad_request');
	}

	const def = activity(activityType);

	// BRouter erwartet `lon,lat|lon,lat|…` — Länge zuerst, nicht Breite.
	const lonlats = waypoints.map((w) => `${w.lon.toFixed(6)},${w.lat.toFixed(6)}`).join('|');

	const url = new URL('/brouter', BROUTER_URL);
	url.searchParams.set('lonlats', lonlats);
	url.searchParams.set('profile', def.brouterProfile);
	url.searchParams.set('alternativeidx', '0');
	url.searchParams.set('format', 'geojson');

	let res: Response;
	try {
		res = await fetchFn(url, { signal: AbortSignal.timeout(30_000) });
	} catch (e) {
		throw new BrouterError(
			`Routing-Dienst nicht erreichbar (${BROUTER_URL}). Läuft der Container?`,
			'unreachable'
		);
	}

	const body = await res.text();

	// BRouter antwortet bei Fehlern mit Klartext statt GeoJSON — und
	// mitunter sogar mit Status 200. Deshalb wird der Inhalt geprüft,
	// nicht der Statuscode.
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		const msg = body.trim().slice(0, 300);
		if (/datafile.*not found|no data file/i.test(msg)) {
			throw new BrouterError(
				`Für dieses Gebiet fehlen die Routing-Segmente: ${fehlendeKacheln(waypoints)}. ` +
					`Laden mit: make segments ARGS=${fehlendeKacheln(waypoints).split(', ')[0]}`,
				'no_data'
			);
		}
		throw new BrouterError(msg || 'Keine Route gefunden', 'no_route');
	}

	const fc = parsed as FeatureCollection;
	const feature = fc?.features?.[0];

	if (!feature || feature.geometry?.type !== 'LineString') {
		throw new BrouterError('Antwort enthält keine Route', 'no_route');
	}

	const raw = feature.geometry.coordinates as number[][];
	if (raw.length < 2) {
		throw new BrouterError('Route ist leer', 'no_route');
	}

	// BRouter liefert `[lon, lat, ele]`. Fehlt die Höhe, wird 0 angenommen —
	// besser eine Route ohne Profil als gar keine.
	const coordinates: [number, number, number][] = raw.map((c) => [c[0], c[1], c[2] ?? 0]);

	return { ...deriveStats(coordinates, activityType), coordinates };
}


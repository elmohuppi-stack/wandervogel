/**
 * Kennzahlen aus einer Linie.
 *
 * Lag vorher in `server/brouter.ts` und war damit nur serverseitig
 * benutzbar. Es ist aber reine Rechnung ohne Serverbezug — und der Client
 * braucht sie, sobald eine Route nicht von BRouter kommt, sondern aus einer
 * GPX-Datei oder einer OSM-Relation.
 *
 * Die Dauer kommt bewusst nicht von außen: BRouters `total-time` folgt einem
 * eigenen Modell, das sich niemandem erklären lässt, und eine GPX-Datei
 * bringt gar keine. Die Anforderung verlangt eine nachvollziehbare Formel,
 * also rechnen wir sie überall selbst — mit demselben Code.
 */

import { activity, type ActivityType } from './activity';
import { toSegments, type RoutePoint } from './duration';

export interface RouteStats {
	distanceM: number;
	ascentM: number;
	descentM: number;
	minEleM: number;
	maxEleM: number;
	durationS: number;
}

export function deriveStats(
	coordinates: [number, number, number][],
	activityType: ActivityType
): RouteStats {
	const points: RoutePoint[] = coordinates.map(([lon, lat, ele]) => ({ lon, lat, ele }));
	const segments = toSegments(points);

	let distanceM = 0;
	let ascentM = 0;
	let descentM = 0;
	for (const s of segments) {
		distanceM += s.distanceM;
		if (s.ascentM > 0) ascentM += s.ascentM;
		else descentM += -s.ascentM;
	}

	const elevations = points.map((p) => p.ele);

	return {
		distanceM,
		ascentM,
		descentM,
		// Bei leerer Linie wären Math.min/max ±Infinity und würden als
		// Kennzahl durchgereicht.
		minEleM: elevations.length ? Math.min(...elevations) : 0,
		maxEleM: elevations.length ? Math.max(...elevations) : 0,
		durationS: activity(activityType).durationS(segments)
	};
}

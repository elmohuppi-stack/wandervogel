/**
 * Dauerberechnung — je Aktivitätsart ein Modell hinter derselben Signatur.
 *
 * Die Anforderung lautet "nachvollziehbare Formel, Parameter einstellbar".
 * Deshalb sind beide Modelle reine Funktionen mit offengelegten Parametern
 * und ohne Zugriff auf Datenbank, Netz oder globalen Zustand — so sind sie
 * direkt testbar und die Werte in der Oberfläche erklärbar.
 */

export interface RoutePoint {
	lon: number;
	lat: number;
	/** Höhe in Metern über Meer. */
	ele: number;
}

/** Eine Kante zwischen zwei Routenpunkten. */
export interface Segment {
	/** Horizontale Länge in Metern. */
	distanceM: number;
	/** Höhenunterschied in Metern, negativ bergab. */
	ascentM: number;
	/** OSM-`surface`, falls bekannt — beeinflusst nur das Radmodell. */
	surface?: SurfaceClass;
}

export type SurfaceClass = 'paved' | 'gravel' | 'forest' | 'path' | 'unknown';

/* ---------------------------------------------------------------------------
   Wandern — Methode des Deutschen Alpenvereins
   ---------------------------------------------------------------------------
   Getrennte Zeiten für Strecke und Steigung, davon die größere voll und die
   kleinere zur Hälfte. Das ist die verbreitete DAV/SAC-Rechnung und lässt
   sich einem Nutzer in einem Satz erklären.
   --------------------------------------------------------------------------- */

export interface HikeParams {
	/** Horizontales Gehtempo in km/h. */
	flatSpeedKmh: number;
	/** Steigleistung in Höhenmetern pro Stunde. */
	ascentMPerH: number;
	/** Abstiegsleistung in Höhenmetern pro Stunde. */
	descentMPerH: number;
}

export const HIKE_DEFAULTS: HikeParams = {
	flatSpeedKmh: 4,
	ascentMPerH: 300,
	descentMPerH: 500
};

export function hikeDurationS(segments: Segment[], p: HikeParams = HIKE_DEFAULTS): number {
	let distanceM = 0;
	let ascentM = 0;
	let descentM = 0;

	for (const s of segments) {
		distanceM += s.distanceM;
		if (s.ascentM > 0) ascentM += s.ascentM;
		else descentM += -s.ascentM;
	}

	const horizontalH = distanceM / 1000 / p.flatSpeedKmh;
	const verticalH = ascentM / p.ascentMPerH + descentM / p.descentMPerH;

	// Die größere Zeit voll, die kleinere zur Hälfte.
	const larger = Math.max(horizontalH, verticalH);
	const smaller = Math.min(horizontalH, verticalH);

	return (larger + smaller / 2) * 3600;
}

/* ---------------------------------------------------------------------------
   Radfahren — Geschwindigkeitsmodell
   ---------------------------------------------------------------------------
   Hier dominiert nicht die Steigung, sondern das Tempo: pro Segment ein
   Grundtempo, abgemindert durch Steigung und Untergrund. Bergab wird
   begrenzt schneller, weil Tourenradfahren keine Abfahrtsdisziplin ist.
   --------------------------------------------------------------------------- */

export interface BikeParams {
	/** Grundtempo auf flachem Asphalt in km/h. */
	baseSpeedKmh: number;
	/** Wie stark Steigung bremst. Höher = stärkere Abminderung. */
	climbPenalty: number;
	/** Wie stark Gefälle beschleunigt. */
	descentBonus: number;
	/** Obergrenze als Vielfaches des Grundtempos. */
	maxSpeedFactor: number;
	/** Untergrundfaktoren, 1 = wie Asphalt. */
	surfaceFactor: Record<SurfaceClass, number>;
}

export const BIKE_DEFAULTS: BikeParams = {
	baseSpeedKmh: 18,
	climbPenalty: 22,
	descentBonus: 6,
	maxSpeedFactor: 2.2,
	surfaceFactor: {
		paved: 1,
		gravel: 0.82,
		forest: 0.72,
		path: 0.55,
		unknown: 0.9
	}
};

/** Tempo für ein einzelnes Segment in km/h. Exportiert, damit die
 *  Oberfläche dieselbe Rechnung für die Segmentfärbung nutzen kann. */
export function bikeSegmentSpeedKmh(s: Segment, p: BikeParams = BIKE_DEFAULTS): number {
	if (s.distanceM <= 0) return p.baseSpeedKmh;

	const gradient = s.ascentM / s.distanceM;
	const surface = p.surfaceFactor[s.surface ?? 'unknown'] ?? p.surfaceFactor.unknown;

	let speed: number;
	if (gradient > 0) {
		speed = p.baseSpeedKmh / (1 + p.climbPenalty * gradient);
	} else {
		speed = p.baseSpeedKmh * (1 + p.descentBonus * Math.abs(gradient));
	}

	speed *= surface;

	// Sehr steile Rampen werden geschoben, nicht gefahren.
	const walkingSpeed = 4.5 * surface;
	return Math.min(Math.max(speed, walkingSpeed), p.baseSpeedKmh * p.maxSpeedFactor);
}

export function bikeDurationS(segments: Segment[], p: BikeParams = BIKE_DEFAULTS): number {
	let seconds = 0;
	for (const s of segments) {
		const speedKmh = bikeSegmentSpeedKmh(s, p);
		seconds += s.distanceM / 1000 / speedKmh * 3600;
	}
	return seconds;
}

/* ---------------------------------------------------------------------------
   Hilfsfunktionen
   --------------------------------------------------------------------------- */

const EARTH_R = 6371008.8;

/** Haversine-Distanz in Metern. */
export function distanceM(a: RoutePoint, b: RoutePoint): number {
	const φ1 = (a.lat * Math.PI) / 180;
	const φ2 = (b.lat * Math.PI) / 180;
	const dφ = φ2 - φ1;
	const dλ = ((b.lon - a.lon) * Math.PI) / 180;
	const h =
		Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
	return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

/**
 * Punktfolge in Segmente zerlegen.
 *
 * Höhenrauschen wird geglättet: ohne Schwelle summieren sich
 * Messfehler von ±1 m über tausende Punkte zu absurden Aufstiegswerten.
 * `minAscentM` ist die übliche Gegenmaßnahme.
 */
export function toSegments(points: RoutePoint[], minAscentM = 2): Segment[] {
	const segments: Segment[] = [];
	if (points.length < 2) return segments;

	let anchorEle = points[0].ele;

	for (let i = 1; i < points.length; i++) {
		const dist = distanceM(points[i - 1], points[i]);
		const rawDelta = points[i].ele - anchorEle;

		let ascent = 0;
		if (Math.abs(rawDelta) >= minAscentM) {
			ascent = rawDelta;
			anchorEle = points[i].ele;
		}

		segments.push({ distanceM: dist, ascentM: ascent });
	}

	return segments;
}

export interface RouteStats {
	distanceM: number;
	ascentM: number;
	descentM: number;
	minEleM: number;
	maxEleM: number;
	durationS: number;
}

/** Formatiert Sekunden als `4:25`. */
export function formatDuration(seconds: number): string {
	const total = Math.round(seconds / 60);
	const h = Math.floor(total / 60);
	const m = total % 60;
	return `${h}:${String(m).padStart(2, '0')}`;
}

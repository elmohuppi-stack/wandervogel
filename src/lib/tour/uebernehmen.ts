/**
 * Eine fremde Linie zu einer eigenen Tour machen.
 *
 * Geteilt zwischen den beiden Wegen aus den Anforderungen 6.2:
 * Weg B (bestehender OSM-Route folgen) und Weg C (GPX importieren).
 *
 * **Die Entscheidung, an der sich alles aufhängt: hat die Linie Höhen?**
 *
 * Eine GPX-Datei von einem Gerät bringt sie mit — dann ist die Linie die
 * Route, punktgenau, und die Kennzahlen rechnen sich direkt daraus.
 *
 * Eine OSM-Relation bringt keine. Dann setzen wir Wegpunkte entlang der
 * Linie und lassen BRouter routen: das gibt Höhen aus unserem Höhenmodell,
 * eine Dauer nach der DAV-Formel — und eine Tour, die sich weiter bearbeiten
 * lässt. Der Verlauf weicht dabei minimal ab, weil BRouter selbst entscheidet;
 * bei markierten Wegen führt sein Wanderprofil aber genau dort hin.
 */

import { newId, type Waypoint } from './types';

export type Punkt3 = [number, number, number];

/**
 * Hat die Linie brauchbare Höhen?
 *
 * Nicht „ist die dritte Zahl da" — viele GPX-Dateien schreiben überall
 * stur 0. Erst wenn sich die Werte unterscheiden, ist etwas gemessen worden.
 */
export function hasElevation(coords: Punkt3[]): boolean {
	if (coords.length < 2) return false;
	const erste = coords[0][2];
	return coords.some((c) => Number.isFinite(c[2]) && Math.abs(c[2] - erste) > 0.5);
}

/**
 * Wegpunkte entlang einer Linie verteilen.
 *
 * Start und Ziel immer, dazwischen gleichmäßig. Die Obergrenze ist keine
 * Willkür: BRouter bekommt alle Wegpunkte in *einer* Anfrage, und die Liste
 * in der Schiene will man noch überblicken können. Bei einem 126-km-Fernweg
 * heißt das rund 5 km je Abschnitt — nah genug, dass der Router dem
 * markierten Weg folgt.
 */
export function lineToWaypoints(coords: Punkt3[], maxCount = 25): Waypoint[] {
	if (coords.length === 0) return [];
	if (coords.length === 1) {
		const [lon, lat] = coords[0];
		return [{ id: newId(), lon, lat }];
	}

	const anzahl = Math.min(maxCount, coords.length);
	const letzter = coords.length - 1;
	const punkte: Waypoint[] = [];

	for (let i = 0; i < anzahl; i++) {
		const idx = Math.round((i / (anzahl - 1)) * letzter);
		const [lon, lat] = coords[idx];
		punkte.push({ id: newId(), lon, lat });
	}
	return punkte;
}

/**
 * Zu viele Stützpunkte ausdünnen.
 *
 * Der Nibelungensteig hat 5485 — als Route gespeichert ist das in Ordnung,
 * aber für die Anzeige beim Aussuchen reicht ein Bruchteil. Bewusst ein
 * gleichmäßiger Griff und kein Douglas-Peucker: hier geht es um die
 * Nutzlast, nicht um Formtreue, und einfache Regeln überraschen nicht.
 */
export function thin<T>(coords: T[], maxCount: number): T[] {
	if (coords.length <= maxCount) return coords;
	const schritt = (coords.length - 1) / (maxCount - 1);
	const raus: T[] = [];
	for (let i = 0; i < maxCount; i++) raus.push(coords[Math.round(i * schritt)]);
	return raus;
}

/** Web-Mercator nach Lon/Lat. Waymarked Trails liefert 3857. */
export function mercatorToLonLat(x: number, y: number): [number, number] {
	const lon = (x / 20037508.34) * 180;
	const lat =
		(Math.atan(Math.exp(((y / 20037508.34) * 180 * Math.PI) / 180)) * 2 - Math.PI / 2) *
		(180 / Math.PI);
	return [lon, lat];
}

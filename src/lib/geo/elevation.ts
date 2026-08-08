/**
 * Höhen zu einer Linie aus dem eigenen Höhenmodell.
 *
 * **Warum es das gibt.** Eine OSM-Relation bringt keine Höhen mit. Der erste
 * Versuch war, Wegpunkte entlang der Linie zu setzen und BRouter routen zu
 * lassen. Nachgemessen am Nibelungensteig (126,1 km laut OSM):
 *
 *     25 Wegpunkte, 5,0 km Abstand → 106,3 km  (−16 %)
 *     40 Wegpunkte, 3,2 km Abstand → 109,3 km  (−13 %)
 *     60 Wegpunkte, 2,1 km Abstand → 117,0 km  (−7 %)
 *
 * Der Router schneidet Kurven ab, und beliebig viele Wegpunkte sind keine
 * Lösung — die Liste in der Schiene wird unbenutzbar. Also nehmen wir die
 * Linie, wie sie ist, und besorgen die Höhen selbst.
 *
 * **Wie.** Über dieselben Terrarium-Kacheln, die die Karte für Relief und
 * Höhenlinien benutzt — `/api/dem`, also den eigenen Server. Dekodiert wird
 * im Browser über ein Canvas: kein Paket und keine Serverlast.
 *
 * Terrarium kodiert die Höhe in den Farbkanälen:
 *     Höhe = R · 256 + G + B / 256 − 32768
 */

import { config } from '$lib/config';

const KACHEL = 256;

/**
 * Fenstergröße der Glättung, in Punkten.
 *
 * Am Nibelungensteig ausgemessen (126,1 km, 4837 Punkte, rund 26 m Abstand).
 * Veröffentlichte Angaben für seinen Aufstieg liegen bei 3000–3600 hm:
 *
 *      1 ( 26 m) → 4985 hm
 *      3 ( 78 m) → 4643 hm
 *      5 (130 m) → 4379 hm
 *      9 (234 m) → 4068 hm
 *     15 (390 m) → 3841 hm
 *     21 (546 m) → 3690 hm
 *
 * Gewählt: 9. Das entspricht etwa acht Rasterzellen — genug, um die
 * Treppenstufen des Modells zu tilgen, wenig genug, um echte Kuppen stehen
 * zu lassen. Weiter zu glätten, bis eine veröffentlichte Zahl getroffen
 * wird, hieße auf einen Wert hin zu justieren, den man selbst nicht
 * nachprüfen kann — und würde in flachem Gelände Höhenmeter verschlucken.
 *
 * Dass der Wert über den gedruckten Angaben liegt, ist kein Fehler: aus
 * einem Höhenmodell gerechnete Aufstiege fallen systematisch höher aus als
 * gedruckte, weil das Modell jede Geländewelle mitnimmt. Dasselbe Gefälle
 * gibt es zwischen allen Tourenportalen.
 */
const GLAETTUNG = 9;

interface Kachel {
	daten: Uint8ClampedArray | null;
	z: number;
	x: number;
	y: number;
}

/** Kachelkoordinaten in Fließkomma — die Nachkommastellen sind die Pixellage. */
function projizieren(lon: number, lat: number, z: number): { fx: number; fy: number } {
	const n = 2 ** z;
	const fx = ((lon + 180) / 360) * n;
	const r = (lat * Math.PI) / 180;
	const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
	return { fx, fy };
}

async function ladeKachel(z: number, x: number, y: number): Promise<Kachel> {
	const url = config.demTileUrl
		.replace('{z}', String(z))
		.replace('{x}', String(x))
		.replace('{y}', String(y));

	const res = await fetch(url);
	// 204 heißt „hier gibt es keine Höhendaten" — über See der Normalfall,
	// kein Fehler.
	if (res.status === 204 || !res.ok) return { daten: null, z, x, y };

	const bild = await createImageBitmap(await res.blob());
	const canvas = document.createElement('canvas');
	canvas.width = KACHEL;
	canvas.height = KACHEL;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) return { daten: null, z, x, y };
	ctx.drawImage(bild, 0, 0, KACHEL, KACHEL);
	bild.close();
	return { daten: ctx.getImageData(0, 0, KACHEL, KACHEL).data, z, x, y };
}

function hoeheAn(k: Kachel, px: number, py: number): number {
	if (!k.daten) return 0;
	const x = Math.max(0, Math.min(KACHEL - 1, px));
	const y = Math.max(0, Math.min(KACHEL - 1, py));
	const i = (y * KACHEL + x) * 4;
	const d = k.daten;
	return d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768;
}

/**
 * Gleitender Mittelwert über die Höhenreihe.
 *
 * Aus dem Höhenmodell gelesene Höhen rauschen: das Modell hat rund 30 m
 * Raster, unsere Punkte liegen alle 26 m. Jede Unebenheit im Raster zählt
 * sonst als Auf- und Abstieg, und die Summe über tausende Punkte wird
 * absurd. Die Schwelle in `toSegments` allein fängt das nicht.
 *
 * Der Aufstieg ist beim Wandern die Kennzahl, die über den Tag entscheidet —
 * sie darf nicht aus Rundungsfehlern entstehen.
 */
export function smooth(werte: number[], fenster: number): number[] {
	if (fenster <= 1 || werte.length < fenster) return werte;
	const halb = Math.floor(fenster / 2);
	return werte.map((_, i) => {
		const von = Math.max(0, i - halb);
		const bis = Math.min(werte.length, i + halb + 1);
		let summe = 0;
		for (let j = von; j < bis; j++) summe += werte[j];
		return summe / (bis - von);
	});
}

/**
 * Höhen für eine Linie besorgen.
 *
 * Bilinear zwischen den vier Nachbarpixeln, nicht der nächstgelegene: bei
 * einem Punkt alle 26 Meter und einer Kachelauflösung von rund 19 Metern
 * ergäbe die Sprungfunktion eine Treppe — und jede Stufe zählte als
 * Aufstieg. Der Aufstieg ist die Kennzahl, die beim Wandern über den Tag
 * entscheidet; sie darf nicht aus Rundungsfehlern entstehen.
 */
export async function sampleElevations(
	coords: [number, number][],
	zoom = config.demMaxZoom,
	glaettung = GLAETTUNG
): Promise<number[]> {
	if (coords.length === 0) return [];

	// Erst herausfinden, welche Kacheln überhaupt gebraucht werden — jede
	// wird genau einmal geholt.
	const gebraucht = new Set<string>();
	const lagen = coords.map(([lon, lat]) => {
		const { fx, fy } = projizieren(lon, lat, zoom);
		// Pixelmitte: das Zentrum von Pixel 0 liegt bei 0,5.
		const px = fx * KACHEL - 0.5;
		const py = fy * KACHEL - 0.5;
		for (const dx of [0, 1]) {
			for (const dy of [0, 1]) {
				const gx = Math.floor(px) + dx;
				const gy = Math.floor(py) + dy;
				gebraucht.add(`${Math.floor(gx / KACHEL)},${Math.floor(gy / KACHEL)}`);
			}
		}
		return { px, py };
	});

	const kacheln = new Map<string, Kachel>();
	// Gebündelt laden, aber nicht alle auf einmal: ein Fernweg braucht
	// dutzende Kacheln, und der Browser würde sie sonst in eine einzige
	// Warteschlange pressen.
	const schluessel = [...gebraucht];
	const BUENDEL = 8;
	for (let i = 0; i < schluessel.length; i += BUENDEL) {
		const teil = schluessel.slice(i, i + BUENDEL);
		const geladen = await Promise.all(
			teil.map((s) => {
				const [tx, ty] = s.split(',').map(Number);
				return ladeKachel(zoom, tx, ty);
			})
		);
		teil.forEach((s, j) => kacheln.set(s, geladen[j]));
	}

	function lies(gx: number, gy: number): number {
		const tx = Math.floor(gx / KACHEL);
		const ty = Math.floor(gy / KACHEL);
		const k = kacheln.get(`${tx},${ty}`);
		if (!k) return 0;
		return hoeheAn(k, gx - tx * KACHEL, gy - ty * KACHEL);
	}

	const roh = lagen.map(({ px, py }) => {
		const x0 = Math.floor(px);
		const y0 = Math.floor(py);
		const fx = px - x0;
		const fy = py - y0;
		const h00 = lies(x0, y0);
		const h10 = lies(x0 + 1, y0);
		const h01 = lies(x0, y0 + 1);
		const h11 = lies(x0 + 1, y0 + 1);
		const oben = h00 * (1 - fx) + h10 * fx;
		const unten = h01 * (1 - fx) + h11 * fx;
		return oben * (1 - fy) + unten * fy;
	});

	return smooth(roh, glaettung).map((h) => Math.round(h * 10) / 10);
}

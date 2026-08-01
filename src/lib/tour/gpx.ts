/**
 * GPX schreiben.
 *
 * Die Anforderung nennt offene Formate ausdrücklich als Datenregel: alles
 * muss jederzeit vollständig exportierbar sein. GPX 1.1, ohne Erweiterungen
 * — es soll in jedem Gerät und jeder fremden App aufgehen.
 */

import { activity } from '$lib/geo/activity';
import type { Tour } from './types';

/** &, <, > und die Anführungszeichen maskieren. */
function esc(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export function tourToGpx(tour: Tour): string {
	const def = activity(tour.activityType);
	const beschreibung = [tour.note, `Aktivitätsart: ${def.label}`].filter(Boolean).join(' · ');

	// Wegpunkte als <wpt>, die berechnete Linie als <trk>. Beides, weil ein
	// fremdes Programm die Anker sonst verliert und die Tour nicht mehr
	// nachbearbeitet werden kann.
	const wpts = tour.waypoints
		.map(
			(w, i) =>
				`\t<wpt lat="${w.lat.toFixed(7)}" lon="${w.lon.toFixed(7)}">\n` +
				`\t\t<name>${esc(w.name ?? `Wegpunkt ${i + 1}`)}</name>\n` +
				`\t</wpt>`
		)
		.join('\n');

	const punkte = (tour.route?.coordinates ?? [])
		.map(
			([lon, lat, ele]) =>
				`\t\t\t<trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}">` +
				`<ele>${ele.toFixed(1)}</ele></trkpt>`
		)
		.join('\n');

	return (
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<gpx version="1.1" creator="Wandervogel" xmlns="http://www.topografix.com/GPX/1/1"\n` +
		`\txmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n` +
		`\txsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n` +
		`\t<metadata>\n` +
		`\t\t<name>${esc(tour.name)}</name>\n` +
		(beschreibung ? `\t\t<desc>${esc(beschreibung)}</desc>\n` : '') +
		(tour.date ? `\t\t<time>${tour.date}T00:00:00Z</time>\n` : '') +
		`\t</metadata>\n` +
		(wpts ? wpts + '\n' : '') +
		`\t<trk>\n` +
		`\t\t<name>${esc(tour.name)}</name>\n` +
		`\t\t<trkseg>\n${punkte}\n\t\t</trkseg>\n` +
		`\t</trk>\n` +
		`</gpx>\n`
	);
}

/* ---------------------------------------------------------------------------
   Lesen (Weg C aus den Anforderungen 6.2)
   --------------------------------------------------------------------------- */

export interface GpxInhalt {
	name?: string;
	/** Stützpunkte als `[lon, lat, ele]`. Ohne `<ele>` steht dort 0. */
	coordinates: [number, number, number][];
}

/**
 * GPX lesen.
 *
 * Mit dem eingebauten DOMParser, ohne Abhängigkeit — und im Browser, damit
 * die Datei den Rechner nicht verlässt, nur um geparst zu werden.
 *
 * Gelesen werden `trkpt` (aufgezeichnete oder geplante Spur) und als
 * Rückfall `rtept` (Route). Viele Programme schreiben nur eines von beidem.
 * Namensräume werden bewusst ignoriert: GPX-Dateien in der Wildnis halten
 * sich nicht daran, und `getElementsByTagName` ist hier robuster als eine
 * namensraumbewusste Abfrage.
 */
export function parseGpx(text: string): GpxInhalt {
	const doc = new DOMParser().parseFromString(text, 'application/xml');

	const fehler = doc.querySelector('parsererror');
	if (fehler) throw new Error('Die Datei ist kein gültiges XML.');
	if (doc.documentElement?.tagName.toLowerCase() !== 'gpx') {
		throw new Error('Das ist keine GPX-Datei.');
	}

	const punkte = (tag: string) => Array.from(doc.getElementsByTagName(tag));
	const knoten = punkte('trkpt').length > 0 ? punkte('trkpt') : punkte('rtept');

	if (knoten.length < 2) {
		throw new Error('Die Datei enthält keine Spur mit mindestens zwei Punkten.');
	}

	const coordinates: [number, number, number][] = [];
	for (const k of knoten) {
		const lat = Number(k.getAttribute('lat'));
		const lon = Number(k.getAttribute('lon'));
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
		if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
		const ele = Number(k.getElementsByTagName('ele')[0]?.textContent);
		coordinates.push([lon, lat, Number.isFinite(ele) ? ele : 0]);
	}

	if (coordinates.length < 2) {
		throw new Error('Keiner der Punkte in der Datei hat brauchbare Koordinaten.');
	}

	// Der Name steht je nach Programm im Metadatenblock oder an der Spur.
	const name =
		doc.querySelector('metadata > name')?.textContent?.trim() ||
		doc.getElementsByTagName('trk')[0]?.getElementsByTagName('name')[0]?.textContent?.trim() ||
		doc.getElementsByTagName('rte')[0]?.getElementsByTagName('name')[0]?.textContent?.trim() ||
		undefined;

	return { name, coordinates };
}

/** Dateiname aus dem Tournamen: `kalmit-ueber-die-hohe-loog.gpx` */
export function gpxFilename(name: string): string {
	const s = name
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	return `${s || 'tour'}.gpx`;
}

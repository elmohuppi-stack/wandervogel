import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Höhendaten-Kachel-Weiterleitung.
 *
 * Nötig, weil die offenen DEM-Quellen keine CORS-Header senden und ein
 * direkter Browser-Fetch deshalb scheitert. Gleichzeitig ist das die Stelle,
 * an der später lokale PMTiles-Dateien vom Server gelesen werden — dann
 * fällt der Netzzugriff weg und der Dauerbetrieb ist frei von Fremddiensten.
 *
 * Kodierung: Terrarium (`ele = r * 256 + g + b / 256 - 32768`).
 */

const UPSTREAM =
	env.DEM_UPSTREAM_URL ?? 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';

/** Kleiner Prozess-Cache, damit Zoomen und Schwenken die Quelle nicht flutet. */
const cache = new Map<string, ArrayBuffer>();
const CACHE_MAX = 400;

export const GET: RequestHandler = async ({ params, fetch, setHeaders }) => {
	const z = Number(params.z);
	const x = Number(params.x);
	const y = Number(params.y);

	// Strikt validieren — die Werte gehen in eine ausgehende URL.
	if (
		!Number.isInteger(z) ||
		!Number.isInteger(x) ||
		!Number.isInteger(y) ||
		z < 0 ||
		z > 15 ||
		x < 0 ||
		y < 0 ||
		x >= 2 ** z ||
		y >= 2 ** z
	) {
		error(400, 'Ungültige Kachelkoordinate');
	}

	const key = `${z}/${x}/${y}`;

	setHeaders({
		'content-type': 'image/png',
		// Höhendaten ändern sich praktisch nie.
		'cache-control': 'public, max-age=2592000, immutable'
	});

	const hit = cache.get(key);
	if (hit) return new Response(hit);

	const res = await fetch(`${UPSTREAM}/${key}.png`);

	if (res.status === 404) {
		// Über dem Meer und jenseits der Abdeckung fehlen Kacheln. Das ist
		// normal — eine leere Antwort ist besser als ein Fehler in der Karte.
		return new Response(null, { status: 204 });
	}
	if (!res.ok) {
		error(502, `Höhendaten nicht erreichbar (${res.status})`);
	}

	const buf = await res.arrayBuffer();

	if (cache.size >= CACHE_MAX) {
		// Ältesten Eintrag verwerfen; Map bewahrt die Einfügereihenfolge.
		const oldest = cache.keys().next().value;
		if (oldest !== undefined) cache.delete(oldest);
	}
	cache.set(key, buf);

	return new Response(buf);
};

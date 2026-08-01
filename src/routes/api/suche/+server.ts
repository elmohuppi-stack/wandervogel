import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Ortssuche — Ort, Gipfel, Hütte, Bahnhof (Anforderungen 6.2, MUSS).
 *
 * Läuft über den eigenen Server und nicht direkt aus dem Browser. Das ist
 * hier kein Umweg, sondern der Punkt: nur so lässt sich die von Nominatim
 * geforderte Kennung setzen, die erlaubte Anfragerate einhalten und ein
 * Zwischenspeicher führen. Nebenbei entfällt die CORS-Frage.
 *
 * In der Entwicklung zeigt NOMINATIM_URL auf den öffentlichen Dienst, im
 * Betrieb auf die eigene Instanz — dasselbe Muster wie bei Basiskarte und
 * Höhendaten. Die Anforderung verbietet Fremd-Fair-Use-Dienste im
 * Dauerbetrieb, nicht in der Werkstatt.
 */

interface Treffer {
	id: string;
	name: string;
	/** „Berg · Rheinland-Pfalz" — der Zusatz, der zwei gleiche Namen trennt. */
	detail: string;
	lon: number;
	lat: number;
	/** `[minLon, minLat, maxLon, maxLat]`, wenn der Ort eine Fläche hat. */
	bbox?: [number, number, number, number];
}

/* --- Zwischenspeicher ---------------------------------------------------- */

const CACHE_MAX = 200;
const cache = new Map<string, Treffer[]>();

/* --- Drosselung ----------------------------------------------------------
   Nominatims Nutzungsregeln erlauben höchstens eine Anfrage pro Sekunde.
   Die Oberfläche entprellt schon, aber darauf darf sich der Server nicht
   verlassen — mehrere Browserfenster wären sonst zu schnell. */

const MIN_ABSTAND_MS = 1100;
let letzteAnfrage = 0;

async function warten() {
	const seit = Date.now() - letzteAnfrage;
	if (seit < MIN_ABSTAND_MS) {
		await new Promise((r) => setTimeout(r, MIN_ABSTAND_MS - seit));
	}
	letzteAnfrage = Date.now();
}

/** Aus Nominatims `type`/`class` eine lesbare Gattung machen. */
const GATTUNG: Record<string, string> = {
	peak: 'Gipfel',
	alpine_hut: 'Hütte',
	wilderness_hut: 'Hütte',
	shelter: 'Schutzhütte',
	station: 'Bahnhof',
	halt: 'Haltepunkt',
	bus_stop: 'Bushaltestelle',
	village: 'Ort',
	town: 'Stadt',
	city: 'Stadt',
	hamlet: 'Weiler',
	suburb: 'Ortsteil',
	viewpoint: 'Aussicht',
	water: 'Gewässer',
	lake: 'See',
	forest: 'Wald',
	castle: 'Burg',
	ruins: 'Ruine'
};

export const GET: RequestHandler = async ({ url, fetch }) => {
	const q = (url.searchParams.get('q') ?? '').trim();

	// Unter zwei Zeichen ist jede Anfrage Verschwendung — für uns und für
	// den Dienst.
	if (q.length < 2) return json({ results: [] });

	const schluessel = q.toLowerCase();
	const gecacht = cache.get(schluessel);
	if (gecacht) return json({ results: gecacht });

	const basis = env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org';
	const kennung = env.NOMINATIM_USER_AGENT ?? 'Wandervogel (selbst gehostete Tourenplanung)';

	const ziel =
		`${basis.replace(/\/$/, '')}/search` +
		`?q=${encodeURIComponent(q)}&format=jsonv2&limit=8&addressdetails=1&accept-language=de`;

	try {
		await warten();
		const res = await fetch(ziel, {
			headers: { 'user-agent': kennung, accept: 'application/json' },
			signal: AbortSignal.timeout(8000)
		});

		if (!res.ok) {
			return json(
				{ error: `Ortssuche nicht erreichbar (${res.status}).`, kind: 'unreachable' },
				{ status: 503 }
			);
		}

		const roh = (await res.json()) as RohTreffer[];
		const results = roh.map(umwandeln).filter((t): t is Treffer => t !== null);

		cache.set(schluessel, results);
		// Ältesten Eintrag verwerfen — Map hält die Einfügereihenfolge.
		if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);

		return json({ results });
	} catch (e) {
		console.error('Ortssuche fehlgeschlagen:', e);
		return json(
			{ error: 'Ortssuche nicht erreichbar. Läuft der Dienst?', kind: 'unreachable' },
			{ status: 503 }
		);
	}
};

interface RohTreffer {
	place_id?: number;
	name?: string;
	display_name?: string;
	type?: string;
	category?: string;
	lon?: string;
	lat?: string;
	boundingbox?: [string, string, string, string];
	address?: Record<string, string>;
}

function umwandeln(r: RohTreffer): Treffer | null {
	const lon = Number(r.lon);
	const lat = Number(r.lat);
	if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

	const voll = r.display_name ?? '';
	// Nominatims `name` ist oft leer; dann das erste Glied des vollen Namens.
	const name = r.name || voll.split(',')[0] || 'Ohne Namen';

	const gattung = GATTUNG[r.type ?? ''] ?? '';
	// Der Rest des vollen Namens, gekürzt: „Annweiler, Südliche Weinstraße,
	// Rheinland-Pfalz, Deutschland" wird zu „Südliche Weinstraße,
	// Rheinland-Pfalz".
	const rest = voll.split(',').slice(1, 3).map((s) => s.trim()).filter(Boolean).join(', ');
	const detail = [gattung, rest].filter(Boolean).join(' · ');

	// Nominatim liefert [minLat, maxLat, minLon, maxLon] — eine andere
	// Reihenfolge als alles andere hier. Umdrehen, nicht durchreichen.
	const bb = r.boundingbox?.map(Number);
	const bbox =
		bb && bb.length === 4 && bb.every(Number.isFinite)
			? ([bb[2], bb[0], bb[3], bb[1]] as [number, number, number, number])
			: undefined;

	return { id: String(r.place_id ?? `${lon},${lat}`), name, detail, lon, lat, bbox };
}

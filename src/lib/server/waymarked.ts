/**
 * Markierte Routen aus OpenStreetMap — Weg B aus den Anforderungen 6.2.
 *
 * Über Waymarked Trails, das die OSM-Relationen aufbereitet und je Aktivität
 * eine eigene Instanz betreibt (hiking / cycling). Der Name der Instanz ist
 * dasselbe `overlayLayer` aus der Aktivitätsdefinition, das schon die
 * Kachelebene benennt — kein zweites Feld, keine Umrechnung im Aufrufer.
 *
 * Wie bei Ortssuche und Basiskarte gilt: in der Entwicklung der öffentliche
 * Dienst, im Betrieb der eigene OSM-Extrakt. Abschnitt 7 verbietet
 * Fremd-Fair-Use-Dienste im Dauerbetrieb, nicht in der Werkstatt. Deshalb
 * läuft alles über den eigenen Server: eine Kennung, eine Drosselung, ein
 * Zwischenspeicher.
 *
 * Nachgemessen am Nibelungensteig: 649 Teilwege, 5485 Stützpunkte, 126,1 km
 * gegen 124,6 km auf der Papierkarte des Odenwaldklubs.
 */

import { env } from '$env/dynamic/private';
import { activity, type ActivityType } from '$lib/geo/activity';
import { mercatorToLonLat, type Punkt3 } from '$lib/tour/uebernehmen';

export interface RoutenTreffer {
	id: number;
	name: string;
	/** Kürzel der Markierung, z. B. „HW 3" oder „EV15". */
	ref?: string;
	/** „Odenwaldklub e.V." */
	operator?: string;
	/** Fernweg, regional, lokal — aus OSMs network-Stufen. */
	stufe?: string;
	/** „Weinrotes ‚N' auf weißem Grund" — auf Deutsch, aus OSM. */
	markierung?: string;
}

export interface RoutenDetail extends RoutenTreffer {
	/** Länge der erfassten Linie in Metern. */
	lengthM: number;
	/** Orte entlang der Route, wie OSM sie führt. */
	itinerary?: string[];
	/** Stützpunkte als `[lon, lat, 0]` — OSM kennt keine Höhen. */
	coordinates: Punkt3[];
	/** Untergrund entlang der Route, nach Anteil der Teilstücke. */
	surfaces: { art: string; anteil: number }[];
}

const STUFEN: Record<string, string> = {
	INT: 'Europäischer Fernweg',
	NAT: 'Fernweg',
	REG: 'Regionalweg',
	LOC: 'Lokaler Weg',
	iwn: 'Europäischer Fernweg',
	nwn: 'Fernweg',
	rwn: 'Regionalweg',
	lwn: 'Lokaler Weg',
	icn: 'Europäische Radroute',
	ncn: 'Nationale Radroute',
	rcn: 'Regionale Radroute',
	lcn: 'Lokale Radroute'
};

/** Nur die Arten benennen, die man beim Planen unterscheiden will. */
const UNTERGRUND: Record<string, string> = {
	asphalt: 'Asphalt',
	paved: 'befestigt',
	paving_stones: 'Pflaster',
	concrete: 'Beton',
	compacted: 'verdichtet',
	gravel: 'Schotter',
	fine_gravel: 'Feinschotter',
	dirt: 'Erde',
	ground: 'Naturboden',
	grass: 'Wiese',
	sand: 'Sand',
	rock: 'Fels',
	wood: 'Holz'
};

function basis(activityType: ActivityType): string {
	const instanz = activity(activityType).overlayLayer;
	const vorlage = env.WAYMARKED_URL ?? 'https://{layer}.waymarkedtrails.org';
	return vorlage.replace('{layer}', instanz).replace(/\/$/, '');
}

const KENNUNG =
	env.WAYMARKED_USER_AGENT ?? 'Wandervogel/0.1 (selbst gehostete Tourenplanung)';

/* --- Drosselung und Zwischenspeicher ------------------------------------ */

const MIN_ABSTAND_MS = 1100;
let letzte = 0;

async function warten() {
	const seit = Date.now() - letzte;
	if (seit < MIN_ABSTAND_MS) await new Promise((r) => setTimeout(r, MIN_ABSTAND_MS - seit));
	letzte = Date.now();
}

const CACHE_MAX = 60;
const cache = new Map<string, unknown>();

function merken(key: string, wert: unknown) {
	cache.set(key, wert);
	if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

export class WaymarkedError extends Error {
	constructor(
		message: string,
		readonly kind: 'unreachable' | 'not_found'
	) {
		super(message);
		this.name = 'WaymarkedError';
	}
}

async function holen(url: string, fetchFn: typeof fetch): Promise<unknown> {
	await warten();
	let res: Response;
	try {
		res = await fetchFn(url, {
			headers: { 'user-agent': KENNUNG, accept: 'application/json' },
			signal: AbortSignal.timeout(20000)
		});
	} catch {
		throw new WaymarkedError('Routenverzeichnis nicht erreichbar.', 'unreachable');
	}
	if (res.status === 404) throw new WaymarkedError('Route nicht gefunden.', 'not_found');
	if (!res.ok) {
		throw new WaymarkedError(`Routenverzeichnis antwortet mit ${res.status}.`, 'unreachable');
	}
	return res.json();
}

/* --- Suche -------------------------------------------------------------- */

export async function sucheRouten(
	q: string,
	activityType: ActivityType,
	fetchFn: typeof fetch = fetch
): Promise<RoutenTreffer[]> {
	const key = `s:${activityType}:${q.toLowerCase()}`;
	const gecacht = cache.get(key);
	if (gecacht) return gecacht as RoutenTreffer[];

	const url = `${basis(activityType)}/api/v1/list/search?query=${encodeURIComponent(q)}&limit=12`;
	const roh = (await holen(url, fetchFn)) as { results?: RohTreffer[] };

	// Waymarked Trails liefert dieselbe Relation mehrfach, wenn sie in
	// mehreren Verzeichnissen steht. Nach ID entdoppeln.
	const gesehen = new Set<number>();
	const treffer: RoutenTreffer[] = [];
	for (const r of roh.results ?? []) {
		if (typeof r.id !== 'number' || gesehen.has(r.id)) continue;
		gesehen.add(r.id);
		treffer.push({
			id: r.id,
			name: r.name || r.ref || `Relation ${r.id}`,
			ref: r.ref || undefined,
			operator: r.operator || undefined,
			stufe: STUFEN[r.group ?? ''] ?? undefined
		});
	}

	merken(key, treffer);
	return treffer;
}

/* --- Geometrie ---------------------------------------------------------- */

export async function holeRoute(
	id: number,
	activityType: ActivityType,
	fetchFn: typeof fetch = fetch
): Promise<RoutenDetail> {
	const key = `d:${activityType}:${id}`;
	const gecacht = cache.get(key);
	if (gecacht) return gecacht as RoutenDetail;

	const url = `${basis(activityType)}/api/v1/details/relation/${id}`;
	const d = (await holen(url, fetchFn)) as RohDetail;

	const wege = sammleWege(d.route);
	if (wege.length === 0) {
		throw new WaymarkedError('Diese Route hat keine erfasste Linie.', 'not_found');
	}

	// Die Teilwege kommen in Reihenfolge; aneinandergehängt ergeben sie die
	// Linie. Doppelte Übergangspunkte werden übersprungen, sonst stünden an
	// jeder Wegegrenze zwei identische Stützpunkte.
	const coordinates: Punkt3[] = [];
	for (const w of wege) {
		for (const [x, y] of w.geometry?.coordinates ?? []) {
			const [lon, lat] = mercatorToLonLat(x, y);
			const letzter = coordinates[coordinates.length - 1];
			if (letzter && Math.abs(letzter[0] - lon) < 1e-9 && Math.abs(letzter[1] - lat) < 1e-9) {
				continue;
			}
			coordinates.push([lon, lat, 0]);
		}
	}

	const detail: RoutenDetail = {
		id,
		name: d.name || d.ref || `Relation ${id}`,
		ref: d.ref || undefined,
		operator: d.operator || undefined,
		stufe: STUFEN[d.group ?? ''] ?? STUFEN[d.tags?.network ?? ''] ?? undefined,
		markierung: d.symbol_description || undefined,
		itinerary: Array.isArray(d.itinerary) ? d.itinerary : undefined,
		lengthM: Number(d.route?.length) || 0,
		coordinates,
		surfaces: untergrund(wege)
	};

	merken(key, detail);
	return detail;
}

/* --- Innen -------------------------------------------------------------- */

interface RohTreffer {
	id?: number;
	name?: string;
	ref?: string;
	operator?: string;
	group?: string;
}

interface RohWeg {
	route_type?: string;
	tags?: Record<string, string>;
	geometry?: { type?: string; coordinates?: [number, number][] };
	main?: RohWeg[];
	appendices?: RohWeg[];
	ways?: RohWeg[];
	length?: number;
}

interface RohDetail {
	name?: string;
	ref?: string;
	operator?: string;
	group?: string;
	symbol_description?: string;
	itinerary?: string[];
	tags?: Record<string, string>;
	route?: RohWeg;
}

/**
 * Die Antwort ist ein Baum: route → main[] → ways[] → …, dazu appendices
 * für Varianten und Zubringer. Die Blätter tragen `route_type: 'base'` und
 * die Geometrie.
 */
function sammleWege(node: RohWeg | undefined, raus: RohWeg[] = []): RohWeg[] {
	if (!node) return raus;
	if (node.route_type === 'base' && node.geometry) raus.push(node);
	for (const kinder of [node.main, node.ways]) {
		for (const k of kinder ?? []) sammleWege(k, raus);
	}
	// Varianten bewusst *nicht* mitnehmen: sie würden die Linie verzweigen,
	// und eine Tour ist ein Weg.
	return raus;
}

function untergrund(wege: RohWeg[]): { art: string; anteil: number }[] {
	const summe = new Map<string, number>();
	let gesamt = 0;
	for (const w of wege) {
		const m = Number(w.length) || 0;
		if (m <= 0) continue;
		gesamt += m;
		const roh = w.tags?.surface;
		const art = roh ? (UNTERGRUND[roh] ?? roh) : 'unbekannt';
		summe.set(art, (summe.get(art) ?? 0) + m);
	}
	if (gesamt === 0) return [];
	return [...summe.entries()]
		.map(([art, m]) => ({ art, anteil: m / gesamt }))
		.sort((a, b) => b.anteil - a.anteil)
		.slice(0, 5);
}

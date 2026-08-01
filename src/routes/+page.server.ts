import { DbError } from '$lib/server/db/errors';
import { isActivityType } from '$lib/geo/activity';
import { deleteTour, listTours, type TourSort } from '$lib/server/db/tours';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const SORTS: TourSort[] = ['updated', 'date', 'name', 'distance', 'ascent', 'duration'];

/**
 * `bbox=7.8,49.1,8.2,49.4` — der Regionsfilter aus 6.5.
 *
 * Kaputte Werte ergeben `null` statt eines Fehlers: eine Adresse, die
 * jemand von Hand gekürzt hat, soll die Seite nicht zerlegen.
 */
function parseBbox(roh: string | null): [number, number, number, number] | null {
	if (!roh) return null;
	const n = roh.split(',').map(Number);
	if (n.length !== 4 || !n.every(Number.isFinite)) return null;
	if (n[0] >= n[2] || n[1] >= n[3]) return null;
	if (n[0] < -180 || n[2] > 180 || n[1] < -90 || n[3] > 90) return null;
	return [n[0], n[1], n[2], n[3]];
}

/**
 * Die Startseite ist das Archiv: Liste links, Karte rechts.
 *
 * Gefiltert wird auf dem Server und nicht im Browser — das bleibt bei
 * hundert Touren richtig, und der Regionsfilter aus 6.5 braucht ohnehin
 * PostGIS. Filter, Sortierung und Suche stehen in der Adresse, damit ein
 * Stand verlinkbar ist und die Zurück-Taste stimmt.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	const a = url.searchParams.get('a');
	const sort = url.searchParams.get('sort');
	const q = url.searchParams.get('q');
	const bbox = parseBbox(url.searchParams.get('bbox'));

	// Unbekannte Werte fallen still zurück. Eine getippte Adresse soll
	// keinen Fehler ergeben.
	const activityType = isActivityType(a) ? a : null;
	const sortiert = SORTS.includes(sort as TourSort) ? (sort as TourSort) : 'updated';

	try {
		const tours = await listTours(locals.ownerId, { activityType, sort: sortiert, q, bbox });
		return { tours, filter: { activityType, sort: sortiert, q: q ?? '', bbox } };
	} catch (e) {
		if (e instanceof DbError) error(e.kind === 'unreachable' ? 503 : 500, e.message);
		throw e;
	}
};

export const actions: Actions = {
	/**
	 * Der einzige Weg, eine Tour zu löschen. Aufgerufen auch aus der
	 * Planungsansicht über `action="/?/delete"` — SvelteKit erlaubt
	 * routenübergreifende Aktionen, und zwei Wege für dieselbe zerstörende
	 * Handlung liefen auseinander.
	 */
	delete: async ({ request, locals }) => {
		const form = await request.formData();
		const id = form.get('id');
		if (typeof id !== 'string' || !id) return fail(400, { error: 'Keine Tour angegeben' });

		try {
			const ok = await deleteTour(locals.ownerId, id);
			if (!ok) return fail(404, { error: 'Tour nicht gefunden' });
		} catch (e) {
			if (e instanceof DbError) {
				return fail(e.kind === 'unreachable' ? 503 : 500, { error: e.message });
			}
			throw e;
		}
		redirect(303, '/');
	}
};

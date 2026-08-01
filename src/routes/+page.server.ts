import { DbError } from '$lib/server/db/errors';
import { isActivityType } from '$lib/geo/activity';
import { deleteTour, listTours, type TourSort } from '$lib/server/db/tours';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const SORTS: TourSort[] = ['updated', 'date', 'name', 'distance', 'ascent', 'duration'];

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

	// Unbekannte Werte fallen still zurück. Eine getippte Adresse soll
	// keinen Fehler ergeben.
	const activityType = isActivityType(a) ? a : null;
	const sortiert = SORTS.includes(sort as TourSort) ? (sort as TourSort) : 'updated';

	try {
		const tours = await listTours(locals.ownerId, { activityType, sort: sortiert, q });
		return { tours, filter: { activityType, sort: sortiert, q: q ?? '' } };
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

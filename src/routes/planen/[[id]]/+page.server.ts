import { DbError } from '$lib/server/db/errors';
import { getTour } from '$lib/server/db/tours';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Ein optionaler Parameter statt zweier Routen: `/planen` legt an,
 * `/planen/<id>` bearbeitet. Eine Komponente, ein Zustand.
 *
 * Die Alternative — `/planen` legt sofort eine Zeile an und leitet um —
 * würde das Archiv mit abgebrochenen „Neue Tour"-Zeilen zumüllen.
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	if (!params.id) return { tour: null };

	try {
		const tour = await getTour(locals.ownerId, params.id);
		if (!tour) error(404, 'Tour nicht gefunden');
		return { tour };
	} catch (e) {
		if (e instanceof DbError) error(e.kind === 'unreachable' ? 503 : 500, e.message);
		throw e;
	}
};

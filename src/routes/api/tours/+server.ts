import { DbError, dbStatus } from '$lib/server/db/errors';
import { createTour } from '$lib/server/db/tours';
import { parseTourInput } from '$lib/tour/parse';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Tour anlegen.
 *
 * Ein JSON-Endpunkt und keine Formularaktion: die Nutzlast ist ein Dokument
 * von 150–400 KB aus dem Clientzustand, geformt wie das, was /api/route
 * ohnehin austauscht. Gelesen wird dagegen über load-Funktionen.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return json({ error: 'Ungültiges JSON' }, { status: 400 });
	}

	try {
		const input = parseTourInput(payload);
		const id = await createTour(locals.ownerId, input);
		return json({ id }, { status: 201 });
	} catch (e) {
		if (e instanceof DbError) {
			return json({ error: e.message, kind: e.kind }, { status: dbStatus(e.kind) });
		}
		return json({ error: (e as Error).message }, { status: 400 });
	}
};

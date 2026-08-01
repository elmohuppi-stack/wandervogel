import { DbError, dbStatus } from '$lib/server/db/errors';
import { updateTour } from '$lib/server/db/tours';
import { parseTourInput } from '$lib/tour/parse';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Tour ändern.
 *
 * Kein GET daneben: gelesen wird über die load-Funktion der Seite. Ein
 * Endpunkt, den niemand aufruft, ist toter Code.
 *
 * Kein DELETE: das Löschen läuft über eine Formularaktion. Zwei Wege für
 * dieselbe zerstörende Handlung sind zwei Wege, die auseinanderlaufen.
 */
export const PUT: RequestHandler = async ({ request, params, locals }) => {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return json({ error: 'Ungültiges JSON' }, { status: 400 });
	}

	try {
		const input = parseTourInput(payload);
		const ok = await updateTour(locals.ownerId, params.id, input);
		// Auch bei fremdem Eigentümer 404 — die Existenz einer fremden Tour
		// wird nicht verraten.
		if (!ok) return json({ error: 'Tour nicht gefunden' }, { status: 404 });
		return json({ id: params.id });
	} catch (e) {
		if (e instanceof DbError) {
			return json({ error: e.message, kind: e.kind }, { status: dbStatus(e.kind) });
		}
		return json({ error: (e as Error).message }, { status: 400 });
	}
};

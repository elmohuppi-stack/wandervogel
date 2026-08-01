import { DbError, dbStatus } from '$lib/server/db/errors';
import { getTour } from '$lib/server/db/tours';
import { gpxFilename, tourToGpx } from '$lib/tour/gpx';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Tour als GPX.
 *
 * Eine eigene Ressource mit eigenem Inhaltstyp, damit der Browser sie
 * herunterlädt statt anzuzeigen und ein Rechtsklick „Ziel speichern unter"
 * das Richtige tut.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	let tour;
	try {
		tour = await getTour(locals.ownerId, params.id);
	} catch (e) {
		if (e instanceof DbError) error(dbStatus(e.kind), e.message);
		throw e;
	}
	if (!tour) error(404, 'Tour nicht gefunden');

	return new Response(tourToGpx(tour), {
		headers: {
			'content-type': 'application/gpx+xml; charset=utf-8',
			'content-disposition': `attachment; filename="${gpxFilename(tour.name)}"`
		}
	});
};

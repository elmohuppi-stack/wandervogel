import type { Handle } from '@sveltejs/kit';
import { SINGLE_OWNER_ID } from '$lib/server/owner';

/**
 * Hier wird später die Sitzung gelesen. Bis dahin gehört alles demselben
 * Eigentümer — aber *dass* es einen gibt, steht schon im ganzen Code.
 */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.ownerId = SINGLE_OWNER_ID;
	return resolve(event);
};

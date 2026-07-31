import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Der Einstieg ist das Planen — später je nach Kontext das Archiv. */
export const load: PageServerLoad = () => {
	redirect(307, '/planen');
};

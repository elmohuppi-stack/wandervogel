import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

/**
 * Die Musterseite ist ein Werkzeug, kein Teil der App. Im Betrieb gibt es
 * sie nicht — sonst wäre sie die einzige Seite, die niemand pflegt und die
 * trotzdem jeder findet.
 */
export function load() {
	if (!dev) error(404, 'Nicht gefunden');
	return {};
}

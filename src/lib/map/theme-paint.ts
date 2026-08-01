/**
 * Alle farbabhängigen Malanweisungen der Karte an einer Stelle.
 *
 * Einmal benutzt beim Anlegen der Ebenen, einmal beim Themenwechsel. Zwei
 * Listen liefen unweigerlich auseinander — dann wechselt die Route die
 * Farbe, die Schummerung aber nicht, und niemand findet, warum.
 */

import type { Map as MlMap } from 'maplibre-gl';
import { activity, type ActivityType } from '$lib/geo/activity';
import { resolveColorToken } from '$lib/ui/theme.svelte';

/** Aus MapLibres eigener Signatur abgeleitet, damit ein Tippfehler im
 *  Namen der Malanweisung beim Übersetzen auffällt und nicht erst als
 *  stumme Ebene in der Karte. */
type PaintProp = Parameters<MlMap['setPaintProperty']>[1];

/** [Ebene, Malanweisung, Farbe] */
export type Paint = [layer: string, prop: PaintProp, value: string];

export function paintFor(activityType: ActivityType): Paint[] {
	const route = resolveColorToken(activity(activityType).mapColorVar, '#b3382a');
	const casing = resolveColorToken('--route-casing', '#ffffff');

	return [
		['wv-hillshade', 'hillshade-shadow-color', resolveColorToken('--hs-shadow', '#6b6152')],
		['wv-hillshade', 'hillshade-highlight-color', resolveColorToken('--hs-highlight', '#fffdf8')],
		['wv-hillshade', 'hillshade-accent-color', resolveColorToken('--hs-accent', '#8c8272')],

		['wv-contour-lines', 'line-color', resolveColorToken('--contour', '#a08a6b')],
		['wv-contour-labels', 'text-color', resolveColorToken('--contour-index', '#8a7250')],
		['wv-contour-labels', 'text-halo-color', resolveColorToken('--paper-2', '#f4f6f1')],

		['wv-route-casing', 'line-color', casing],
		['wv-route-line', 'line-color', route],

		['wv-marker-dot', 'circle-color', resolveColorToken('--ink', '#171b17')],
		['wv-marker-dot', 'circle-stroke-color', resolveColorToken('--surface', '#ffffff')],

		['wv-waypoints-circle', 'circle-color', route],
		['wv-waypoints-circle', 'circle-stroke-color', casing],
		['wv-waypoints-label', 'text-color', resolveColorToken('--map-on-route', '#ffffff')],

		['wv-position-accuracy', 'fill-color', resolveColorToken('--position', '#2f8fe0')],
		['wv-position-ring', 'line-color', resolveColorToken('--position', '#2f8fe0')],
		['wv-position-dot', 'circle-color', resolveColorToken('--position', '#2f8fe0')],
		['wv-position-dot', 'circle-stroke-color', casing]
	];
}

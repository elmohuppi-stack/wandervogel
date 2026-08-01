/**
 * Eigener Standort auf der Karte.
 *
 * Herausgelöst, weil beide Karten ihn brauchen — die Planungsansicht und
 * die Tourenübersicht. Zwei Kopien wären zwei Genauigkeitskreise, die
 * irgendwann verschieden aussehen.
 */

import type { FeatureCollection } from 'geojson';
import type { Map as MlMap } from 'maplibre-gl';
import { resolveColorToken } from '$lib/ui/theme.svelte';

export interface Position {
	lon: number;
	lat: number;
	accuracyM: number;
}

export const SRC_POSITION = 'wv-position';

const LEER: FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Punkt und Genauigkeitskreis als GeoJSON.
 *
 * Der Kreis ist ein echtes Vieleck in Metern, kein `circle-radius` in
 * Pixeln: eine Pixelangabe bliebe beim Zoomen gleich groß und behauptete
 * beim Herauszoomen eine Genauigkeit von Kilometern. Was die Ortung nicht
 * weiß, darf die Karte nicht behaupten.
 */
export function positionFeatures(pos: Position | null): FeatureCollection {
	if (!pos) return LEER;
	const { lon, lat, accuracyM } = pos;

	const SEITEN = 64;
	const mProGradLat = 111320;
	const mProGradLon = mProGradLat * Math.cos((lat * Math.PI) / 180);
	const ring: [number, number][] = [];
	for (let i = 0; i <= SEITEN; i++) {
		const w = (i / SEITEN) * 2 * Math.PI;
		ring.push([
			lon + (Math.cos(w) * accuracyM) / mProGradLon,
			lat + (Math.sin(w) * accuracyM) / mProGradLat
		]);
	}

	return {
		type: 'FeatureCollection',
		features: [
			{
				type: 'Feature',
				properties: { kind: 'accuracy' },
				geometry: { type: 'Polygon', coordinates: [ring] }
			},
			{
				type: 'Feature',
				properties: { kind: 'dot' },
				geometry: { type: 'Point', coordinates: [lon, lat] }
			}
		]
	};
}

/** Quelle und die drei Ebenen anlegen. Gehören zuoberst. */
export function addPositionLayers(m: MlMap, pos: Position | null = null): void {
	m.addSource(SRC_POSITION, { type: 'geojson', data: positionFeatures(pos) });

	m.addLayer({
		id: 'wv-position-accuracy',
		type: 'fill',
		source: SRC_POSITION,
		filter: ['==', ['get', 'kind'], 'accuracy'],
		paint: {
			'fill-color': resolveColorToken('--position', '#2f8fe0'),
			'fill-opacity': 0.12
		}
	});

	m.addLayer({
		id: 'wv-position-ring',
		type: 'line',
		source: SRC_POSITION,
		filter: ['==', ['get', 'kind'], 'accuracy'],
		paint: {
			'line-color': resolveColorToken('--position', '#2f8fe0'),
			'line-width': 1,
			'line-opacity': 0.5
		}
	});

	m.addLayer({
		id: 'wv-position-dot',
		type: 'circle',
		source: SRC_POSITION,
		filter: ['==', ['get', 'kind'], 'dot'],
		paint: {
			'circle-radius': 6,
			'circle-color': resolveColorToken('--position', '#2f8fe0'),
			'circle-stroke-color': resolveColorToken('--route-casing', '#ffffff'),
			'circle-stroke-width': 2.5
		}
	});
}

/**
 * Standort einmalig bestimmen.
 *
 * Einmalig, nicht als Dauerbeobachtung: beim Planen am Laptop will man
 * wissen, wo man ist, nicht verfolgt werden. Die Feldansicht bekommt
 * später ein watchPosition.
 *
 * Gibt entweder eine Position oder eine deutsche Meldung zurück, nie eine
 * Ausnahme — der Aufrufer soll nichts auspacken müssen.
 */
export async function locateOnce(): Promise<
	{ ok: true; position: Position } | { ok: false; error: string }
> {
	if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
		return { ok: false, error: 'Dieser Browser kennt keine Ortung.' };
	}

	try {
		const pos = await new Promise<GeolocationPosition>((erfolg, fehler) =>
			navigator.geolocation.getCurrentPosition(erfolg, fehler, {
				enableHighAccuracy: true,
				timeout: 12000,
				maximumAge: 30000
			})
		);
		return {
			ok: true,
			position: {
				lon: pos.coords.longitude,
				lat: pos.coords.latitude,
				// Unter fünf Metern ist der Kreis kleiner als der Punkt und
				// sieht aus wie ein Zeichenfehler.
				accuracyM: Math.max(pos.coords.accuracy, 5)
			}
		};
	} catch (e) {
		const code = (e as GeolocationPositionError)?.code;
		return {
			ok: false,
			error:
				code === 1
					? 'Ortung abgelehnt. Im Browser für diese Seite erlauben.'
					: code === 3
						? 'Ortung hat zu lange gedauert.'
						: 'Standort nicht ermittelbar.'
		};
	}
}

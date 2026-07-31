import { env } from '$env/dynamic/public';

/**
 * Datenquellen der Karte.
 *
 * Wichtig: Höhendaten laufen **immer** über den eigenen Server, nie direkt
 * aus dem Browser. Grund ist nicht Vorsicht, sondern Notwendigkeit — weder
 * Mapterhorn noch die AWS-Terrarium-Kacheln senden CORS-Header, ein
 * Browser-Fetch scheitert also. Der Umweg über `/api/dem` ist zugleich die
 * Produktionsarchitektur: dort liegen später lokale PMTiles-Dateien.
 */
export const config = {
	/**
	 * Basiskarte. In der Entwicklung OpenFreeMap (frei, ohne Schlüssel,
	 * browserfähig). Für den Dauerbetrieb wird das durch selbst gehostete
	 * Protomaps-PMTiles ersetzt — die Anforderung verbietet
	 * Fremd-Fair-Use-Dienste im Dauerbetrieb.
	 */
	basemapStyleUrl:
		env.PUBLIC_BASEMAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/liberty',

	/** Höhendaten über den eigenen Server, Terrarium-kodiert. */
	demTileUrl: '/api/dem/{z}/{x}/{y}.png',
	demEncoding: 'terrarium' as const,
	demMaxZoom: 13,

	/** Startausschnitt: Pfälzerwald. */
	initialView: {
		center: [7.95, 49.2] as [number, number],
		zoom: 11
	}
};

/**
 * Höhenlinien-Abstände je Zoomstufe, in Metern.
 * Wanderkarten zeigen üblicherweise 20 m mit jeder fünften Linie betont;
 * weit herausgezoomt würde das zu einem braunen Teppich, deshalb gestaffelt.
 */
export const CONTOUR_THRESHOLDS: Record<number, [number, number]> = {
	10: [500, 1000],
	11: [200, 1000],
	12: [100, 500],
	13: [50, 250],
	14: [20, 100],
	15: [20, 100]
};

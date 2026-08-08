/**
 * Der Iconsatz.
 *
 * Selbst gebündelt statt als Paket, aus zwei Gründen. Erstens: die
 * Feldansicht macht keine Netzanfrage, also darf nichts nachgeladen werden.
 * Zweitens — der eigentliche Grund — die Deckung. Wanderfigur, Alpenhütte,
 * Höhenprofilkurve, Aussichtspunkt und Schutzhütte gibt es bei Lucide nicht
 * brauchbar. Ein Paket hieße zwanzig importierte plus fünf handgezeichnete
 * Glyphen mit zwei Strichstärken nebeneinander in derselben Schiene.
 *
 * Pfaddaten überwiegend aus Lucide (ISC, © Lucide Contributors), auf ein
 * 24×24-Raster normalisiert. Eigene Glyphen sind unten gekennzeichnet.
 *
 * Diese Datei importiert nichts. Damit darf jede Schicht `IconName`
 * verwenden — auch geo/activity.ts, ohne Zyklus.
 */

export const ICONS = {
	/* --- Aktivitätsarten ------------------------------------------------ */
	// Eigener Glyph: Wanderfigur mit Stock. Lucides `footprints` liest sich
	// als Fußabdruck im Sand, nicht als Wandern.
	hike: '<circle cx="13" cy="4" r="1.6"/><path d="M12.5 21l-1-5.5 3-2.5-1.5-4.5"/><path d="M13 8.5L9.5 10 8 14"/><path d="M13.5 12.5L17 14l1 3"/><path d="M6 8.5V21"/>',
	bike: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',

	/* --- Planen --------------------------------------------------------- */
	waypoint: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
	route:
		'<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
	crosshair:
		'<circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
	/**
	 * Eigener Standort. Bewusst anders als `waypoint`: der Wegpunkt ist
	 * etwas Gesetztes, der Standort etwas Gemessenes — der Ring ist die
	 * Ortungsgenauigkeit. Auf der Feldansicht liegen beide nebeneinander
	 * auf der Karte und dürfen sich nicht verwechseln lassen.
	 */
	location:
		'<circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="8"/>',
	/**
	 * Auf den eigenen Standort zentrieren — der Knopf dazu.
	 *
	 * Das Fadenkreuz mit gefülltem Kern, wie überall. Ein gestrichelter
	 * Ring war der erste Versuch und wurde bei 14px zu Brei.
	 */
	'location-fix':
		'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/><path d="M12 1.8v3.4M12 18.8v3.4M1.8 12h3.4M18.8 12h3.4"/>',
	layers:
		'<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m6.08 9.5-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83l-3.5-1.59"/><path d="m6.08 14.5-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83l-3.5-1.59"/>',
	search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
	save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
	list: '<path d="M3 5h.01M3 12h.01M3 19h.01M8 5h13M8 12h13M8 19h13"/>',

	/* --- Kennzahlen ----------------------------------------------------- */
	ruler:
		'<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0z"/><path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/>',
	clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
	ascent: '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
	descent: '<path d="M16 17h6v-6"/><path d="m22 17-8.5-8.5-5 5L2 7"/>',
	// „Höchster Punkt". Um 180° gedreht steht derselbe Glyph für den tiefsten.
	mountain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
	gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
	// Eigener Glyph: Höhenprofil. Lucides Diagramme lesen sich als Statistik.
	profile: '<path d="M3 20h18"/><path d="M3 16.5 8 8l3.5 5L15 6.5 21 16"/>',

	/* --- Bedienen ------------------------------------------------------- */
	grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
	trash:
		'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/>',
	close: '<path d="M18 6 6 18M6 6l12 12"/>',
	check: '<path d="M20 6 9 17l-5-5"/>',
	pencil:
		'<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
	plus: '<path d="M5 12h14M12 5v14"/>',
	// Gedreht: 180 nach oben, 90 nach links, 270 nach rechts.
	'chevron-down': '<path d="m6 9 6 6 6-6"/>',
	'chevron-left': '<path d="m15 18-6-6 6-6"/>',
	info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
	alert:
		'<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4M12 17h.01"/>',
	loader: '<path d="M12 2v4M12 18v4M4.9 4.9l2.9 2.9M16.2 16.2l2.9 2.9M2 12h4M18 12h4M4.9 19.1l2.9-2.9M16.2 7.8l2.9-2.9"/>',

	/* --- Darstellung ---------------------------------------------------- */
	sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
	moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9"/>',
	monitor:
		'<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',

	/* --- POIs (Anforderungen 6.2, „POI-Kontext je Aktivitätsart") -------- */
	// Eigener Glyph: Alpenhütte. Lucides `house` ist ein Vorstadthaus.
	hut: '<path d="m12 3 8 8"/><path d="M12 3 4 11"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
	water:
		'<path d="M12 2.7s5.5 5.6 5.5 9.8a5.5 5.5 0 1 1-11 0C6.5 8.3 12 2.7 12 2.7"/>',
	food: '<path d="M3 2v7a3 3 0 0 0 6 0V2"/><path d="M6 2v20"/><path d="M18 15V2a4 4 0 0 0-3 6.5V15z"/><path d="M18 15v7"/>',
	bus: '<path d="M4 17h16"/><rect width="16" height="13" x="4" y="4" rx="2"/><path d="M4 10h16"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/><path d="M6 21v-2M18 21v-2"/>',
	train:
		'<rect width="14" height="14" x="5" y="3" rx="2"/><path d="M5 10h14"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/><path d="m6 21 2-3M18 21l-2-3"/>',
	'bike-shop':
		'<path d="M3 9h18l-1-5H4z"/><path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M9 21v-6h6v6"/>',
	'bike-repair':
		'<path d="M14.7 6.3a4 4 0 0 0 5 5.2l-8.2 8.2a2.5 2.5 0 0 1-3.6-3.6l8.2-8.2a4 4 0 0 0-1.4-1.6"/><path d="M9.5 4.5 6 8 3 5l3.5-3.5a4 4 0 0 1 3 3"/>',
	// Aussichtspunkt als Auge. Ein Blickkegel über einer Kuppe war der
	// erste Versuch und las sich bei 16px als Sanduhr.
	viewpoint:
		'<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12"/><circle cx="12" cy="12" r="2.6"/>',
	shelter: '<path d="m12 3 9 7H3z"/><path d="M6 10v11M18 10v11"/><path d="M6 21h12"/>'
} as const;

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

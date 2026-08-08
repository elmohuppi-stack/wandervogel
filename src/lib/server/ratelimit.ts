/**
 * Begrenzung der Anfragen je IP-Adresse.
 *
 * Nötig geworden mit dem Gastzugang: ohne Anmeldung stehen Routing,
 * Höhenkacheln, Ortssuche und Routensuche jedem offen. Dahinter liegen
 * entweder eigene Rechenleistung auf einem kleinen Server oder fremde
 * Fair-Use-Dienste — beides verträgt kein unbegrenztes Publikum.
 *
 * **Bewusst im Prozessspeicher und ohne Redis.** Die App läuft als ein
 * Node-Prozess auf einem Host, der bereits swappt; ein zweiter Dienst nur
 * für Zähler wäre teurer als das Problem. Preis: die Zähler beginnen nach
 * einem Neustart von vorn. Für den Zweck — Missbrauch bremsen, nicht
 * abrechnen — genügt das.
 *
 * Festes Zeitfenster statt gleitendem: ein gleitendes Fenster bräuchte je
 * Schlüssel eine Liste von Zeitstempeln. Hier reichen zwei Zahlen.
 */

interface Eintrag {
	anzahl: number;
	/** Wann das Fenster endet, als Zeitstempel. */
	bis: number;
}

const zaehler = new Map<string, Eintrag>();

/**
 * Obergrenze für die Tabelle.
 *
 * Ohne sie wäre der Zähler selbst das Angriffsziel: ein Angreifer mit
 * wechselnden Quelladressen ließe die Map unbegrenzt wachsen, bis der
 * Prozess auf einem Host mit 3,7 GB stirbt. Beim Überlauf wird aufgeräumt,
 * und wenn das nicht reicht, wird die Tabelle geleert — lieber ein paar
 * Zähler zu früh zurücksetzen als der App den Speicher nehmen.
 */
const MAX_EINTRAEGE = 20_000;

function aufraeumen(jetzt: number) {
	for (const [k, e] of zaehler) if (e.bis <= jetzt) zaehler.delete(k);
	if (zaehler.size > MAX_EINTRAEGE) zaehler.clear();
}

export interface Grenze {
	/** Erlaubte Anfragen je Fenster. */
	max: number;
	/** Fensterlänge in Millisekunden. */
	fensterMs: number;
}

export interface Ergebnis {
	erlaubt: boolean;
	/** Sekunden bis zum nächsten Fenster — für den `Retry-After`-Kopf. */
	wartenS: number;
}

export function pruefe(schluessel: string, grenze: Grenze): Ergebnis {
	const jetzt = Date.now();
	if (zaehler.size > MAX_EINTRAEGE) aufraeumen(jetzt);

	const vorhanden = zaehler.get(schluessel);

	if (!vorhanden || vorhanden.bis <= jetzt) {
		zaehler.set(schluessel, { anzahl: 1, bis: jetzt + grenze.fensterMs });
		return { erlaubt: true, wartenS: 0 };
	}

	vorhanden.anzahl++;
	if (vorhanden.anzahl > grenze.max) {
		return { erlaubt: false, wartenS: Math.ceil((vorhanden.bis - jetzt) / 1000) };
	}
	return { erlaubt: true, wartenS: 0 };
}

const MINUTE = 60_000;

/**
 * Grenzen je Endpunkt, nach tatsächlichen Kosten bemessen.
 *
 * Höhenkacheln liegen um Größenordnungen höher, weil ein einziger
 * Kartenausschnitt mit Höhenlinien schon dutzende Kacheln lädt — dieselbe
 * Zahl wie beim Routing würde normales Verschieben der Karte abwürgen.
 *
 * Die Ortssuche ist am strengsten: hinter ihr steht eine Drossel, die für
 * *alle* Anfragen zusammen einen Mindestabstand von 1100 ms erzwingt. Wer
 * dort viel abfragt, verlangsamt nicht nur sich selbst, sondern jeden.
 */
export const GRENZEN: { praefix: string; grenze: Grenze }[] = [
	{ praefix: '/api/dem/', grenze: { max: 600, fensterMs: 5 * MINUTE } },
	{ praefix: '/api/route', grenze: { max: 40, fensterMs: 5 * MINUTE } },
	{ praefix: '/api/routen', grenze: { max: 80, fensterMs: 5 * MINUTE } },
	{ praefix: '/api/suche', grenze: { max: 25, fensterMs: 5 * MINUTE } }
];

/** Die Grenze für einen Pfad, oder `null` wenn er unbegrenzt ist. */
export function grenzeFuer(pfad: string): { praefix: string; grenze: Grenze } | null {
	// `/api/routen` steht vor `/api/route`, deshalb die längste Übereinstimmung
	// gewinnen lassen statt der ersten.
	let treffer: { praefix: string; grenze: Grenze } | null = null;
	for (const g of GRENZEN) {
		if (pfad.startsWith(g.praefix) && (!treffer || g.praefix.length > treffer.praefix.length)) {
			treffer = g;
		}
	}
	return treffer;
}

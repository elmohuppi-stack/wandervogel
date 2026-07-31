/** Zahlenformate. Deutsch, mit Dezimalkomma — und überall gleich. */

const nf = (min: number, max: number) =>
	new Intl.NumberFormat('de-DE', { minimumFractionDigits: min, maximumFractionDigits: max });

const nf1 = nf(1, 1);
const nf0 = nf(0, 0);

/** Meter als Kilometer: `14,2` */
export function km(meters: number): string {
	return nf1.format(meters / 1000);
}

/** Höhenmeter, gerundet: `520` */
export function hm(meters: number): string {
	return nf0.format(Math.round(meters));
}

/** Sekunden als `4:25` */
export function duration(seconds: number): string {
	const total = Math.round(seconds / 60);
	const h = Math.floor(total / 60);
	const m = total % 60;
	return `${h}:${String(m).padStart(2, '0')}`;
}

/** Uhrzeit der voraussichtlichen Ankunft: `16:40` */
export function arrival(seconds: number, from = new Date()): string {
	const at = new Date(from.getTime() + seconds * 1000);
	return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(at);
}

/** Geschwindigkeit: `16,7` */
export function speed(kmh: number): string {
	return nf1.format(kmh);
}

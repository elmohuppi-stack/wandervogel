/**
 * Hell und Dunkel — und die Brücke von den CSS-Tokens zur Karte.
 *
 * Die Oberfläche liest Farben über `var(--x)`; MapLibre kann das nicht und
 * braucht fertige Werte. Beide müssen aus derselben Quelle kommen, sonst
 * laufen Karte und Oberfläche auseinander.
 */

import { browser } from '$app/environment';

export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_KEY = 'wv.theme';
const CHOICES: ThemeChoice[] = ['light', 'dark', 'system'];

export function isThemeChoice(v: unknown): v is ThemeChoice {
	return typeof v === 'string' && (CHOICES as string[]).includes(v);
}

/* ---------------------------------------------------------------------------
   Farbtoken zu einem konkreten Wert auflösen
   --------------------------------------------------------------------------- */

let probe: HTMLSpanElement | undefined;

/**
 * `--contour` → `rgb(160, 138, 107)`.
 *
 * Nicht über `getComputedStyle(document.documentElement)`: bei eigenen
 * Eigenschaften gibt das den **rohen Tokenstrom** zurück, bei uns also
 * wörtlich `light-dark(#a08a6b, #4d5a4f)`. MapLibre kann das nicht parsen
 * und lässt die Ebene still aus — kein Fehler in der Konsole, nur eine
 * Karte ohne Höhenlinien.
 *
 * Der Umweg über eine echte `color`-Eigenschaft an einem Sondierelement
 * liefert immer einen aufgelösten Wert, und zwar auch für `color-mix()`
 * und alles andere, was später dazukommt.
 */
export function resolveColorToken(name: string, fallback = '#000'): string {
	if (!browser) return fallback;
	if (!probe) {
		probe = document.createElement('span');
		probe.setAttribute('aria-hidden', 'true');
		probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden';
		document.body.appendChild(probe);
	}
	probe.style.color = '';
	probe.style.color = `var(${name})`;
	const v = getComputedStyle(probe).color;
	return v || fallback;
}

/** Bewegung unterdrücken — gilt auch für die Karte, die kein CSS ist. */
export function prefersReducedMotion(): boolean {
	if (!browser) return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ---------------------------------------------------------------------------
   Zustand
   --------------------------------------------------------------------------- */

class ThemeState {
	/** Was der Nutzer gewählt hat. */
	choice = $state<ThemeChoice>('light');
	/** Was das Betriebssystem sagt — nur relevant, wenn choice === 'system'. */
	systemDark = $state(false);

	/** Was tatsächlich zu sehen ist. Karte und theme-color lesen das. */
	resolved = $derived<'light' | 'dark'>(
		this.choice === 'system' ? (this.systemDark ? 'dark' : 'light') : this.choice
	);

	/**
	 * Einmal im Layout aufrufen.
	 *
	 * Gelesen wird aus dem DOM, nicht aus localStorage: das Inline-Skript in
	 * app.html hat den Speicher schon ausgewertet und das Attribut gesetzt,
	 * bevor der erste Anstrich lief. Zweimal lesen hieße zwei Wahrheiten.
	 */
	init(): void {
		if (!browser) return;
		const attr = document.documentElement.dataset.theme;
		if (isThemeChoice(attr)) this.choice = attr;

		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		this.systemDark = mq.matches;
		mq.addEventListener('change', (e) => {
			this.systemDark = e.matches;
			this.#syncMeta();
		});
		this.#syncMeta();
	}

	set(choice: ThemeChoice): void {
		this.choice = choice;
		if (!browser) return;
		document.documentElement.dataset.theme = choice;
		// Absichtlich hier und nicht in einem $effect: die Reihenfolge zweier
		// Effekte, von denen einer liest und einer schreibt, ist eine
		// Fehlerquelle, die dieses Projekt schon einmal hatte.
		try {
			localStorage.setItem(THEME_KEY, choice);
		} catch {
			// Privater Modus oder gesperrter Speicher — die Wahl gilt dann
			// nur für diese Sitzung. Kein Grund, irgendetwas abzubrechen.
		}
		this.#syncMeta();
	}

	/** Adressleiste des Handys mitfärben. */
	#syncMeta(): void {
		const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
		if (meta) meta.content = resolveColorToken('--paper', '#e9ece6');
	}
}

export const theme = new ThemeState();

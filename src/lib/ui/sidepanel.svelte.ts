import type { Snippet } from 'svelte';

/**
 * Der Platz in der Schiene, den die jeweilige Seite füllt.
 *
 * **Warum es das gibt.** Nach dem Umbau auf die Navigationsschiene standen
 * links zwei Spalten nebeneinander: die Schiene und die Tourenliste. Für
 * einen Gast war die zweite fast leer — zwei Panels für eine Aufgabe.
 *
 * Statt die Liste in das Layout zu ziehen (sie gehört der Startseite) oder
 * die Navigation in jede Seite zu kopieren (sie gehört dem Layout), reicht
 * die Seite ihren Teil hier durch. Das Layout hält den Rahmen, die Seite
 * füllt die Mitte — und es bleibt **ein** Panel.
 *
 * Ein Svelte-5-Snippet ist ein gewöhnlicher Wert; es lässt sich weiterreichen
 * und an anderer Stelle rendern, solange die deklarierende Komponente lebt.
 * Genau das ist hier der Fall: die Seite lebt, solange ihr Inhalt sichtbar
 * ist.
 *
 * **Die Seite muss beim Verlassen aufräumen** — sonst zeigt die nächste
 * Seite den Inhalt der vorigen. Dafür gibt es `belegeSchiene()`, das die
 * Aufräumfunktion gleich mitliefert und in einem `$effect` benutzt wird.
 */
export const schiene = $state<{ inhalt: Snippet | null }>({ inhalt: null });

/**
 * In einem `$effect` aufrufen:
 *
 * ```svelte
 * $effect(() => belegeSchiene(listenInhalt));
 * ```
 *
 * Der Rückgabewert ist die Aufräumfunktion, die Svelte beim Verlassen ruft.
 */
export function belegeSchiene(inhalt: Snippet): () => void {
	schiene.inhalt = inhalt;
	return () => {
		// Nur räumen, wenn noch der eigene Inhalt steht: bei einem Wechsel
		// hat die neue Seite ihren bereits gesetzt, und ihn wegzuwerfen ließe
		// die Schiene leer zurück.
		if (schiene.inhalt === inhalt) schiene.inhalt = null;
	};
}

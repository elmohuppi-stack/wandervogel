/**
 * Die Adresse von MapLibres Web Worker selbst setzen.
 *
 * **Ohne dieses Modul bleibt die Karte im Produktionsbau leer.** MapLibre
 * rechnet sich die Adresse seines Workers zur Laufzeit aus:
 *
 *     let e = import.meta.url;
 *     let t = e.endsWith('-dev.mjs') ? 'maplibre-gl-worker-dev.mjs'
 *                                    : 'maplibre-gl-worker.mjs';
 *     return new URL(`./${t}`, e).href;
 *
 * Der Dateiname steht in einer Variablen. `new URL('./datei', import.meta.url)`
 * erkennt Rollup und legt die Datei mit an — `new URL(`./${t}`, e)` erkennt es
 * nicht. Also zeigt die fertig gebaute Seite auf
 * `/_app/immutable/chunks/maplibre-gl-worker.mjs`, und dort liegt nichts.
 *
 * Der Fehler ist teuer, weil er sich versteckt: die Karte wirft keine Ausnahme,
 * es erscheint ein Canvas, die Kacheln werden sogar geladen — nur verarbeiten
 * kann sie niemand, denn das tut der Worker. Übrig bleibt eine graue Fläche und
 * eine einzelne 404-Zeile im Netzwerkprotokoll. Genau so stand die App nach dem
 * ersten Deploy live.
 *
 * `?worker&url` lässt Vite den Worker als eigenen Einstiegspunkt bauen — damit
 * wird sein Import von `maplibre-gl-shared.mjs` mit aufgelöst, was ein blankes
 * `?url` (das die Datei nur kopiert) nicht täte — und gibt die fertige Adresse
 * zurück. Das gilt für Entwicklung und Produktion gleichermaßen.
 *
 * Der Aufruf steht auf Modulebene: er muss vor der ersten Karte laufen, und
 * jedes Modul, das eine Karte erzeugt, importiert diese Datei ganz oben.
 */

import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { setWorkerUrl } from 'maplibre-gl';

setWorkerUrl(workerUrl);

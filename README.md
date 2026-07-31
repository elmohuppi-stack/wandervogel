# Wandervogel

Eigene Web-App zum Planen und Durchführen von **Wander- und Radtouren** — offline-fähig,
selbst gehostet, ohne API-Schlüssel und ohne Fremddienste im Dauerbetrieb.

Die Anforderungen stehen in [docs/01-anforderungen.md](docs/01-anforderungen.md).

## Was schon läuft

- **Planungsansicht** am Laptop: Karte, Wegpunkte, Route, Kennzahlen, Höhenprofil
- **Routing** über selbst gehostetes BRouter — Wandern und Radfahren über eine Engine
- **Höhenlinien und Schummerung** aus Höhendaten, im Browser berechnet
- **Aktivitätsart** Wandern/Rad schaltet Routing-Profil, Zeitmodell, Farbe und Kennzahlen um

## Noch nicht

Offline-Download · Feldansicht fürs Handy · Anmeldung und Rollen · Datenbank
(Touren leben derzeit nur im Browser-Zustand) · Wanderwege-Overlay aus OSM ·
POIs · Wetter · Ortssuche · GPX-Import und -Export · Archiv

## Einrichten

Voraussetzungen: Node 22+, pnpm, Docker.

```bash
pnpm install
cp .env.example .env        # POSTGRES_PASSWORD setzen
pnpm services               # Postgres/PostGIS + BRouter starten
pnpm segments               # Routing-Segmente für Deutschland (~800 MB)
pnpm dev                    # http://localhost:5180
```

`pnpm segments` ohne Argument lädt Deutschland. Für einen schnellen Start genügt ein
einzelnes Feld:

```bash
pnpm segments E5_N45        # Pfälzerwald, Südwestdeutschland (239 MB)
pnpm segments --alps        # Alpenraum
```

Nach dem Nachladen von Segmenten: `docker compose restart brouter`.

## Skripte

| Befehl | Wirkung |
| --- | --- |
| `pnpm dev` | Entwicklungsserver auf Port 5180, auch im WLAN erreichbar |
| `pnpm build` / `pnpm preview` | Produktions-Build (adapter-node) |
| `pnpm check` | Typen und Svelte prüfen |
| `pnpm services` / `services:stop` / `services:logs` | Docker-Dienste |
| `pnpm segments [FELD…]` | BRouter-Segmente laden |

## Architektur in Kürze

| Baustein | Wahl | Warum |
| --- | --- | --- |
| Frontend + Server | SvelteKit, TypeScript, `adapter-node` | ein Node-Prozess, ein Docker-Image |
| Karte | MapLibre GL, direkt angesprochen | MapLibre ist imperativ; eine deklarative Hülle arbeitet dagegen |
| Routing | BRouter, selbst gehostet | als Fahrrad-Router entstanden, um Wanderprofile erweitert — beide Aktivitäten über *eine* Engine |
| Höhendaten | Terrarium-Kacheln über `/api/dem` | die offenen Quellen senden kein CORS; der Umweg ist zugleich die Produktionsarchitektur |
| Höhenlinien | `maplibre-contour` im Browser | keine vorgerenderten Kacheln nötig, funktioniert später offline |
| Datenbank | Postgres + PostGIS | Geo-Abfragen im Archiv |

### Die Naht zwischen Wandern und Radfahren

Alles Aktivitätsabhängige steht in **einer** Datei:
[`src/lib/geo/activity.ts`](src/lib/geo/activity.ts) — Routing-Profil, Zeitmodell,
Kennzahlen, Kartenlayer, POI-Gruppen, Offline-Vorbelegungen, Warnschwelle.

> **Regel:** Im Code steht nirgendwo `if (activityType === 'hike')`.
> Fehlt etwas, wird es ein Feld in der Aktivitätsdefinition — nicht eine Verzweigung
> in der Oberfläche. Eine dritte Aktivitätsart soll ein Eintrag sein, kein Umbau.

## Datenquellen

Entwicklung und Betrieb unterscheiden sich bewusst. Die Anforderung verbietet
Fremd-Fair-Use-Dienste im Dauerbetrieb.

| Zweck | Entwicklung | Betrieb |
| --- | --- | --- |
| Basiskarte | OpenFreeMap | selbst gehostete Protomaps-PMTiles |
| Höhendaten | offene AWS-Terrain-Kacheln | lokale PMTiles-Dateien |
| Routing | BRouter lokal | BRouter lokal |

Umgestellt wird über `.env`; die Karte liest ihre Quellen aus
[`src/lib/config.ts`](src/lib/config.ts).

## Stolpersteine, die schon Zeit gekostet haben

Festgehalten, damit sie nicht zweimal auftreten:

- **`maplibre-gl` muss aus `optimizeDeps` heraus.** Sonst bündelt Vite die Bibliothek vor,
  ihr Web Worker wird unauffindbar, und die Karte bleibt **völlig leer — ohne jede
  Fehlermeldung in der Konsole**.
- **`raster-dem` braucht `tiles: [...]`, nicht `url:`.** `url` erwartet ein
  TileJSON-Dokument und fordert `dem-shared://{z}/{x}/{y}` wörtlich an. Das Relief
  bleibt dann still aus.
- **Kachel-URLs nicht durch `new URL()` schicken.** Das kodiert `{z}` zu `%7Bz%7D`.
- **`text-font` immer angeben**, gelesen aus dem Style der Basiskarte. MapLibres Standard
  (`Open Sans Regular`) existiert bei OpenFreeMap nicht — sonst 404 bei jedem Laden.
- **Postgres:** deutsche Sortierung über `POSTGRES_INITDB_ARGS` mit ICU, nicht über
  `LANG=de_DE.utf8`. Das Image erzeugt diese Locale nicht, `initdb` scheitert endlos.
- **PostGIS-Image:** `postgis/postgis` ist amd64-only. `imresamu/postgis` ist derselbe
  Inhalt als Multi-Arch — nötig für Apple Silicon.

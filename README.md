# Wandervogel

Eigene Web-App zum Planen und Durchführen von **Wander- und Radtouren** — offline-fähig,
selbst gehostet, ohne API-Schlüssel und ohne Fremddienste im Dauerbetrieb.

Die Anforderungen stehen in [docs/01-anforderungen.md](docs/01-anforderungen.md).

## Was schon läuft

- **Planungsansicht** am Laptop: Karte, Wegpunkte, Route, Kennzahlen, Höhenprofil
- **Routing** über selbst gehostetes BRouter — Wandern und Radfahren über eine Engine
- **Höhenlinien und Schummerung** aus Höhendaten, im Browser berechnet
- **Aktivitätsart** Wandern/Rad schaltet Routing-Profil, Zeitmodell, Farbe und Kennzahlen um

## Woran gerade gearbeitet wird

Der Planer rechnet richtig, sieht aber leer aus: keine Icons, fünf Knopfstile, kein
Abstandsmaß, und eine Tour überlebt kein Neuladen. Der Vergleich mit Komoot hat das
Zielbild geschärft — **das Handwerk übernehmen, das Beiwerk nicht** (siehe
[Anforderungen §7](docs/01-anforderungen.md)). Daraus folgt die Reihenfolge:

1. **Gestaltungsfundament** — Maße für Abstand, Radius, Ebene, Bewegung; ein lokaler
   Iconsatz; Bausteine statt Einzelfälle; Hell/Dunkel umschaltbar, hell als Standard
2. **Planer umbauen** — sichtbare Werkzeuge, ein Leerzustand, der die Gesten erklärt,
   statt eines grauen Textkastens
3. **Datenbank und Speichern** — Postgres/PostGIS, Route als Geometrie, Kennzahlen mitgeführt
4. **Startbildschirm** — Tourenliste mit Umriss-Vorschau neben einer Übersichtskarte

Die vollständige Etappenliste steht in [Anforderungen §9](docs/01-anforderungen.md).

## Noch nicht

Offline-Download · Feldansicht fürs Handy · Anmeldung und Rollen · Datenbank
(Touren leben derzeit nur im Browser-Zustand) · Wanderwege-Overlay aus OSM ·
POIs · Wetter · Ortssuche · GPX-Import und -Export · Archiv

## Einrichten

Voraussetzungen: Node 22+, pnpm, Docker.

```bash
cp .env.example .env        # POSTGRES_PASSWORD setzen
make install
make segments               # Routing-Segmente für Deutschland (~800 MB)
make start                  # Dienste + http://localhost:5180
```

`make start` fährt Docker-Dienste und Entwicklungsserver im Hintergrund hoch,
`make stop` beides wieder herunter. `make` allein zeigt alle Befehle.

`pnpm segments` ohne Argument lädt Deutschland. Für einen schnellen Start genügt ein
einzelnes Feld:

```bash
pnpm segments E5_N45        # Pfälzerwald, Südwestdeutschland (239 MB)
pnpm segments --alps        # Alpenraum
```

Nach dem Nachladen von Segmenten: `docker compose restart brouter`.

## Befehle

| Befehl | Wirkung |
| --- | --- |
| `make start` / `make stop` / `make restart` | Dienste und Entwicklungsserver, Port 5180, auch im WLAN erreichbar |
| `make dev` | Entwicklungsserver im Vordergrund, Strg-C beendet |
| `make status` | läuft was? |
| `make build` | Produktions-Build (adapter-node) |
| `make preview` | gebaute App über `node build` auf Port 3000 |
| `make check` | Typen und Svelte prüfen |
| `make services` / `services-stop` / `logs` | nur die Docker-Dienste |
| `make segments ARGS=E5_N45` | BRouter-Segmente laden |
| `make clean` / `clean-all` | Build-Artefakte, zusätzlich `node_modules` |

Logs der im Hintergrund gestarteten Server liegen in `.run/`. Die zugrunde
liegenden `pnpm`-Skripte in [package.json](package.json) funktionieren
unverändert weiter.

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

## Gestaltung in fünf Regeln

Ausführlich in [Anforderungen §7](docs/01-anforderungen.md); hier das Nötigste beim Coden.

1. **Jede Aktion hat ein Symbol.** Aus dem eigenen Iconsatz, eine Strichstärke, lokal
   gebündelt — die Feldansicht darf nichts nachladen. Kein `×` und kein `⠿` als Textzeichen.
2. **Gesten sind ein Zusatz, nie die einzige Tür.** Rechtsklick löscht *und* daneben steht
   ein Papierkorb. Was nur mit der Maus geht, gibt es auf dem Handy nicht.
3. **Maße kommen aus Tokens.** Abstand, Radius, Ebene, Bewegung, Schatten stehen in
   [`src/app.css`](src/app.css). Eine neue Zahl im `<style>`-Block ist ein Fehler.
4. **Farben der Oberfläche und der Karte sind ein Satz.** MapLibre liest dieselben Tokens.
   Wandern rot, Radfahren blau; semantische Farben nie als Akzent.
5. **Leerzustände bieten etwas an.** Sie beschreiben keinen Zustand, sie zeigen den nächsten
   Schritt — inklusive der Gesten, die man sonst nie erfährt.

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

### Fallen, die schon erkannt, aber noch nicht getroffen sind

Beim Planen der nächsten Etappen aufgefallen — hier notiert, damit sie niemanden kalt erwischen:

- **`light-dark()` und `getComputedStyle` vertragen sich nicht.** Eigene Eigenschaften geben
  den rohen Tokenstrom zurück, also wörtlich `light-dark(#a08a6b, #4d5a4f)`. MapLibre kann
  das nicht lesen, Höhenlinien und Schummerung fallen **still** aus — und zwar schon beim
  ersten Laden, nicht erst beim Umschalten. Farbtokens müssen über ein Sondierelement
  aufgelöst werden (`style.color = var(--x)`, dann `getComputedStyle().color`).
- **`drizzle-kit` und die PostGIS-Nebenschemata.** Das Image bringt `tiger`, `tiger_data`,
  `topology` und `spatial_ref_sys` mit. Ohne `schemaFilter: ['public']` **und**
  `extensionsFilters: ['postgis']` schlägt `drizzle-kit push` vor, die komplette
  PostGIS-Installation zu löschen. Das ist die einzige Stelle, die Daten zerstören kann.
- **`map.setStyle()` wirft alle Laufzeit-Ebenen weg** — Relief, Höhenlinien, Route und
  Wegpunkte müssten neu aufgebaut werden. Deshalb kommt der dunkle *Kartenstil* erst mit den
  eigenen Protomaps-Dateien; bis dahin dunkle Oberfläche über heller Karte.
- **Drizzles `geometry()` kann nur Punkte.** Eine `LineStringZ`-Spalte braucht `customType`
  für die DDL und rohes SQL (`ST_AsGeoJSON` / `ST_GeomFromGeoJSON`) für Lesen und Schreiben.

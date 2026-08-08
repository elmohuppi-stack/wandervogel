# Wandervogel

Eigene Web-App zum Planen und Durchführen von **Wander- und Radtouren** — selbst gehostet,
ohne API-Schlüssel und ohne Fremddienste im Dauerbetrieb.

> **Wandervogel ist eine Online-App.** Ohne Netz startet sie nicht. Der Offline-Betrieb war
> bis zum 7. August 2026 der erklärte Kernnutzen und ist gestrichen — mit Rechnung und Preis
> in [Anforderungen §11](docs/01-anforderungen.md).

Die Anforderungen stehen in [docs/01-anforderungen.md](docs/01-anforderungen.md).

## Was schon läuft

- **Ohne Konto benutzbar**: Karte, Ortssuche, Routing, Höhenprofil und Wegenetz
  stehen jedem offen. Ein Konto braucht nur, wer **behalten** will — speichern,
  Archiv, GPX-Export. Der Entwurf überlebt den Weg über die Anmeldung
- **Anmeldung mit Rollen**: Sitzungen in der Datenbank, Passwörter mit scrypt.
  Der Schutz liegt in `hooks.server.ts` an einer Stelle, nicht in jeder Route —
  eine neue Seite ist dadurch standardmäßig zu, nicht standardmäßig offen
- **Begrenzung je IP** auf allen Endpunkten, die ohne Konto offenstehen
- **Impressum und Datenschutz** unter `/impressum` und `/datenschutz`, ohne
  Anmeldung erreichbar
- **Einklappbare Navigationsschiene** links statt einer Kopfzeile je Seite:
  Marke, Navigation, Konto, Thema und die Rechtsverweise an einer Stelle.
  Eingeklappt bleiben die Symbole stehen, nur die Wörter gehen. Die
  Tourenliste sitzt darin, nicht daneben — ein linkes Panel, nicht zwei
- **Rückfragen im eigenen Dialog**, nicht über `confirm()`: Verlassen mit
  ungespeicherten Änderungen, Tour löschen, User löschen, Abmelden
- **Userverwaltung** für Admins unter `/verwaltung`: anlegen, umbenennen,
  Rolle setzen, deaktivieren, Passwort zurücksetzen und **endgültig löschen**
  — Letzteres nimmt die Touren des Kontos mit, wie die Datenschutzerklärung
  es zusagt, und fragt vorher mit deren Zahl nach. Keine Selbstregistrierung
- **Startbildschirm**: Tourenarchiv als Liste *und* Karte, mit Umriss-Vorschau,
  Filter nach Aktivitätsart, Sortierung und Stichwortsuche
- **Planungsansicht** am Laptop: Karte, Wegpunkte, Route, Kennzahlen, Höhenprofil
- **Routing** über selbst gehostetes BRouter — Wandern und Radfahren über eine Engine
- **Höhenlinien und Schummerung** aus Höhendaten, im Browser berechnet
- **Aktivitätsart** Wandern/Rad schaltet Routing-Profil, Zeitmodell, Farbe, Symbole,
  Betonung der Kennzahlen und Kartenlayer um
- **Speichern** in Postgres/PostGIS, mit Datum und Notiz; unfertige Touren überleben
  als lokaler Entwurf
- **GPX-Export** jeder Tour
- **Hell und Dunkel** umschaltbar, hell als Standard — die Karte geht mit
- **Ortssuche** und **eigener Standort** auf beiden Karten
- **Markiertes Wegenetz** ein- und ausblendbar, passend zur Aktivitätsart
- **Vorhandene Route übernehmen** (Weg B): die markierten Wege im Kartenausschnitt
  auflisten *oder* nach Namen suchen — mit dem echten Markierungszeichen, Betreiber
  und Untergrund — und als eigene Tour übernehmen
- **GPX importieren** (Weg C), mit oder ohne Höhen in der Datei
- **Höhen aus dem eigenen Höhenmodell**, im Browser aus den Terrarium-Kacheln gelesen
- **Sicherung** der Nutzdaten mit einem Befehl

## Noch nicht

Feldansicht fürs Handy ·
**eigenes** Wegenetz-Overlay aus einem OSM-Extrakt · Untergrund entlang der
Route auf der Karte einfärben · POIs · Wetter · Track-Aufzeichnung ·
Vergleich geplant ↔ durchgeführt · dunkler Kartenstil

Die Reihenfolge steht in [Anforderungen §9](docs/01-anforderungen.md).

## Ausdrücklich nicht

Offline-Download, Service Worker, PWA-Installation, Kartenkacheln auf dem Gerät. Gestrichen
am 7. August 2026, nicht verschoben — [Anforderungen §11](docs/01-anforderungen.md) nennt
Gewinn und Preis. Wer das wieder aufnehmen will, liest dort zuerst „Der Weg zurück".

## Einrichten

Voraussetzungen: Node 22+, pnpm, Docker.

```bash
cp .env.example .env        # POSTGRES_PASSWORD setzen
make segments               # Routing-Segmente für Deutschland (~800 MB)
make db-migrate             # Tabellen anlegen
make db-admin NAME=elmar PASS=… ANZEIGE="Elmar Hepp"   # erster Zugang
make start                  # Dienste + http://localhost:5180
```

Abhängigkeiten installiert jedes Ziel selbst, sobald `package.json` sich ändert —
ein eigenes `make install` gibt es nicht mehr.

`make db-admin` ist der **einzige** Weg in eine frische Installation — es gibt
keine Selbstregistrierung. Auf einen vorhandenen Namen angewandt setzt der
Aufruf dessen Passwort zurück und beendet alle offenen Sitzungen; das ist
zugleich die Notbremse, wenn niemand mehr hineinkommt.

`make start` fährt Docker-Dienste und Entwicklungsserver im Hintergrund hoch,
`make stop` beides wieder herunter. `make` allein zeigt alle Befehle.

`pnpm segments` ohne Argument lädt Deutschland. Für einen schnellen Start genügt ein
einzelnes Feld:

```bash
pnpm segments E5_N45        # Pfälzerwald, Südwestdeutschland (239 MB)
pnpm segments --alps        # Alpenraum
```

Nach dem Nachladen von Segmenten: `make brouter-restart`.

## Befehle

| Befehl | Wirkung |
| --- | --- |
| `make start` / `make stop` / `make restart` | Dienste und Entwicklungsserver, Port 5180, auch im WLAN erreichbar |
| `make dev` | Entwicklungsserver im Vordergrund, Strg-C beendet |
| `make status` | läuft was? |
| `make build` | Produktions-Build (adapter-node) |
| `make preview` | gebaute App über `node build` auf Port 3000 |
| `make check` | Typen und Svelte prüfen |
| `make logs` | Docker-Logs folgen |
| `make segments ARGS=E5_N45` | BRouter-Segmente laden |
| `make brouter-restart` | BRouter neu starten, damit neue Segmente greifen |
| `make db-migrate` / `db-generate` | Schema anwenden, Migration erzeugen |
| `make db-admin NAME=… PASS=…` | Admin anlegen oder sein Passwort zurücksetzen; `ANZEIGE=…` optional. `make db-admin` allein erklärt die Werte |
| `make db-studio` | Tabellen im Browser ansehen |
| `make db-dump` / `db-restore FILE=…` | Nutzdaten sichern und zurückspielen |
| `make clean` | Build-Artefakte entfernen |

`make` allein zeigt diese Liste — sie wird aus den `##`-Kommentaren im Makefile
erzeugt und kann deshalb nicht mehr davon abweichen. Logs der im Hintergrund
gestarteten Server liegen in `.run/`. Die zugrunde liegenden `pnpm`-Skripte in
[package.json](package.json) funktionieren unverändert weiter.

**Vor dem Livegang:** die `PUBLIC_LEGAL_*`-Werte in `.env` setzen. Solange sie
fehlen, tragen Impressum und Datenschutzerklärung einen Entwurfshinweis und
erfüllen ihren Zweck nicht.

## Architektur in Kürze

| Baustein | Wahl | Warum |
| --- | --- | --- |
| Frontend + Server | SvelteKit, TypeScript, `adapter-node` | ein Node-Prozess, ein Docker-Image |
| Karte | MapLibre GL, direkt angesprochen | MapLibre ist imperativ; eine deklarative Hülle arbeitet dagegen |
| Routing | BRouter, selbst gehostet | als Fahrrad-Router entstanden, um Wanderprofile erweitert — beide Aktivitäten über *eine* Engine |
| Speicher im Betrieb | App `mem_limit 512m`, BRouter `-Xmx512m` bei `mem_limit 640m` | die JVM kennt das Container-Limit nicht und dimensioniert nach dem Host: ohne `-Xmx` wächst sie hinein und wird erschlagen. Ausgeliefert war `-Xmx1g` — mehr als die Hälfte des freien Speichers auf dem Zielserver |
| Höhendaten | Terrarium-Kacheln über `/api/dem` | die offenen Quellen senden kein CORS; der Umweg ist zugleich die Produktionsarchitektur |
| Höhenlinien | `maplibre-contour` im Browser | keine vorgerenderten Kacheln nötig — die Linien entstehen aus dem Höhenmodell, das ohnehin geladen wird |
| Datenbank | Postgres + PostGIS, Drizzle | Route als `geometry(LineStringZ)`: der Regionsfilter ist ein `ST_Intersects` auf einem GiST-Index statt einer Schleife in Node |
| Symbole | eigener Satz, lokal gebündelt | keine Fremddienste im Dauerbetrieb; fünf gebrauchte Glyphen gibt es fertig nirgends |
| Passwörter | scrypt aus `node:crypto` | argon2 und bcrypt sind native Module mit Build-Schritt — auf dem kleinen Server ein Risiko ohne Gegenwert |
| Sitzungen | Tabelle + httpOnly-Cookie, **kein JWT** | ein Token lässt sich nicht zurückrufen; „Nutzer deaktivieren" wäre damit eine Lüge |
| Ratenbegrenzung | im Prozessspeicher, kein Redis | ein zweiter Dienst nur für Zähler wäre teurer als das Problem; Preis ist ein Neustart, der die Zähler vergisst |

### Zwei Farbwelten, ein Tokensatz

Die Oberfläche kippt mit Hell und Dunkel, die **Karte nicht** — sie ist auf die
Basiskarte abgestimmt, und die ist in beiden Modi dieselbe helle. Deshalb gibt es
`--route-hike` (Oberfläche, wechselt) und `--map-route-hike` (Karte, fest). Welche wo
gilt, entscheidet die Aktivitätsdefinition über `colorVar` und `mapColorVar`. Beide
Hälften kommen zusammen, wenn der dunkle Kartenstil mit den eigenen Protomaps-Dateien
steht.

### Die Naht zwischen Wandern und Radfahren

Alles Aktivitätsabhängige steht in **einer** Datei:
[`src/lib/geo/activity.ts`](src/lib/geo/activity.ts) — Routing-Profil, Zeitmodell,
Kennzahlen, Kartenlayer, POI-Gruppen, Warnschwelle.

> **Regel:** Im Code steht nirgendwo `if (activityType === 'hike')`.
> Fehlt etwas, wird es ein Feld in der Aktivitätsdefinition — nicht eine Verzweigung
> in der Oberfläche. Eine dritte Aktivitätsart soll ein Eintrag sein, kein Umbau.

## Gestaltung in fünf Regeln

Ausführlich in [Anforderungen §7](docs/01-anforderungen.md); hier das Nötigste beim Coden.

1. **Jede Aktion hat ein Symbol.** Aus dem eigenen Iconsatz, eine Strichstärke, lokal
   gebündelt — nichts wird von fremden Servern nachgeladen. Kein `×` und kein `⠿` als
   Textzeichen.
2. **Gesten sind ein Zusatz, nie die einzige Tür.** Rechtsklick löscht *und* daneben steht
   ein Papierkorb. Was nur mit der Maus geht, gibt es auf dem Handy nicht.
3. **Maße kommen aus Tokens.** Abstand, Radius, Ebene, Bewegung, Schatten stehen in
   [`src/app.css`](src/app.css). Eine neue Zahl im `<style>`-Block ist ein Fehler.
4. **Farben der Oberfläche und der Karte sind ein Satz.** MapLibre liest dieselben Tokens.
   Wandern rot, Radfahren blau; semantische Farben nie als Akzent.
5. **Leerzustände bieten etwas an.** Sie beschreiben keinen Zustand, sie zeigen den nächsten
   Schritt — inklusive der Gesten, die man sonst nie erfährt.

## Deployment

Der konkrete Weg zum ersten Deploy steht als abzuarbeitende Liste in
**[docs/02-deployment-plan.md](docs/02-deployment-plan.md)** — samt der beiden
Entscheidungen, die vorher fallen müssen. Die Datei wird nach dem Livegang gelöscht.

Der allgemeine Ablauf läuft nach **[`optimize-hetzner/NEUE-APP.md`](../optimize-hetzner/NEUE-APP.md)** —
Portvergabe, Datenbank an `pg-shared`, Compose-Skelett, Rechtsseiten, Reihenfolge der
Live-Schaltung und die Checkliste stehen dort und gelten für alle Apps auf dem Host.

Hier steht nur, was diese App eigenbringt:

| | |
| --- | --- |
| Domain | `wandervogel.elmarhepp.de` — kein DNS-Eintrag nötig, der Wildcard zeigt schon hin |
| Portblock | **3101 / 3102**, entschieden am 8. August; `umweg` ist auf 3111/3112 vorgemerkt |
| Datenbank | eigene DB an `pg-shared`, ICU-Kollation `de-DE` — **angelegt am 8. August**, Zugangsdaten in `/var/www/wandervogel/.env.db` |
| Extension | **PostGIS 3.6.4** — steht seit dem 8. August im gemeinsamen Bild `pg-shared:pg17-postgis` |
| Speicher | siehe Architekturtabelle oben |
| Ortssuche | öffentliches Nominatim als **benannte Ausnahme** nach [Anforderungen §7](docs/01-anforderungen.md), Regel 3 — eine eigene Instanz braucht ein Vielfaches der 3,7 GB |
| Nächste Nacharbeit | Höhendaten auf lokale PMTiles: der einzige Dienst, den der **Server** dauerhaft fremd abruft (§7 Regel 1) |
| Vor dem Livegang | `PUBLIC_LEGAL_*` in `.env` setzen, sonst tragen Impressum und Datenschutz den Entwurfshinweis |

Gebaut wird über [`Dockerfile`](Dockerfile) (drei Stufen, 434 MB) und
[`docker-compose.prod.yml`](docker-compose.prod.yml) — **ohne `db`-Service**, die
Datenbank ist `pg-shared`. Der erste Zugang entsteht im laufenden Container:

```bash
docker compose -f docker-compose.prod.yml exec -e NAME=… -e PASS=… app node scripts/admin.mjs
```

`/health` prüft die Datenbankverbindung mit und meldet 503, wenn sie fehlt — ein
Endpunkt, der nur „der Prozess lebt" sagt, ist im einzigen Moment nutzlos, in dem
man ihn braucht.

`docker-compose.dev.yml` heißt bewusst so: es enthält einen eigenen Postgres, der auf dem
Server falsch wäre. Unter diesem Namen kann ein blankes `docker compose up -d` im
ausgecheckten Verzeichnis keinen zweiten Postgres starten.

## Datenquellen

Entwicklung und Betrieb unterscheiden sich bewusst. Die Anforderung verbietet
Fremd-Fair-Use-Dienste im Dauerbetrieb.

| Zweck | Entwicklung | Betrieb |
| --- | --- | --- |
| Basiskarte | OpenFreeMap | selbst gehostete Protomaps-PMTiles |
| Höhendaten | offene AWS-Terrain-Kacheln | lokale PMTiles-Dateien |
| Routing | BRouter lokal | BRouter lokal |
| Ortssuche | öffentliches Nominatim über `/api/suche` | eigene Nominatim-Instanz |
| Wegenetz | waymarkedtrails-Raster | eigenes Vektor-Overlay aus OSM-Extrakt |
| Routensuche | Waymarked-Trails-API über `/api/routen` | eigener OSM-Extrakt |

Das Wegenetz ist die einzige zugelassene Fremdquelle für die Planung — die
Anforderungen erlauben sie in Abschnitt 10 ausdrücklich, aber nur als
*optionales* Overlay. Es ist deshalb standardmäßig aus und zeigt immer nur
die Routen **einer** Aktivitätsart.

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

- **`light-dark()` und `getComputedStyle` vertragen sich nicht.** Eigene Eigenschaften
  geben den rohen Tokenstrom zurück, nachgemessen also wörtlich
  `light-dark(#a08a6b, #4d5a4f)`. MapLibre kann das nicht lesen, Höhenlinien und
  Schummerung fallen **still** aus — schon beim ersten Laden, nicht erst beim
  Umschalten. Dafür gibt es `resolveColorToken()` in
  [`src/lib/ui/theme.svelte.ts`](src/lib/ui/theme.svelte.ts): Sondierelement,
  `style.color = var(--x)`, dann `getComputedStyle().color`.
- **`drizzle-kit` und die PostGIS-Nebenschemata.** Das Image bringt `tiger`,
  `tiger_data`, `topology` und `spatial_ref_sys` mit. Ohne `schemaFilter: ['public']`
  **und** `extensionsFilters: ['postgis']` schlägt `push` vor, die komplette
  PostGIS-Installation zu löschen. Die einzige Stelle im Projekt, die Daten
  zerstören kann — erzeugte Migrationen deshalb vor dem Anwenden lesen.
- **Drizzles `geometry()` kann nur Punkte.** Eine `LineStringZ`-Spalte braucht
  `customType` für die DDL und rohes SQL (`ST_AsGeoJSON` / `ST_GeomFromGeoJSON`).
- **MapLibre verschluckt Rechtsklicks.** Sein `BlockableMapEventHandler` setzt in
  `reset()` ein `_ignoreContextMenu`, das nur ein *linker* mousedown wieder aufhebt —
  nach der ersten Kartenaktion kommt bei `map.on('contextmenu')` nichts mehr an,
  still und ohne Fehler. Der Handler hängt deshalb am DOM-Ereignis des
  Canvas-Containers.
- **`map.setStyle()` wirft alle Laufzeit-Ebenen weg** — Relief, Höhenlinien, Route und
  Wegpunkte müssten neu aufgebaut werden. Deshalb kommt der dunkle *Kartenstil* erst
  mit den eigenen Protomaps-Dateien.
- **Der Neuberechnungs-Effekt darf nicht beim Einhängen feuern.** Sonst wird eine
  gerade aus der Datenbank geladene Route neu geroutet — und wenn BRouter aus ist,
  durch `null` ersetzt. Ein Schlüssel aus Aktivitätsart und Wegpunkten verhindert das.
- **Waymarked Trails will die Bounding Box in Web-Mercator.** Mit Gradzahlen
  antwortet der Dienst mit HTTP 200 und einer *leeren* Liste — es sieht also
  aus, als lägen dort keine Wege. Hat mich einmal zu der falschen Aussage
  gebracht, es gebe keinen Endpunkt für „was liegt hier".
- **Aus einer OSM-Relation wird keine Route durch Neurouten.** Am
  Nibelungensteig gemessen: 25 Wegpunkte → 106,3 km statt 126,1 km (−16 %),
  60 Wegpunkte immer noch −7 %. Der Router schneidet Kurven ab. Die Linie
  wird deshalb genau übernommen und bekommt ihre Höhen aus dem eigenen
  Höhenmodell.
- **Aus dem Höhenmodell gelesene Aufstiege fallen hoch aus.** Ohne Glättung
  4985 hm für einen Weg mit rund 3300 hm. Die Messreihe steht in
  [`src/lib/geo/elevation.ts`](src/lib/geo/elevation.ts). Auch geditzt bleibt
  ein Aufschlag — das ist bei jedem Tourenportal so.
- **`casing: 'snake_case'` in `drizzle.config.ts` gilt nur für drizzle-kit.** Der
  Abfragebauer zur Laufzeit braucht dieselbe Angabe noch einmal in `drizzle()`,
  sonst fragt er `"displayName"` gegen eine Spalte `display_name` ab. Fiel erst
  bei der Anmeldung auf, weil `db/tours.ts` ausschließlich rohes SQL schreibt.
- **Eine korrelierte Unterabfrage ohne Namen zählt still null.** `sql\`(select
  count(*) …)\`` läuft ohne Fehler, aber Drizzle findet die Spalte im Ergebnis
  nicht wieder. Ein Join bildet sauber ab — und ein Falschwert, der plausibel
  aussieht, ist schlimmer als eine Ausnahme.
- **Ein Snippet überlebt seine Seite.** Die Tourenliste wird über
  `ui/sidepanel.svelte.ts` ins Layout durchgereicht. Wird sie beim
  Seitenwechsel nicht geräumt, greift sie auf die Daten der zerstörten Seite
  zu. Geräumt wird in `beforeNavigate` — aber **nur bei echtem Routenwechsel**,
  sonst verschwindet die Liste, wenn man denselben Menüeintrag zweimal klickt.
- **Web-Mercator braucht beide Achsen im Bogenmaß.** Grad für x und Bogenmaß für y
  streckt x um 180/π; in der Umriss-Vorschau sah damit jede Tour aus wie ein
  waagerechter Strich.

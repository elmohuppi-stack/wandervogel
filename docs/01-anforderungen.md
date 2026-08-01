# Wandervogel — Anforderungen

> **Status:** Anforderungen vollständig geklärt, keine offenen Punkte.
> **Gewählt: Variante C** — Wandern vollständig, Radfahren als Kernfeature, Architektur von
> Anfang an zweigleisig (Abschnitt 8). Name bleibt **Wandervogel**.
> Nächster Schritt ist der technische Implementierungsplan (Abschnitt 9).
>
> **Nachtrag 1. August 2026 — Gestaltung geschärft.** Nach dem ersten lauffähigen Planer
> zeigte der direkte Vergleich mit Komoot, dass Abschnitt 7 zu einseitig gelesen wurde:
> „Bedienelemente treten zurück" wurde als „es gibt keine" umgesetzt. Der Frust galt dem
> **Beiwerk**, nie dem **Handwerk**. Abschnitt 7 unterscheidet das jetzt ausdrücklich,
> Abschnitt 9 nennt die daraus folgende Reihenfolge.

---

## 1. Kontext

Elmar plant und unternimmt **Wander- und Radtouren** in Deutschland und Europa, bisher mit
**Komoot**. Zwei Dinge stören konkret: **zu viel Beiwerk um die Karte**
(Community-Highlights, Vorschläge, Premium-Werbung) und **zu viele Klicks für einfache
Handgriffe**. Dazu kommt: unterwegs ist oft kein Netz.

Zum Vergleich wurde **Wanderer** (v0.20.0) lokal per Docker installiert und der Code geprüft.
Befund: solide Basis (SvelteKit + MapLibre GL 5.24, OpenFreeMap-Vektorstyle, chart.js-Höhenprofil,
Three.js-3D), aber **kein Service Worker, keine PMTiles, also null Offline-Fähigkeit**, dazu
PocketBase als DB und ein für diesen Zweck irrelevanter Fediverse-Teil.
**Entscheidung: Wanderer dient als GUI-Anregung, nicht als Codebasis.**

**Angestrebtes Ergebnis:** eine App, die weniger kann als Komoot, aber das Wenige klar —
und die im Funkloch vollständig funktioniert.

**Was Komoot gut macht.** Der Ärger gilt dem Beiwerk, nicht der Machart. Komoot ist handwerklich
sauber gebaut, und genau das ist der Maßstab: jede Aktion hat ein sichtbares Symbol, Tourenlisten
sind dicht und aussagekräftig (Vorschaubild, Kennzahlen, Aktivitätsart auf einen Blick), Filter
liegen offen statt in Menüs, Flächen sind hell und ruhig, Zahlen groß und lesbar. Diese Qualität
ist erklärtes Ziel. **Übernommen wird das Handwerk, abgelehnt bleibt der Inhalt** — Feed,
Community-Highlights, Werbung, fremde Tourenvorschläge. Abschnitt 7 trennt beides Punkt für Punkt.

---

## 2. Nutzer, Geräte, Betrieb

| | |
|---|---|
| **Nutzer** | Mehrere, mit einfacher Verwaltung und Rollen. Primär Elmar; weitere Personen möglich. |
| **Laptop** | Primäres **Planungsgerät**. Große Karte, Maus, Tastatur, viel Bildschirm. |
| **Handy (Android)** | Primäres **Feldgerät**. Offline, Sonnenlicht, eine Hand bzw. Lenkerhalterung. |
| **Server** | Hetzner Cloud, klein: ca. 2–4 vCPU, 4–8 GB RAM, 40–80 GB SSD. |
| **Verteilung** | Web-App im Browser. Auf dem Handy als PWA installiert. |

**Wichtig:** Laptop und Handy sind **nicht dieselbe Oberfläche in zwei Breiten**. Sie haben
verschiedene Aufgaben und dürfen verschieden aussehen. Kein responsive Kompromiss, der auf
beiden Geräten mittelmäßig ist.

**Tourprofil:** überwiegend **Tagestouren**. Mehrtages-/Etappenplanung ist bewusst *kein*
MVP-Thema, das Datenmodell wird sie aber nicht verbauen.

---

## 3. Leitkonzept: Aktivitätsart

Die App unterstützt **Wandern und Radfahren**. Beide teilen den kompletten Unterbau — Karte,
Planungswerkzeug, Offline-Mechanik, Feldansicht, Archiv. Die Aktivitätsart ist eine
**Eigenschaft der Tour** und steuert davon abgeleitet:

| Was sich unterscheidet | Wandern | Radfahren |
|---|---|---|
| **Routing-Profil** | BRouter Wanderprofil (`sac_scale`, `trail_visibility`) | BRouter `trekking` — Tourenrad |
| **Zeitschätzung** | DAV/SAC-Formel (Steigung dominiert) | Geschwindigkeitsmodell mit Steigung und Untergrund |
| **Wegenetz-Overlay** | OSM `route=hiking` | OSM `route=bicycle` |
| **Relevante Wegeigenschaften** | Schwierigkeit, Trittsicherheit, Markierung | **Untergrund** (`surface`), **Belagsqualität** (`smoothness`), Steigungsprozente |
| **Radtyp** | — | **nur Tourenrad/Trekking.** Kein Gravel, MTB, Rennrad |
| **POIs** | Hütte, Trinkwasser, Einkehr, Bushaltestelle | Radladen, Reparaturstation, Trinkwasser, Einkehr, Bahnhof |
| **Feldansicht-Kennzahlen** | Restdistanz, Restaufstieg, Ankunftszeit | zusätzlich Geschwindigkeit und Ø-Geschwindigkeit |
| **Kartenmaßstab unterwegs** | eng, Detail wichtig | weiter, Vorausschau wichtig |

**Kein zweiter Modus, keine doppelte App.** Beim Anlegen einer Tour wählst du die
Aktivitätsart; die Oberfläche bleibt dieselbe und passt nur Profil, Zahlen und Layer an.
Damit lässt sich später eine dritte Art ergänzen, ohne die App umzubauen.

---

## 4. Nicht-Ziele

- ❌ Social Features: Feeds, Folgen, Likes, Kommentare, ActivityPub/Fediverse
- ❌ Tourenvorschläge aus einer Community-Datenbank („Highlights" à la Komoot)
- ❌ Klettern, Skitouren, Wassersport
- ❌ Sprachnavigation / Turn-by-turn-Ansagen
- ❌ Live-Tracking für Dritte, Notruf-Funktion
- ❌ Trainingsauswertung: Leistung, Puls, Herzfrequenzzonen, Sensorkopplung (ANT+/BLE)
- ❌ Native App im Play Store *(Capacitor-Hülle bleibt als spätere Option offen)*
- ❌ **GPS-Aufzeichnung mit Handy in der Tasche / Display aus** — vom Nutzer als unwichtig
  eingestuft. Das ist der Grund, warum eine reine PWA genügt.
- ❌ Komoot-Migration — es wird bei null angefangen

### Was „keine Community-Datenbank" nicht heißt

Der Wunsch, **vorhandene Touren** zu sehen statt jede von Hand zu klicken, ist berechtigt und
bleibt erfüllt — nur nicht über fremde Nutzerinhalte. Es gibt drei zugelassene Quellen:

1. **Benannte OSM-Routen** — Rothaarsteig, Pfälzer Waldpfad, EuroVelo 15, PAM2. In Deutschland
   Zehntausende offizielle Routen mit Name, Länge und Etappen, frei und selbst hostbar.
   Das ist Weg B in Abschnitt 6.2 und die eigentliche Antwort auf „zeig mir, was es hier gibt".
2. **GPX-Dateien**, die andere schicken oder die man aus dem Netz lädt — Weg C.
3. **Touren anderer Nutzer derselben Instanz**, wenn sie freigegeben werden (KANN, Abschnitt 6.1).

**Nicht zugelassen** sind Komoot, Outdooractive, AllTrails, Wikiloc und Strava. Alle brauchen
API-Schlüssel oder Partnerzugang, viele untersagen das Speichern der Daten, und jede von ihnen
kippt gleich zwei harte Randbedingungen aus Abschnitt 7: „keine API-Schlüssel" und „keine
Fremd-Fair-Use-Dienste im Dauerbetrieb". Eine offene, selbst hostbare Datenbank *geplanter*
Touren existiert nicht — das ist eine Tatsache über den Markt, keine Designentscheidung.

---

## 5. Technische Entscheidung: Stack

Der Nutzer programmiert mit, hat aber keine Framework-Präferenz und hat die Wahl mir
überlassen. **Empfehlung: SvelteKit + TypeScript.** Begründung, spezifisch für *diese* App:

1. **MapLibre ist imperativ und zustandsbehaftet.** Man hält ein Kartenobjekt und mutiert es.
   Reacts deklaratives Rerender-Modell arbeitet dagegen; `react-map-gl` legt eine
   Abstraktionsschicht darüber und hinkt MapLibre-Releases nach. Sveltes Reaktivität lässt
   sich direkt an ein imperatives Objekt binden — kein Zwischenlayer nötig.
2. **Bundle-Größe ist hier ein Feature, kein Detail.** Die Feldansicht muss offline auf einem
   Handy schnell starten. Svelte kompiliert zu Vanilla-JS ohne mitgeliefertes Runtime-Framework —
   weniger Code, den der Service Worker cachen und der Browser parsen muss.
3. **Bester PWA-Pfad.** `vite-plugin-pwa` ist der reifste Weg zu Service Worker und
   Offline-Precaching; in SvelteKit ein kurzer Konfigurationsblock.
4. **Wanderer nutzt genau diesen Stack.** Da es lokal läuft und als GUI-Anregung dienen soll,
   kannst du dort jederzeit nachsehen, wie etwas gelöst ist.
5. **Ein Deployable.** `adapter-node` ergibt einen Node-Prozess — ein simples Docker-Image
   für den kleinen Server.
6. **Wenige Konzepte.** Kein JSX, kein Hooks-Modell, kein Rerender-Denken. Relevant, weil du
   mitliest und mitbaust.

**Ehrlicher Nachteil:** kleineres Ökosystem, weniger fertige Komponenten als bei React. Für
diese App kaum spürbar, weil MapLibre, Chart.js und Turf framework-unabhängig sind.

| Baustein | Wahl |
|---|---|
| Frontend + Server | SvelteKit, TypeScript, `adapter-node` |
| Karte | MapLibre GL JS (direkt, ohne Wrapper) |
| PWA / Offline | `vite-plugin-pwa` (Workbox) |
| Offline-Karten | PMTiles in **OPFS** |
| Offline-Daten | IndexedDB via Dexie |
| Datenbank | **Postgres + PostGIS** |
| Höhenprofil | Chart.js |
| Geo-Mathematik | Turf.js (nur benötigte Module) |
| Routing | **BRouter**, selbst gehostet im Docker |
| Deployment | Docker Compose auf Hetzner |

**Zu BRouter und Radfahren:** BRouter ist als *Fahrrad*-Router entstanden und erst später um
Wanderprofile erweitert worden. Die Erweiterung auf Radtouren stärkt diese Wahl also — beide
Aktivitätsarten laufen über **eine** Routing-Engine, gesteuert durch austauschbare
Profildateien. Die etablierten Profile (`trekking`, `fastbike`, `gravel`, MTB, diverse
Wanderprofile) sind vorhanden und per Textdatei anpassbar.

---

## 6. Funktionale Anforderungen

Priorisierung: **MUSS** = MVP, **SOLL** = kurz danach, **KANN** = später.
Der MVP-Schnitt ist „Mittel" (Abschnitt 7).

### 6.1 Zugang, Nutzer, Rollen

| Prio | Anforderung |
|---|---|
| MUSS | Login mit Benutzername/E-Mail und Passwort; Sitzung bleibt auf dem Handy erhalten |
| MUSS | Login funktioniert **offline** weiter — eine bestehende Sitzung darf im Funkloch nicht rausfliegen |
| MUSS | Rolle **Admin**: Nutzer anlegen, bearbeiten, deaktivieren, Rolle zuweisen |
| MUSS | Rolle **Nutzer**: eigene Touren planen, durchführen, archivieren |
| MUSS | Selbstregistrierung abschaltbar (Standard: aus) |
| SOLL | Passwort ändern; Admin kann Passwort zurücksetzen |
| SOLL | Jede Tour hat eine klare Eigentümerschaft |
| KANN | Rolle **Gast** (nur lesen) ❓ *siehe Abschnitt 8* |
| KANN | Tour für andere Nutzer der Instanz freigeben ❓ *siehe Abschnitt 8* |

### 6.2 Phase „Planen" (Laptop)

**Drei Wege zu einer Route** — alle drei sind gewollt, für beide Aktivitätsarten:

| Prio | Anforderung |
|---|---|
| MUSS | **(A) Punkte klicken**, Routing verbindet sie entlang echter Wege — Profil je Aktivitätsart |
| MUSS | **(B) Bestehender Route folgen**: OSM-Relation (`route=hiking` bzw. `route=bicycle`) suchen, Linie laden, eigenes Stück herausschneiden |
| MUSS | **(C) GPX importieren** und anpassen (kürzen, Wegpunkte ergänzen) |
| MUSS | Aktivitätsart je Tour wählbar; Routing-Profil daraus abgeleitet, aber überschreibbar |
| MUSS | Karte mit Outdoor-Fokus: Wege, Wegkategorien, Höhenlinien, Schummerung |
| MUSS | Offizielle Wander- bzw. Radrouten aus OSM sichtbar und unterscheidbar (Fernweg / regional / lokal) |
| MUSS | Wegpunkte **direkt auf der Karte** verschieben, einfügen, löschen, umsortieren — ohne Menü |
| MUSS | **Höhenprofil** live, mit verknüpftem Marker auf der Karte |
| MUSS | Kennzahlen immer sichtbar: Länge, Auf-/Abstieg, Dauer, Schwierigkeit |
| MUSS | Dauer nach nachvollziehbarer Formel — DAV/SAC beim Wandern, Geschwindigkeitsmodell beim Radfahren; Parameter einstellbar |
| MUSS | **Untergrund entlang der Route** erkennbar (asphaltiert / geschottert / unbefestigt) — für Radtouren entscheidend, beim Wandern nützlich |
| MUSS | Tour speichern mit Name, Datum, Aktivitätsart, Notiz |
| MUSS | Gespeichert wird **ausdrücklich** (Knopf, `Cmd/Strg+S`); eine unfertige Tour übersteht Neuladen und Absturz trotzdem als lokaler Entwurf |
| MUSS | Ortssuche (Ort, Gipfel, Hütte, Bahnhof) zum Springen auf der Karte |
| MUSS | **POI-Kontext**, passend zur Aktivitätsart (siehe Abschnitt 3) |
| MUSS | **Wetteraussicht** für Tourdatum und -region |
| SOLL | Steigungsprozente im Höhenprofil einfärben |
| KANN | Varianten einer Tour vergleichen |
| KANN | ÖPNV-Anbindung zu Start und Ziel (inkl. Fahrradmitnahme) |
| KANN | PDF/Karte zum Ausdrucken als Papier-Backup |
| KANN | 3D-Vorschau, Freihand-Zeichnen, Etappen für Mehrtagestouren |

### 6.3 Phase „Vorbereiten" (mit Netz)

| Prio | Anforderung |
|---|---|
| MUSS | Ein Knopf **„Offline verfügbar machen"** pro Tour |
| MUSS | Lädt Kartenausschnitt entlang der Route mit Puffer, plus Höhendaten, Route, Wegpunkte, POIs, Notizen |
| MUSS | Größenangabe vorab, sichtbarer Fortschritt, abbrechbar |
| MUSS | Übersicht offline vorhandener Touren, einzeln löschbar |
| SOLL | Warnung bei knappem Gerätespeicher |
| SOLL | Puffer und Zoomtiefe je Aktivitätsart sinnvoll vorbelegt (Radtouren sind länger, brauchen weniger Detail) |
| KANN | Ganze Region statt nur Tourkorridor laden |

### 6.4 Phase „Unterwegs" (Handy, offline) — Kernnutzen

| Prio | Anforderung |
|---|---|
| MUSS | App startet und arbeitet **vollständig ohne Netz** |
| MUSS | Offline-Karte + geplante Route deutlich sichtbar |
| MUSS | Eigene Position live auf der Karte |
| MUSS | **Abgleich Weg ↔ Route**: Abstand zur Route, klare Warnung beim Abkommen |
| MUSS | **Restdistanz** und **Restaufstieg** bis Ziel |
| MUSS | Geschätzte Ankunftszeit |
| MUSS | Reduzierte, großflächige Feldansicht — einhändig bzw. am Lenker, bei Sonnenlicht lesbar |
| MUSS | Display bleibt an, solange die Feldansicht offen ist (Wake Lock) |
| MUSS | Track aufzeichnen, offline puffern, bei Netz synchronisieren |
| MUSS | Nächster Wegpunkt / Abzweig mit Entfernung |
| MUSS | Fortschritt im Höhenprofil („du bist hier") |
| MUSS | Bei Radtouren: aktuelle und Ø-Geschwindigkeit |
| SOLL | Notiz und Foto an aktueller Position, offline |
| SOLL | Aktuelle Höhe, zurückgelegte Strecke, Dauer |
| SOLL | Distanz zum nächsten relevanten POI (Hütte, Wasser, Radladen) |
| SOLL | Kartenausrichtung und Zoom je Aktivitätsart sinnvoll vorbelegt |
| KANN | Karte nach Blickrichtung drehen; Nachtmodus |

### 6.5 Phase „Nachbereiten & Archiv"

| Prio | Anforderung |
|---|---|
| MUSS | Aufgezeichneter Track landet automatisch bei der geplanten Tour |
| MUSS | Tourenarchiv als Liste **und** Karte, sortierbar — **und zugleich der Startbildschirm** |
| MUSS | Tourenkarte in der Liste zeigt Vorschaubild, Aktivitätsart, Datum und drei Kennzahlen |
| MUSS | **GPX-Export** jeder Tour und jedes Tracks |
| MUSS | Suche und Filter: Aktivitätsart, Länge, Aufstieg, Region, Datum, Stichwort |
| MUSS | **Vergleich geplant ↔ gegangen/gefahren**: Abweichungen und Kennzahlen gegenübergestellt |
| SOLL | Fotos und Notizen der Tour zugeordnet, auf der Karte platziert |
| KANN | Jahres-/Gesamtstatistik, getrennt je Aktivitätsart |
| KANN | Tourenbericht als Text, Alles-Export als ZIP |

**Zum Startbildschirm.** Die App öffnet mit Tourenliste links und Karte rechts — dem Aufbau,
den Komoot für seine Entdeckenseite benutzt, gefüllt mit **eigenen** Touren. Die Karte bleibt
damit die Hauptsache (Abschnitt 7) und das Archiv ist nichts, was man erst suchen muss. Liste
und Karte sind ein Bildschirm, nicht zwei: eine Tour überfahren hebt ihre Linie hervor, eine
Linie überfahren holt ihre Karte in den Blick.

**Vorschaubild ohne Fotos.** Komoots Kacheln zeigen Nutzerfotos. Es gibt keine, und beide
Alternativen scheitern an Abschnitt 7: eine Kartengrafik serverseitig zu rendern bräuchte ein
headless MapLibre samt Netzzugriff, ein Static-Map-Dienst wäre ein Fremddienst. Stattdessen
zeigt die Karte den **Umriss der Tour** — die vereinfachte Route als Linie, ohne Untergrund.
Sie gibt sich nicht als Karte aus; sie ist die Form der Tour, und die unterscheidet zwei
Touren auf einen Blick besser als ein Foto vom Gipfel.

---

## 7. Nicht-funktionale Anforderungen

### Offline
- Die Feldansicht macht **keine einzige Netzanfrage**
- Kein Datenverlust bei Neustart, Absturz oder leerem Akku
- Aufgezeichnete Tracks überleben, bis sie erfolgreich synchronisiert sind
- Sync-Konflikte überschreiben nichts

### Bedienung — was von Komoot nicht übernommen wird

- **Karte ist die Hauptsache.** Kein Dashboard mit Kacheln, keine Startseite, die von der Karte
  wegführt
- **Kein Beiwerk:** keine Vorschläge, keine Werbung, keine Community-Inhalte, kein Feed
- **Keine Menüs für Standardaktionen.** Wegpunkt einfügen = Linie ziehen. Löschen = Rechtsklick.
  Umsortieren = in der Liste ziehen. Kennzahlen = immer sichtbar, nie erst aufklappen
- **Ein Bildschirm, eine Aufgabe**
- Die Aktivitätsart darf die Oberfläche **nicht verdoppeln** — sie schaltet Inhalte um, nicht Ansichten
- Kartenlayer sparsam — nicht alle Routen gleichzeitig bunt übereinander
  *(erklärte Kritik am waymarkedtrails-Overlay)*
- Keine Beschriftung auf fremden Routenlinien; die eigene Tour ist das Einzige, was auffallen darf

> **Präzisierung (Nachtrag).** „Bedienelemente treten zurück" heißt **zurückhaltend im Gewicht**,
> nicht **abwesend**. Eine Oberfläche ohne sichtbare Werkzeuge ist nicht ruhig, sie ist stumm —
> und niemand findet Funktionen, die man nur durch Ausprobieren entdeckt. Der erste Planer war
> genau so geraten und das war eine Fehllesung dieser Zeile.

### Bedienung — was von Komoot gelernt wird

- **Jede Aktion hat ein Symbol.** Ein Papierkorb ist ein Papierkorb; `×` als Textzeichen ist keiner.
  Icons sind ein eigener, konsistenter Satz — eine Strichstärke, ein Raster, lokal gebündelt
  (kein Nachladen, die Feldansicht ist offline)
- **Gesten sind ein Zusatz, nie die einzige Tür.** Rechtsklick löscht — *und* daneben steht ein
  Papierkorb, der auch mit dem Finger erreichbar ist. Das ist kein Widerspruch zu „keine Menüs":
  ein sichtbarer Knopf ist kein Menü
- **Leerzustände bieten etwas an**, statt einen Zustand zu beschreiben. Wer die App zum ersten
  Mal öffnet, sieht, was zu tun ist — inklusive der Gesten, die es sonst nie erfährt
- **Tourenlisten sind dicht und aussagekräftig:** Vorschaubild, Name, Aktivitätsart, Datum und
  drei Kennzahlen auf einer Zeile. Eine Liste aus Namen ist verschenkter Platz
- **Zahlen groß, mit Einheit, mit Beschriftung.** Die zwei wichtigsten Kennzahlen einer Tour
  stehen größer als die übrigen; welche zwei das sind, entscheidet die Aktivitätsart
- **Filter liegen offen** — als Chips über der Liste, nicht in einem Menü, nicht in einem Dialog
- **Ein System, keine Sammlung von Einzelfällen.** Abstände, Radien, Schatten und Bewegungen
  kommen aus einem Maßsatz. Ein Knopf, der fünfmal fünf verschiedene Knöpfe ist, sieht
  selbstgebaut aus — und war genau der Zustand vor diesem Nachtrag

### Darstellung

- **Hell und Dunkel sind umschaltbar**, dazu „System". **Standard ist hell** — die warme
  Kartenwelt ist der Normalfall; die Systemeinstellung stumm zu übernehmen hat die App
  unfreiwillig düster gemacht
- Die Umschaltung gilt auch für die Karte selbst: Schummerung, Höhenlinien, Beschriftung,
  Routenfassung. Farben der Oberfläche und Farben der Karte kommen aus **einem** Satz Tokens
  und dürfen nie auseinanderlaufen
- Routenfarben folgen gedruckten Topo-Karten: **Wandern rot, Radfahren blau.** Semantische
  Farben (auf Route / abseits / Warnung) sind davon getrennt und nie ein Akzent
- Keine Webfonts. Systemschrift, damit offline nichts nachgeladen wird und nichts still auf
  einen Ersatz zurückfällt
- Feldansicht: alles Wichtige ohne Scrollen und ohne Menü, bei Sonnenlicht lesbar — hoher
  Kontrast, große Zahlen, Griffflächen für den Daumen (mind. 44 px)
- Bedienbar mit der Tastatur, sichtbarer Fokus, korrekte ARIA-Rollen. Nicht aus Prinzip,
  sondern weil es dieselben Fehler aufdeckt, die auch mit der Maus stören

### Betrieb
- Alles per Docker Compose auf dem kleinen Hetzner-Server
- Speicher- und RAM-Bedarf passen zur genannten Serverklasse
- **Keine kostenpflichtigen APIs, keine API-Keys**
- **Keine Fremd-Fair-Use-Dienste im Dauerbetrieb** — Routing und Geocoding selbst hosten
  *(die aktuelle Wanderer-Installation nutzt `valhalla1.openstreetmap.de`,
  `overpass-api.de` und `nominatim.openstreetmap.org`; für Dauerbetrieb nicht zulässig)*
- Backup der Nutzdaten mit einem Befehl

### Daten
- Alle Tourdaten auf dem eigenen Server
- Kein Tracking, keine Telemetrie, keine externen Analytics
- Offene Formate (GPX), jederzeit vollständig exportierbar

---

## 8. Varianten: Wandern allein oder mit Radfahren?

### Was Radfahren *nicht* kostet

Rund **85 % der App sind aktivitätsneutral** und fallen ohnehin an:

Login und Rollen · Kartendarstellung · PMTiles und Offline-Download · OPFS-Verwaltung ·
Höhendaten, Schummerung, Höhenlinien · das Klick-und-Zieh-Planen · GPX-Import/-Export ·
Track-Aufzeichnung und Sync · Abweichungserkennung · Restdistanz, Restaufstieg, Ankunftszeit ·
Wake Lock · Archiv, Suche, Filter · Wetter · Ortssuche

Nichts davon interessiert, ob du läufst oder fährst.

### Was Radfahren wirklich kostet

| # | Zusatzarbeit | Umfang |
|---|---|---|
| 1 | Zweites BRouter-Profil (`trekking`) ausliefern | **fast null** — eine Profildatei, Profilname ist bereits ein Request-Parameter |
| 2 | Zweites Zeitmodell (Geschwindigkeit + Steigung statt DAV/SAC) | eine Funktion |
| 3 | `route=bicycle`-Relationen ins Vektor-Overlay + Styling | klein, wenn das Overlay ohnehin gebaut wird |
| 4 | Rad-POIs (Radladen, Reparaturstation, Bahnhof) | klein, gleiche Mechanik, andere Abfrage + Icons |
| 5 | Geschwindigkeit und Ø-Geschwindigkeit in der Feldansicht | sehr klein, folgt aus dem Positionsstrom |
| 6 | Aktivitätsart als Feld, Auswahl-UI, Vorbelegungen | klein, aber querschnittlich |
| 7 | **Untergrund/Belagsqualität einfärben** + Legende | **der einzige echt neue UI-Baustein** |
| 8 | Offline-Puffer und Zoomtiefe je Aktivität | Parameter, keine Architektur |

Zusammen etwa **2 zusätzliche Wochenenden** — und Punkt 7 ist davon rund die Hälfte.

### Der eigentliche Kostenfaktor: das Nachrüsten

Teuer ist nicht Radfahren. Teuer ist, **Wandern fest zu verdrahten und später aufzubohren**.
Konkret müsste man dann anfassen:

- Datenbank: Tour braucht eine Aktivitätsart, alle Abfragen und Filter darauf
- Dauerberechnung: aus einer fest eingebauten DAV-Formel eine austauschbare machen
- Routing: aus dem Konstanten-Profilnamen einen Parameter machen
- Kartenlayer: aus fest sichtbaren Wanderwegen aktivitätsabhängige Layer machen
- Planungsansicht, Feldansicht, Archiv-Filter, Offline-Logik: überall Annahmen aufräumen

Das ist die klassische Nachrüst-Steuer: **jetzt ein Feld und eine Schnittstelle, später ein
Umbau durch fünf Schichten.**

### Die drei Varianten

| | **A — Nur Wandern** | **B — Beides voll** | **C — Beides, Rad abgespeckt** |
|---|---|---|---|
| Aktivitätsart im Datenmodell | ❌ | ✅ | ✅ |
| Wander-Routing + DAV-Zeit | ✅ | ✅ | ✅ |
| Rad-Routing (`trekking`) | ❌ | ✅ | ✅ |
| Rad-Zeitmodell | ❌ | ✅ | ✅ |
| Radrouten-Overlay (OSM) | ❌ | ✅ | ✅ |
| Rad-POIs | ❌ | ✅ | ✅ |
| Geschwindigkeit in Feldansicht | ❌ | ✅ | ✅ |
| **Untergrund einfärben + Legende** | ❌ | ✅ | ⏭ später |
| Rad-Kartenstil-Feinschliff | ❌ | ✅ | ⏭ später |
| ÖPNV mit Fahrradmitnahme | ❌ | ⏭ später | ⏭ später |
| **Aufwand bis erste echte Tour** | ~6–7 WE | ~8–9 WE | **~7–8 WE** |
| **Nachrüst-Steuer später** | **hoch** | keine | keine |

### ✅ Gewählt: Variante C

**Architektur zweigleisig, Ausbau einspurig beginnen.**

Die Aktivitätsart kommt von Tag 1 ins Datenmodell und hinter Schnittstellen — das kostet
fast nichts und macht die Nachrüst-Steuer null. Radfahren geht mit dem billigen 80 % live:
Profil, Zeitmodell, Radrouten, Rad-POIs, Geschwindigkeit. Der eine wirklich neue
UI-Baustein — Untergrund einfärben — wird bewusst verschoben, bis du auf echten Radtouren
merkst, wie viel er dir wert ist.

Gegenüber Variante A kostet das etwa **ein zusätzliches Wochenende**. Dafür ist Radfahren
sofort brauchbar und später nie ein Umbau.

Konkret heißt „zweigleisig" im Code, dass drei Dinge von Anfang an austauschbar sind und
**nicht** fest verdrahtet werden:

1. `tour.activity_type` als Feld in der Datenbank, in allen Abfragen und Archiv-Filtern
2. Die Dauerberechnung hinter einer Schnittstelle — DAV/SAC und Rad-Geschwindigkeitsmodell
   sind zwei Implementierungen derselben Signatur
3. Der BRouter-Profilname als Parameter, abgeleitet aus der Aktivitätsart, überschreibbar

Ebenso werden Kartenlayer, POI-Auswahl, Feldansicht-Kennzahlen und Offline-Vorbelegungen
aus der Aktivitätsart abgeleitet statt hart gesetzt.

### MVP-Schnitt (Variante C)

**Drin:** Login mit Rollen · Aktivitätsart Wandern und Radfahren ·
Karte mit Wander-/Radrouten, Höhenlinien, Schummerung ·
drei Wege zur Route (klicken / bestehende Route / GPX) · Höhenprofil und Kennzahlen ·
Ortssuche · POIs je Aktivität · Wetter · Offline-Download · vollständige Feldansicht ·
Track-Aufzeichnung und Sync · Archiv mit Suche · Vergleich geplant ↔ durchgeführt · GPX-Export

**Später:** Untergrund einfärben · Etappen für Mehrtagestouren · 3D · PDF-Druck · ÖPNV ·
Statistiken · Freihand-Zeichnen · Varianten-Vergleich · Gravel-/MTB-/Rennrad-Profile ·
Capacitor-Hülle für Tracking in der Tasche

---

## 9. Umsetzung

### Was steht

Planungsansicht am Laptop mit Karte, Wegpunkten (klicken, ziehen, umsortieren, Rechtsklick
löscht), Routing über selbst gehostetes BRouter, Kennzahlen, Höhenprofil mit gekoppeltem
Kartenmarker, Höhenlinien und Schummerung im Browser gerechnet. Die Aktivitätsart steht als
Naht in **einer** Datei (`src/lib/geo/activity.ts`) mit der Regel, dass nirgends im Code
`if (activityType === 'hike')` stehen darf.

### Nächste Etappen

Aus dem Nachtrag zu Abschnitt 7 folgt die Reihenfolge: **erst das Fundament, dann die
Tourenliste.** Jede Etappe ist für sich prüfbar.

| # | Etappe | Ergebnis |
|---|---|---|
| 1 | Gestaltungsmaße: Abstände, Radien, Ebenen, Bewegung, Schatten; Farbtokens vereinheitlicht | ein Maßsatz statt Einzelfälle |
| 2 | Iconsatz, lokal gebündelt, eine Strichstärke; Musterseite `/stil` | Symbole für jede Aktion |
| 3 | Bausteine: Knopf, Symbolknopf, Umschalter, Panel, Kennzahl, Leerzustand, Hinweis, Chip | fünf Knopfstile werden zwei Komponenten |
| 4 | Hell/Dunkel vollständig, **inklusive Karte**, hell als Standard | Abschnitt 7 „Darstellung" erfüllt |
| 5 | Naht erweitern: Icon, Betonung der Kennzahlen, Kurzsatz für Listen, POI-Symbole | dritte Aktivitätsart bleibt ein Eintrag |
| 6 | Planer umgebaut: Kopfzeile mit Werkzeugen, einladender Leerzustand mit Gestenlegende, sichtbare Papierkörbe | die App sieht nicht mehr leer aus |
| 7 | Datenbank: Drizzle, Tabelle `tours`, Route als PostGIS-Geometrie, Kennzahlen mitgeführt | Touren überleben das Neuladen |
| 8 | Endpunkte zum Anlegen, Ändern, Löschen; Kennzahlen rechnet immer der Server | eine Schreibstelle, keine Abweichungen |
| 9 | Speichern im Planer, `/planen/[id]`, lokaler Entwurf | Abschnitt 6.2 „Tour speichern" erfüllt |
| 10 | Kartengrundlage aus `MapCanvas` herauslösen (reiner Umbau) | Voraussetzung für eine zweite Karte |
| 11 | **Startbildschirm:** Tourenliste mit Umriss-Vorschau + Übersichtskarte, Filterchips, Sortierung | Abschnitt 6.5 „Archiv als Liste und Karte" |
| 12 | GPX-Export, Sicherung mit einem Befehl | Abschnitt 6.5 und 7 „Backup" |

Danach in der Reihenfolge des MVP-Schnitts: Anmeldung und Rollen · Ortssuche (Nominatim) ·
OSM-Routen-Overlay und Weg B · GPX-Import (Weg C) · POIs · Wetter · Offline-Download ·
Feldansicht · Track-Aufzeichnung · Vergleich geplant ↔ durchgeführt.

### Noch offen für einen eigenen Plan

- Offline-Architektur: was in OPFS, was in IndexedDB, wie der Sync Konflikte vermeidet
- Eigenes Vektor-Overlay aus OSM (Wander- und Radrouten, Untergrund-Tags)
- Serveraufteilung im Docker Compose und Speicherbudget für den kleinen Hetzner-Server
- Zuschnitt der Offline-Pakete (Korridorbreite, Zoomtiefe, erwartete Größe je Tourtyp)
- Feldansicht fürs Handy — bewusst **nicht** dieselbe Oberfläche in schmal (Abschnitt 2)

---

## 10. Datenquellen (recherchiert und verifiziert)

| Zweck | Quelle | Anmerkung |
|---|---|---|
| Basiskarte (Vektor) | **Protomaps Basemap** als PMTiles | Planet 120 GB, aber `pmtiles extract` holt Tourkorridore, ohne alles zu lagern |
| Höhe / Profil / Schummerung / Höhenlinien | **Mapterhorn** Terrain-RGB PMTiles | kostenlos, global, Copernicus 30 m; Höhenlinien im Browser berechenbar |
| Routing (beide Aktivitätsarten) | **BRouter**, selbst gehostet | Weltsegmente ~7 GB, geringer RAM-Bedarf; Radprofile (`trekking`, `fastbike`, Gravel, MTB) und Wanderprofile (`sac_scale`, `trail_visibility`), höhenbewusst |
| Wander- und Radrouten, POIs | **OSM** (`route=hiking`, `route=bicycle`) via eigener Extrakt | POIs: Hütte, Wasser, Einkehr, Radladen, Reparaturstation, Bahnhof |
| Untergrund / Belagsqualität | **OSM** `surface`, `smoothness`, `tracktype` | im eigenen Vektor-Overlay mitführen |
| Ortssuche | **Nominatim**, selbst gehostet | |
| Wetter | **Open-Meteo** (DWD ICON, 2 km) | kostenlos, kein API-Key |
| Wegmarkierungen (nur Planung) | waymarkedtrails Raster (`hiking`, `cycling`) | optionales Online-Overlay; langfristig eigenes Vektor-Overlay |
| Genauere Höhenlinien (optional) | **Sonny's LiDAR DTM** | DE/AT/Alpen, deutlich präziser im Wald und in engen Tälern |

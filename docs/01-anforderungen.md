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
>
> **Nachtrag 7. August 2026 — Offline gestrichen.** Wandervogel ist eine **Online-App**.
> Kein Offline-Download, keine PMTiles in OPFS, kein Service Worker, keine PWA-Installation.
> Abschnitt 6.3 entfällt vollständig, Abschnitt 6.4 setzt Netz voraus.
> **Der Preis ist benannt und angenommen** — siehe Abschnitt 11.

---

## 0. Der gestrichene Kernnutzen

Die ursprüngliche Fassung dieses Dokuments hatte einen Satz als Zielbild: *„eine App, die
weniger kann als Komoot, aber das Wenige klar — und die im Funkloch vollständig
funktioniert."* **Die zweite Hälfte ist gestrichen.** Das ist keine Umbenennung und keine
Verschiebung auf später, sondern der Verzicht auf das Unterscheidungsmerkmal.

**Was das kostet, ausgeschrieben:** Wer im Funkloch die App öffnet, sieht nichts. Kein
Kartenbild, keine Route, keine Kennzahlen — die Anwendung startet nicht einmal, weil ohne
Service Worker nichts zwischengespeichert ist. Die Feldansicht aus Abschnitt 6.4 ist damit
eine Ansicht für Gebiete mit Empfang.

**Warum trotzdem:** Abschnitt 11 rechnet es vor. Der Kurzform: Der Offline-Teil war der
teuerste Baustein des MVP und derjenige, der die App technisch von den beiden
Schwesterprojekten trennte. Was als Grund zu bauen bleibt, steht ebenfalls dort — es ist
weniger als vorher, aber es ist nicht nichts.

---

## 1. Kontext

Elmar plant und unternimmt **Wander- und Radtouren** in Deutschland und Europa, bisher mit
**Komoot**. Zwei Dinge stören konkret: **zu viel Beiwerk um die Karte**
(Community-Highlights, Vorschläge, Premium-Werbung) und **zu viele Klicks für einfache
Handgriffe**.

> **Dass unterwegs oft kein Netz ist, stand hier ursprünglich als dritter Punkt** und war
> der Ursprung der Offline-Anforderung. Der Punkt ist nicht falsch geworden — er wird nur
> nicht mehr gelöst (Abschnitt 0 und 11).

Zum Vergleich wurde **Wanderer** (v0.20.0) lokal per Docker installiert und der Code geprüft.
Befund: solide Basis (SvelteKit + MapLibre GL 5.24, OpenFreeMap-Vektorstyle, chart.js-Höhenprofil,
Three.js-3D), dazu PocketBase als DB und ein für diesen Zweck irrelevanter Fediverse-Teil.
**Entscheidung: Wanderer dient als GUI-Anregung, nicht als Codebasis.**

> Der Befund lautete ursprünglich zusätzlich „kein Service Worker, keine PMTiles, also null
> Offline-Fähigkeit" — als Vorwurf. Nach der Streichung ist das kein Vorwurf mehr, sondern
> eine Gemeinsamkeit. Wanderer hat diese Entscheidung vor uns getroffen.

**Angestrebtes Ergebnis:** eine App, die weniger kann als Komoot, aber das Wenige klar.

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
| **Handy (Android)** | Primäres **Feldgerät**. Sonnenlicht, eine Hand bzw. Lenkerhalterung — **mit Netz**. |
| **Server** | Hetzner Cloud, klein: ca. 2–4 vCPU, 4–8 GB RAM, 40–80 GB SSD. |
| **Verteilung** | Web-App im Browser, auf beiden Geräten. Keine PWA-Installation. |

**Wichtig:** Laptop und Handy sind **nicht dieselbe Oberfläche in zwei Breiten**. Sie haben
verschiedene Aufgaben und dürfen verschieden aussehen. Kein responsive Kompromiss, der auf
beiden Geräten mittelmäßig ist.

**Tourprofil:** überwiegend **Tagestouren**. Mehrtages-/Etappenplanung ist bewusst *kein*
MVP-Thema, das Datenmodell wird sie aber nicht verbauen.

---

## 3. Leitkonzept: Aktivitätsart

Die App unterstützt **Wandern und Radfahren**. Beide teilen den kompletten Unterbau — Karte,
Planungswerkzeug, Feldansicht, Archiv. Die Aktivitätsart ist eine
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
  eingestuft
- ❌ **Offline-Betrieb, in jeder Form** — kein Kartendownload, kein Service Worker, kein
  zwischengespeicherter Tourbestand, keine PWA-Installation. Ab 7. August 2026, siehe
  Abschnitt 11
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
überlassen. **Gewählt wurde SvelteKit + TypeScript** mit sechs Begründungen. Nach der
Streichung von Offline tragen davon noch zwei:

| # | Ursprüngliche Begründung | Nach dem 7. August 2026 |
|---|---|---|
| 1 | MapLibre ist imperativ; Reacts Rerender-Modell arbeitet dagegen, Sveltes Reaktivität bindet direkt an ein imperatives Objekt | **gilt gegen React, nicht gegen Vue.** Vue bindet genauso direkt |
| 2 | Bundle-Größe ist ein Feature — die Feldansicht muss offline schnell starten | **entfällt vollständig** |
| 3 | Bester PWA-Pfad über `vite-plugin-pwa` | **entfällt vollständig** |
| 4 | Wanderer nutzt denselben Stack, man kann nachsehen | schwach — Vergleichsobjekt, keine Codebasis |
| 5 | Ein Deployable über `adapter-node` | **gilt** — Nitro täte dasselbe |
| 6 | Wenige Konzepte, der Nutzer liest mit | **gilt** — steht aber gegen zwei vorhandene Nuxt-Projekte |

**Die Wahl bleibt vorerst bestehen, aber nicht mehr aus diesen Gründen, sondern wegen des
Bestands:** rund 9.300 Zeilen laufender Code, davon 5.400 in Svelte-Komponenten. Gemessen
am 7. August 2026 ist genau **eine** Datei unter `src/lib` echt an Svelte gebunden
(`ui/theme.svelte.ts`); vier weitere nutzen nur `$env` und wären ein Import-Tausch. Die
2.800 Zeilen Geometrie, Höhen, Dauerberechnung, Aktivitätsnaht, GPX und Datenzugriff sind
framework-frei und wandern unverändert.

> **Die Framework-Frage ist damit ausdrücklich offen**, aber nicht jetzt zu beantworten.
> Sie wird fällig, wenn Wandervogel, `umweg` und `Repère` zu einer Anwendung
> zusammengeführt werden — dann ist der Port der Komponenten der Preis, und erst dann ist
> er bezahlt. Vorher wäre er reine Umschichtung.

| Baustein | Wahl |
|---|---|
| Frontend + Server | SvelteKit, TypeScript, `adapter-node` — Bestandsentscheidung, siehe oben |
| Karte | MapLibre GL JS (direkt, ohne Wrapper) |
| Datenbank | **Postgres + PostGIS** |
| Höhenprofil | **selbst gezeichnetes SVG**, kein Chart.js — 71 Zeilen Pfadberechnung statt einer Bibliothek |
| Geo-Mathematik | Turf.js (nur benötigte Module) |
| Routing | **BRouter**, selbst gehostet im Docker |
| Deployment | Docker Compose auf Hetzner |

Gestrichen aus dieser Tabelle: `vite-plugin-pwa`, PMTiles in OPFS, IndexedDB via Dexie.

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

### 6.3 Phase „Vorbereiten" — **gestrichen**

> Dieser Abschnitt enthielt sieben Anforderungen rund um den Knopf „Offline verfügbar
> machen": Kartenkorridor mit Puffer laden, Höhendaten dazu, Größenangabe, Fortschritt,
> Abbruch, Verwaltung und Löschung offline vorhandener Touren, Speicherwarnung.
>
> **Ersatzlos gestrichen am 7. August 2026.** Die Nummer bleibt leer stehen, damit die
> Querverweise auf 6.4 und 6.5 gültig bleiben. Begründung in Abschnitt 11.

### 6.4 Phase „Unterwegs" (Handy, mit Netz)

> **Nicht mehr der Kernnutzen.** Diese Phase hieß bis zum 7. August 2026 „Handy, offline"
> und trug die Überschrift *Kernnutzen*. Sie bleibt als eigene Oberfläche bestehen — die
> Begründung dafür (Sonnenlicht, eine Hand, Lenkerhalterung) ist von Netz unabhängig —,
> aber sie setzt Empfang voraus und ist damit eine Bequemlichkeit statt eines Alleinstellungsmerkmals.

| Prio | Anforderung |
|---|---|
| MUSS | Karte + geplante Route deutlich sichtbar |
| MUSS | Eigene Position live auf der Karte |
| MUSS | **Abgleich Weg ↔ Route**: Abstand zur Route, klare Warnung beim Abkommen |
| MUSS | **Restdistanz** und **Restaufstieg** bis Ziel |
| MUSS | Geschätzte Ankunftszeit |
| MUSS | Reduzierte, großflächige Feldansicht — einhändig bzw. am Lenker, bei Sonnenlicht lesbar |
| MUSS | Display bleibt an, solange die Feldansicht offen ist (Wake Lock) |
| MUSS | Track aufzeichnen und laufend zum Server schreiben |
| MUSS | Nächster Wegpunkt / Abzweig mit Entfernung |
| MUSS | Fortschritt im Höhenprofil („du bist hier") |
| MUSS | Bei Radtouren: aktuelle und Ø-Geschwindigkeit |
| SOLL | Notiz und Foto an aktueller Position |
| SOLL | Aktuelle Höhe, zurückgelegte Strecke, Dauer |
| SOLL | Distanz zum nächsten relevanten POI (Hütte, Wasser, Radladen) |
| SOLL | Kartenausrichtung und Zoom je Aktivitätsart sinnvoll vorbelegt |
| SOLL | **Verlust der Verbindung sichtbar machen** — wenn Kacheln ausbleiben, sagt die Ansicht das, statt grau zu werden |
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

### Netz

- **Die App setzt durchgehend eine Verbindung voraus.** Ohne Netz startet sie nicht
- Fällt die Verbindung während der Tour aus, **sagt die Oberfläche das** — sie zeigt nicht
  stumm eine graue Fläche und friert keine Kennzahl auf ihrem letzten Wert ein
- **Kein Datenverlust bei Neustart, Absturz oder leerem Akku.** Das ist keine
  Offline-Anforderung, sondern Absturzsicherheit: der lokale Planungsentwurf aus
  Abschnitt 6.2 bleibt bestehen und ist ausdrücklich *nicht* mitgestrichen
- Aufgezeichnete Tracks werden laufend geschrieben, nicht erst am Ende der Tour

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
  Icons sind ein eigener, konsistenter Satz — eine Strichstärke, ein Raster, lokal gebündelt.
  *Die Bündelung war ursprünglich mit der Offline-Feldansicht begründet; sie bleibt, weil
  „keine Fremddienste" (siehe „Betrieb") dieselbe Regel erzwingt*
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
- Keine Webfonts. Systemschrift — die Begründung ist jetzt „keine Fremddienste" statt
  „offline", die Regel bleibt dieselbe: nichts nachladen, nichts still auf einen Ersatz
  zurückfallen lassen
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

Login und Rollen · Kartendarstellung · Höhendaten, Schummerung, Höhenlinien ·
das Klick-und-Zieh-Planen · GPX-Import/-Export · Track-Aufzeichnung ·
Abweichungserkennung · Restdistanz, Restaufstieg, Ankunftszeit ·
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

Zusammen etwa **2 zusätzliche Wochenenden** — und Punkt 7 ist davon rund die Hälfte.
*(Punkt 8 lautete „Offline-Puffer und Zoomtiefe je Aktivität" und ist mit Abschnitt 6.3
entfallen.)*

### Der eigentliche Kostenfaktor: das Nachrüsten

Teuer ist nicht Radfahren. Teuer ist, **Wandern fest zu verdrahten und später aufzubohren**.
Konkret müsste man dann anfassen:

- Datenbank: Tour braucht eine Aktivitätsart, alle Abfragen und Filter darauf
- Dauerberechnung: aus einer fest eingebauten DAV-Formel eine austauschbare machen
- Routing: aus dem Konstanten-Profilnamen einen Parameter machen
- Kartenlayer: aus fest sichtbaren Wanderwegen aktivitätsabhängige Layer machen
- Planungsansicht, Feldansicht, Archiv-Filter: überall Annahmen aufräumen

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

> **Diese Aufwandszahlen stammen vom Juli 2026 und enthalten den Offline-Teil.** Sie liegen
> nach der Streichung niedriger; um wie viel, ist nicht nachgerechnet und wird hier bewusst
> nicht geraten. Der Vergleich zwischen A, B und C bleibt gültig, weil Offline in allen drei
> Spalten gleich viel gekostet hätte.

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

Ebenso werden Kartenlayer, POI-Auswahl und Feldansicht-Kennzahlen aus der Aktivitätsart
abgeleitet statt hart gesetzt.

### MVP-Schnitt (Variante C)

**Drin:** Login mit Rollen · Aktivitätsart Wandern und Radfahren ·
Karte mit Wander-/Radrouten, Höhenlinien, Schummerung ·
drei Wege zur Route (klicken / bestehende Route / GPX) · Höhenprofil und Kennzahlen ·
Ortssuche · POIs je Aktivität · Wetter · vollständige Feldansicht ·
Track-Aufzeichnung · Archiv mit Suche · Vergleich geplant ↔ durchgeführt · GPX-Export

**Später:** Untergrund einfärben · Etappen für Mehrtagestouren · 3D · PDF-Druck · ÖPNV ·
Statistiken · Freihand-Zeichnen · Varianten-Vergleich · Gravel-/MTB-/Rennrad-Profile ·
Capacitor-Hülle für Tracking in der Tasche

**Nicht mehr drin:** Offline-Download. Er stand hier als MUSS und ist am 7. August 2026
gestrichen worden.

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
OSM-Routen-Overlay und Weg B · GPX-Import (Weg C) · POIs · Wetter ·
Feldansicht · Track-Aufzeichnung · Vergleich geplant ↔ durchgeführt.

### Noch offen für einen eigenen Plan

- Eigenes Vektor-Overlay aus OSM (Wander- und Radrouten, Untergrund-Tags)
- Serveraufteilung im Docker Compose und Speicherbudget für den kleinen Hetzner-Server
- Feldansicht fürs Handy — bewusst **nicht** dieselbe Oberfläche in schmal (Abschnitt 2)

> Von den ursprünglich fünf offenen Punkten sind zwei mit der Streichung entfallen:
> die Offline-Architektur (was in OPFS, was in IndexedDB, wie der Sync Konflikte vermeidet)
> und der Zuschnitt der Offline-Pakete (Korridorbreite, Zoomtiefe, Größe je Tourtyp).
> **Das waren die beiden schwierigsten der fünf.**

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

> **PMTiles bleiben, ihr Zweck ist ein anderer geworden.** Sie standen für zwei
> Anforderungen zugleich: „im Funkloch funktionieren" und „keine Fremd-Fair-Use-Dienste im
> Dauerbetrieb" (Abschnitt 7). Die erste ist gestrichen, die zweite steht. Selbst gehostete
> Protomaps- und Mapterhorn-Dateien werden also weiterhin gebraucht — aber sie werden vom
> Server ausgeliefert und nicht mehr auf das Gerät geladen. Was entfällt, ist `pmtiles
> extract` je Tourkorridor; was bleibt, ist ein Gebietsextrakt auf dem Server.

---

## 11. Die Streichung von Offline — Rechnung und Preis

*7. August 2026. Dieser Abschnitt hält fest, was entschieden wurde, was es einbringt und
was es kostet, damit die Entscheidung später nachvollziehbar bleibt und nicht als
Selbstverständlichkeit gelesen wird.*

### Was gestrichen ist

Abschnitt 6.3 vollständig · „App arbeitet vollständig ohne Netz" aus 6.4 · Offline-Login
aus 6.1 · der Offline-Block aus Abschnitt 7 · Service Worker, `vite-plugin-pwa`,
PWA-Installation · PMTiles in OPFS · IndexedDB/Dexie · Track-Pufferung und Sync-Konfliktlogik.

### Was es einbringt

| | |
|---|---|
| Eine ganze MVP-Phase | Abschnitt 6.3 waren sieben Anforderungen, alle MUSS |
| Zwei von fünf offenen Planungsfragen | Offline-Architektur und Paketzuschnitt — die beiden schwierigsten |
| Der Wegfall der Sync-Frage | Konflikte, die nichts überschreiben dürfen, sind ein eigenes Problemfeld |
| Vier von sechs Framework-Begründungen verlieren ihre Grundlage | Abschnitt 5 — und damit wird eine spätere Zusammenführung mit `umweg` und `Repère` überhaupt denkbar |

### Was es kostet

**Das Unterscheidungsmerkmal.** Abschnitt 1 nannte drei Ärgernisse an Komoot: Beiwerk,
Klickzahl, fehlendes Netz. Das dritte war das einzige, das sich nicht durch bessere
Gestaltung lösen ließ, sondern nur durch eigene Architektur — und genau deshalb war es das
Argument, überhaupt zu bauen statt zu konfigurieren.

**Konkret im Gebrauch:** Ein Wanderweg im Pfälzerwald oder ein Alpenpass hat streckenweise
keinen Empfang. Dort öffnet die App nicht. Das ist ausdrücklich in Kauf genommen.

**Was als Grund zu bauen bleibt** — weniger als vorher, aber nicht nichts:

- keine Community-Inhalte, keine Vorschläge, keine Werbung um die Karte (Abschnitt 7)
- Wandern und Radfahren in *einer* Oberfläche, ohne Moduswechsel (Abschnitt 3)
- alle Tourdaten auf dem eigenen Server, jederzeit als GPX exportierbar (Abschnitt 7)
- weniger Klicks für die Handgriffe, die tatsächlich oft vorkommen

### Der Weg zurück, falls die Entscheidung nicht trägt

Sie ist umkehrbar, aber nicht gratis. Was jetzt gebaut wird, sollte deshalb zwei Dinge
nicht verbauen:

1. **Kennzahlen und Route bleiben klein und serialisierbar.** Eine Tour ist wenige Kilobyte;
   solange sie als geschlossenes Objekt vom Server kommt, ist ein späterer Browser-Cache
   eine Ergänzung und kein Umbau.
2. **Die Kartenquellen bleiben hinter `src/lib/config.ts`.** PMTiles vom Server oder PMTiles
   vom Gerät ist dann ein Adresswechsel, kein Eingriff in die Kartenlogik.

Beides kostet heute nichts und ist ohnehin guter Zuschnitt. Mehr Vorsorge wäre bereits
Offline-Arbeit unter anderem Namen und ist nicht gewollt.

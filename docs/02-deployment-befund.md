# Wandervogel — Deployment-Befund

> **Status:** Bestandsaufnahme vom 2. August 2026, noch nichts umgesetzt, nichts am Server
> verändert. Die Frage war: *Können wir die App so, wie sie ist, auf helsinki-80gb deployen?*
> **Antwort: ja, technisch — aber nicht mit dem, was heute im Repo liegt.** Vier Punkte müssen
> vorher entschieden oder gebaut sein, drei davon berühren den Server und nicht die App.
>
> Grundlage sind die Betriebsdokumente aus `~/workspace/optimize-hetzner`
> (`ARCHITEKTUR.md`, `DEPLOYMENT.md`, `OFFENE-PROBLEME.md`) und eine lesende Abfrage
> des laufenden Servers. Abschnittsnummern in Klammern verweisen dorthin.

---

## 1. Was geprüft wurde

| Prüfung | Ergebnis |
|---|---|
| `pnpm build` (adapter-node) | läuft durch, 4,9 s — ein Build auf dem Server ist unkritisch |
| Datenbankbedarf gegen `pg-shared` | **PostGIS fehlt dort** → Abschnitt 3 |
| Zugangsschutz | **keiner** → Abschnitt 4 |
| Speicherbedarf gegen freien RAM | eng, aber machbar → Abschnitt 5 |
| Vorhandenes Produktions-Setup | **existiert nicht** → Abschnitt 6 |
| Fremddienste im Dauerbetrieb | teils einlösbar, Nominatim nicht → Abschnitt 7 |

Der Zustand des Servers zum Zeitpunkt der Prüfung:

```
Mem    3,7 Gi gesamt · 1,9 Gi belegt · 1,8 Gi verfügbar · Swap 608 Mi bereits benutzt
Disk   75 GB · 21 GB belegt · 51 GB frei
21 Container, nginx-Ports vergeben bis 3091 → der Block 3101/3102 ist frei
```

Die Anforderungen gehen in [01-anforderungen.md](01-anforderungen.md) von „2–4 vCPU, 4–8 GB RAM"
aus. Der Host hat 3,7 GB und trägt bereits elf Apps. Diese Lücke ist der rote Faden durch
alles Folgende.

---

## 2. Die vier Punkte auf einen Blick

| # | Punkt | Art | Wer entscheidet |
|---|---|---|---|
| 1 | PostGIS fehlt in der gemeinsamen Datenbank | Entscheidung mit Wirkung auf vier fremde Apps | Elmar |
| 2 | Keine Anmeldung — jeder Besucher ist Eigentümer | Muss vor dem Öffnen der Domain gelöst sein | Elmar |
| 3 | BRouter-Heap passt nicht zum freien RAM | Konfiguration, unstrittig | — |
| 4 | Kein Dockerfile, kein Prod-Compose, kein `/health` | reine Bauarbeit | — |

---

## 3. PostGIS gibt es in `pg-shared` nicht

**Befund.** Das Schema verlangt PostGIS an drei Stellen: `CREATE EXTENSION IF NOT EXISTS postgis`
in [drizzle/0000_medical_unicorn.sql](../drizzle/0000_medical_unicorn.sql), die Spaltentypen
`geometry(LineStringZ, 4326)` und `geometry(LineString, 4326)` in
[schema.ts](../src/lib/server/db/schema.ts#L33) und der GiST-Index `tours_geom_idx` in
[schema.ts:124](../src/lib/server/db/schema.ts#L124). Dazu kommen `ST_AsGeoJSON`,
`ST_GeomFromGeoJSON`, `ST_Simplify` und `ST_MakeEnvelope` in
[db/tours.ts](../src/lib/server/db/tours.ts). Ohne die Extension startet die App nicht — sie
läuft nicht bloß langsamer.

`pg-shared` läuft auf `pgvector/pgvector:pg17`. Verfügbar sind dort `vector`, `pgcrypto`,
`amcheck`, `pg_stat_statements` — PostGIS nicht. Und ARCHITEKTUR 4.4 ist an der Stelle
eindeutig: *„Wer mehr braucht, ändert das Image für alle vier Apps — das ist eine
Entscheidung, keine Kleinigkeit."*

**Die zwei Wege.**

*(a) Gemeinsames Image erweitern.* Eigenes Image `FROM pgvector/pgvector:pg17` plus
`postgresql-17-postgis-3`; das PGDG-Repo ist im offiziellen Postgres-Image bereits
eingerichtet, das ist ein Dockerfile mit drei Zeilen. Wandervogel bleibt damit auf dem
dokumentierten Weg, kostet keinen zusätzlichen Prozess und keinen zusätzlichen
`shared_buffers`-Block.

*(b) Eigene Postgres-Instanz für Wandervogel.* Genau der Zustand, der am 1. August
abgeschafft wurde (ARCHITEKTUR 12, „Eigener Postgres-Container ‚weil einfacher'"), und er
kostet 150 MB und mehr, die auf diesem Host nicht frei sind.

**Empfehlung: (a).** Mit einer Auflage: Ein Image-Wechsel an `pg-shared` ist genau der
Vorgang, der laut DEPLOYMENT 5 Collation-Schäden an Text-Indexen auslösen kann — mediathek
hatte das, unbemerkt, mit Duplikaten trotz UNIQUE-Constraint. Nach dem Wechsel gehört
deshalb ein `amcheck`-Lauf über alle vier Datenbanken dazu. `amcheck` liegt derzeit nur in
`mediathek` (OFFENE-PROBLEME 12), muss also vorher in den übrigen angelegt werden. Vorher
ein manuelles Hetzner-Backup, nicht nur den Dump (DEPLOYMENT 7).

**Zwei Details, die dabei leicht untergehen.**

- `CREATE EXTENSION postgis` verlangt Superuser. Die App-Rolle darf laut ARCHITEKTUR 4.1
  keiner sein. Auflösung: die Extension einmalig als `knora` in der Datenbank `wandervogel`
  anlegen; das `IF NOT EXISTS` in der Migration ist danach ein No-Op und die Migration läuft
  weiter mit der unprivilegierten App-Rolle.
- Die deutsche Sortierung der Tournamen kommt heute aus `POSTGRES_INITDB_ARGS` im
  [docker-compose.yml](../docker-compose.yml) — das wirkt nur beim `initdb` eines frischen
  Clusters. Der Cluster von `pg-shared` stammt aus knoras alter Instanz und wird nicht neu
  angelegt. Die Locale muss deshalb beim `CREATE DATABASE` gesetzt werden:
  `LOCALE_PROVIDER icu`, `ICU_LOCALE 'de-DE'`, `TEMPLATE template0`. Wird das vergessen,
  sortiert das Tourenarchiv still nach C-Locale — Umlaute hinten.

---

## 4. Es gibt keine Anmeldung

**Befund.** [hooks.server.ts](../src/hooks.server.ts) setzt `event.locals.ownerId` auf die
Konstante `SINGLE_OWNER_ID` aus [owner.ts](../src/lib/server/owner.ts). Jede Abfrage filtert
korrekt auf `owner_id` — nur ist dieser Eigentümer für *jeden* Besucher derselbe. Wer die
Domain kennt, kann Touren anlegen, ändern und löschen.

Das ist keine Nachlässigkeit, sondern eine bewusst aufgeschobene Aufgabe: Anmeldung und
Rollen sind MUSS in [01-anforderungen.md](01-anforderungen.md) Abschnitt 6.1 und stehen im
MVP-Schnitt als nächster Schritt. Für die Entwicklung war die Konstante die richtige Wahl.
Für eine öffentlich erreichbare Domain ist sie es nicht.

**Empfehlung.** Basic Auth im nginx-Vhost als Übergang. Eine `auth_basic`-Direktive und eine
`.htpasswd`-Datei, kein Eingriff in den Code, und die spätere echte Anmeldung wird davon
nicht behindert — sie ersetzt eine Zeile in `hooks.server.ts`, wie dort schon vorgesehen.
Alternative, wenn ohnehin nur eigene Geräte zugreifen: `allow`/`deny` auf bekannte Adressen.
Beides ist besser als ein offenes Schreib-API.

---

## 5. Speicher — BRouter ist der Kostenpunkt

**Befund.** [docker/brouter/Dockerfile](../docker/brouter/Dockerfile) setzt `-Xmx1g`. Der
Kommentar dort ist sachlich richtig (*„BRouter lädt Segmente bedarfsweise von der Platte —
deshalb genügt wenig Heap"*), nur ist 1 GB dann eben nicht „reichlich und passt auf den
kleinen Server", sondern mehr als die Hälfte des frei verfügbaren RAM.

Rechnung mit den gemessenen Werten: 1,8 GB verfügbar, davon Node-App 200–300 MB, BRouter
je nach Heap 400 MB bis 1 GB.

**Empfehlung.**

| Container | `JAVA_OPTS` / Laufzeit | `mem_limit` |
|---|---|---|
| `wv-app` (SvelteKit, adapter-node) | — | `512m` |
| `wv-brouter` | `-Xmx512m -Xms128m` | `640m` |

Zusammen 1,15 GB Deckel gegen 1,8 GB verfügbar. Es passt, aber der Puffer ist danach dünn
und der Swap ist mit 608 MB bereits angebrochen. **Wandervogel ist die letzte App, die ohne
vorheriges Aufräumen auf diesen Host geht.** Wer danach noch etwas deployen will, arbeitet
erst OFFENE-PROBLEME ab.

`mem_limit` ist ohnehin Pflicht (ARCHITEKTUR 6): ohne Deckel sucht sich der OOM-Killer das
Opfer selbst, und das wäre dann irgendeine der elf anderen Apps.

Was **nicht** kritisch ist: Der Build. `pnpm build` braucht 4,9 s, das verträgt auch ein
Host mit 2 vCPU. Und der Verbindungspool steht mit `max: 10` in
[db/index.ts:33](../src/lib/server/db/index.ts#L33) bereits genau im Budget, das
ARCHITEKTUR 4.2 für eine neue App vorsieht (5–10).

---

## 6. Ein Produktions-Setup existiert nicht

Nichts davon ist schwierig, aber nichts davon ist da:

| Fehlt | Anmerkung |
|---|---|
| `Dockerfile` für die App | Multi-Stage, schlankes Node-Image, `node build/index.js`. Keine `node_modules` im finalen Image (ARCHITEKTUR 8) |
| `docker-compose.prod.yml` | **ohne** `db`-Service, `hetzner-network` als `external: true`, `- default` mit aufführen, Ports nur auf `127.0.0.1:3101`, `mem_limit`, `restart: unless-stopped` |
| `/health` | ARCHITEKTUR 10 verlangt einen Endpunkt ohne Auth, **der die DB-Verbindung mitprüft**. knoras `/health` tut das nicht und meldete während des Umschaltfensters `ok`, während die App 500er lieferte (OFFENE-PROBLEME 21) |
| Migrationsschritt im Deploy | `drizzle-kit migrate`, nicht `push`. `push` ist ein Entwicklungswerkzeug und vergleicht gegen den Ist-Zustand |
| nginx-Vhost + Zertifikat | `sites-available` **und** Symlink, danach certbot. Domain steht noch nicht fest |
| Eintrag im Portschema | 3101/3102 in ARCHITEKTUR 5 vergeben, sonst vergibt der nächste denselben Block |
| Ergänzung in `DEPLOYMENT.md` | Deploy-Weg pro App ist dort dokumentiert; Wandervogel gehört in die Tabelle |

**Eine Falle, die zur Geschichte dieses Servers passt.** Das vorhandene
[docker-compose.yml](../docker-compose.yml) enthält einen `db`-Service mit eigenem
PostGIS-Container. Wird das Repo auf dem Server ausgecheckt und jemand ruft `docker compose
up -d` ohne `-f docker-compose.prod.yml` auf, läuft ein zweiter Postgres. Er würde
`knora_data` nicht beschädigen — er hat seinen eigenen Bind-Mount unter `./data/postgres` —
aber er kostet Speicher und ist stillschweigend die falsche Datenbank: die App schreibt
dann in eine leere Instanz statt in `pg-shared`. Das ist die harmlosere Variante von
DEPLOYMENT Regel 4, aber unangenehm genug. Möglichkeiten: den Dev-Compose umbenennen, oder
den Prod-Compose als `docker-compose.yml` führen und die Entwicklung auf `-f` umstellen.

---

## 7. Fremddienste — was der Host einlösen kann und was nicht

[README.md](../README.md) und [config.ts](../src/lib/config.ts) führen für jeden externen
Dienst eine Betriebs-Variante. Gemessen an diesem Server:

| Quelle | Betriebs-Ziel | Auf helsinki-80gb |
|---|---|---|
| Basiskarte | Protomaps-PMTiles selbst gehostet | **machbar.** Ein Deutschland-Extrakt sind wenige GB auf 51 GB frei; Auslieferung per nginx mit Range-Requests kostet praktisch keinen RAM |
| Höhendaten | lokale PMTiles statt AWS | **machbar**, dieselbe Rechnung. [api/dem](../src/routes/api/dem/%5Bz%5D/%5Bx%5D/%5By%5D.png/+server.ts) müsste von Proxy auf Dateizugriff umgestellt werden — die Stelle ist im Code schon dafür vorgesehen |
| Routing | BRouter selbst gehostet | **läuft schon so.** Segmente aktuell 239 MB, weltweit ~7 GB — Disk reicht |
| Ortssuche | eigene Nominatim-Instanz | **nicht machbar.** Ein Nominatim-Import braucht ein Vielfaches der 3,7 GB. Auf diesem Host ausgeschlossen |
| Wegenetz | eigenes Vektor-Overlay aus OSM-Extrakt | offen, kein Blocker — das Overlay ist per Anforderungen 10 als Fremdquelle ausdrücklich erlaubt und standardmäßig aus |

**Zu Nominatim.** Die Drosselung im eigenen Server ist korrekt gebaut — 1100 ms Mindestabstand
und ein Cache über 200 Anfragen in
[api/suche](../src/routes/api/suche/+server.ts). Der Betrieb über den öffentlichen Dienst
bleibt damit innerhalb der Nutzungsregeln, widerspricht aber der eigenen Anforderung
(„keine Fremd-Fair-Use-Dienste im Dauerbetrieb"). Das ist eine ehrlich zu treffende
Entscheidung, kein technisches Problem: entweder die Anforderung an dieser Stelle lockern
und es dokumentieren, oder Ortssuche auf einen leichteren Ansatz umstellen (eigener
Ortsindex aus einem OSM-Extrakt deckt „Ort, Gipfel, Hütte, Bahnhof" aus 6.2 ab und passt in
eine PostGIS-Tabelle — der Volltext-Komfort von Nominatim fehlt dann).

Ein Nebenbefund: Die Zwischenspeicher für DEM-Kacheln (400 Stück) und Suchtreffer (200) liegen
im Prozessspeicher und überleben keinen Neustart. Für einen einzelnen Nutzer ist das in
Ordnung; es ist nur kein Argument gegen die Lastfrage bei Fremddiensten.

---

## 8. Vorgeschlagene Reihenfolge

1. **Entscheidung zu Abschnitt 3** — gemeinsames Image erweitern oder eigene Instanz.
   Ohne diese Entscheidung ist alles Weitere hinfällig.
2. Hetzner-Backup, `amcheck` in den vier Datenbanken anlegen, Image wechseln,
   `amcheck`-Lauf, dann Datenbank `wandervogel` mit ICU-Locale und unprivilegierter Rolle
   anlegen (ARCHITEKTUR 4.1, inkl. `REVOKE CONNECT … FROM PUBLIC`).
3. Dockerfile, `docker-compose.prod.yml`, `/health`, Migrationsschritt.
4. nginx-Vhost auf 3101 mit Basic Auth, certbot, Portschema und `DEPLOYMENT.md` ergänzen.
5. Erstes Deploy, danach die Prüfschritte aus DEPLOYMENT 4: `docker ps`, Endpunkt,
   `pg_stat_activity`, `free -h`.
6. Erst danach die Fremdquellen einzeln ablösen — Basiskarte, dann Höhendaten.

Schritt 3 und 4 sind ein halber Tag. Schritt 2 ist der, bei dem etwas kaputtgehen kann,
und der einzige, der vier fremde Apps berührt.

---

## 9. Was hier bewusst nicht steht

Keine Aussage zur Domain (`wandervogel.elmarhepp.de` wäre naheliegend, ist aber nicht
entschieden), keine zur Frage, ob die Anmeldung aus 6.1 vor oder nach dem ersten Deploy
gebaut wird, und keine Größenangabe für die PMTiles-Extrakte — die hängt vom gewünschten
Gebiet ab und sollte gemessen statt geschätzt werden.

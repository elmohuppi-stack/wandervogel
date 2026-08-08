# Wandervogel — Weg zum ersten Deploy

> **Das hier ist eine Arbeitsliste, kein Nachschlagewerk.** Sie wird abgehakt und
> danach **gelöscht**. Genau an dieser Stelle stand vorher ein Deployment-Befund;
> der ist entfernt worden, weil er Serverwissen doppelte und innerhalb einer Woche
> in vier Zahlen falsch war.
>
> **Serverwissen steht deshalb nicht hier, sondern wird verlinkt:**
> [`optimize-hetzner/NEUE-APP.md`](../../optimize-hetzner/NEUE-APP.md) für den
> allgemeinen Ablauf, [`ARCHITEKTUR.md`](../../optimize-hetzner/ARCHITEKTUR.md) für
> die Regeln, [`OFFENE-PROBLEME.md`](../../optimize-hetzner/OFFENE-PROBLEME.md) für
> die beiden Serveraufgaben, die Wandervogel blockieren.
>
> Was diese App eigenbringt, steht im [README](../README.md) unter „Deployment".
>
> *Stand: 8. August 2026. Die Messwerte unten stammen von diesem Tag — wer sie
> später braucht, misst neu statt sie hier zu lesen.*

---

## Phase 0 — Vier Entscheidungen ✅

**Alle vier sind am 8. August 2026 gefallen.**

- [x] **0.1 Portblock: 3101/3102 geht an Wandervogel.** umweg ist auf 3111/3112
      vorgemerkt und in seiner `CLAUDE.md` umgetragen. Begründung war der Reifegrad,
      nicht die Vorliebe: Wandervogel hat Dockerfile, Prod-Compose und Healthcheck,
      umweg steht bei Phase 1 seines eigenen Plans.
      → [ARCHITEKTUR §5](../../optimize-hetzner/ARCHITEKTUR.md#5-portvergabe)
- [x] **0.2 Domain: `wandervogel.elmarhepp.de`.** Kein DNS-Eintrag nötig — der
      Wildcard-Record zeigt bereits auf den Server, das Zertifikat kommt mit certbot.
- [x] **0.3 §7 ist scharf gestellt statt gestrichen** — vier Regeln statt eines
      Verbots. Siehe unten.
- [x] **0.4 Speicherbudget** steht: App `mem_limit 384m`, BRouter `-Xmx384m` bei
      `512m`. Gemessen am laufenden Prod-Stack: 18 MiB und 54 MiB.

### 0.3 ausgeschrieben: §7 scharf gestellt

**Der alte Satz lautete: „Keine Fremd-Fair-Use-Dienste im Dauerbetrieb."** Absolut
formuliert — und konstruktionsbedingt verletzt, weil drei fremde Dienste in Benutzung
sind und einer davon auf 3,7 GB nicht selbst hostbar ist. Eine Regel, die dauerhaft
gebrochen ist, wird zu Rauschen.

**Gestrichen wurde sie ausdrücklich nicht.** Sie ist der Grund, warum BRouter selbst
läuft, warum `/api/dem` über den eigenen Server geht (und deshalb die IP der Besucher
nicht zu AWS), warum die Ortssuche gedrosselt und gecacht ist und warum es die
Begrenzung je IP gibt. Stattdessen stehen jetzt **vier Regeln** in
[Anforderungen §7](01-anforderungen.md), die nach *wer ruft an* und *wer bezahlt die
Infrastruktur* unterscheiden.

**Was daraus für die drei Dienste folgt:**

| Dienst | Wer ruft an | Regel | Wann |
|---|---|---|---|
| **Höhendaten** (AWS-Terrain über `/api/dem`) | **der Server**, für jeden Gast | **1** — selbst hosten, sobald machbar | **nächste Nacharbeit nach dem Livegang**, siehe 3.2 |
| Basiskarte (OpenFreeMap) | der Browser des Besuchers | **2** — unkritisch, der Anbieter bietet es an | später, ohne Frist |
| Ortssuche (Nominatim) | der Server, aber gedrosselt | **3** — Ausnahme, weil nicht hostbar | bleibt; Auslöser für die Neubewertung stehen in §7 |

**Kein Blocker für den Livegang.** Die Höhendaten sind der einzige Punkt, an dem der
eigene Server dauerhaft fremde Infrastruktur beansprucht — deshalb stehen sie ganz
oben auf der Liste danach, aber sie halten den ersten Deploy nicht auf.

---

## Phase 1 — Server vorbereiten

**Berührt vier fremde Apps.** Deshalb zuerst, mit Snapshot, und am besten zu zweit.
Die Begründungen stehen in
[OFFENE-PROBLEME Punkt 27 und 28](../../optimize-hetzner/OFFENE-PROBLEME.md).

- [x] **1.1 Swap wieder einschalten** — erledigt am 8. August. 2 GiB aktiv,
      `fstab`-Eintrag gesetzt, systemd-Einbindung geprüft
      (`swap.target.requires/swapfile.swap`). Offen geblieben: `vm.swappiness`
      steht auf der Vorgabe 60
- [x] **1.2 Hetzner-Snapshot** — von Elmar erstellt am 8. August
- [x] **1.3 `pg-shared`-Image um PostGIS erweitert**, Container neu angelegt.
      Eigenes Bild `pg-shared:pg17-postgis`, **Basisimage auf den Digest gepinnt**,
      damit glibc unverändert bleibt
- [x] **1.4 `amcheck` über alle vier Datenbanken** — 194 Indexe, ohne Befund,
      dieselbe Zahl wie am 2. August. Keine ungültigen Indexe
- [x] **1.5 Datenbank + Rolle `wandervogel`** mit ICU `de-DE`, unprivilegiert,
      `REVOKE CONNECT … FROM PUBLIC`. Zugangsdaten unter
      `/var/www/wandervogel/.env.db`, Mode 600
- [x] **1.6 `CREATE EXTENSION postgis`** — PostGIS 3.6.4 mit GEOS und PROJ

> **Phase 1 ist durch, und zwar ohne Schaden.** Die Belege im Einzelnen stehen in
> [OFFENE-PROBLEME Punkt 28](../../optimize-hetzner/OFFENE-PROBLEME.md). Kurz:
> glibc und ICU unverändert, `datcollversion` stimmt in allen vier Datenbanken mit
> der tatsächlichen Version überein, Tabellenzahlen und Extensions unverändert,
> alle vier fremden Endpunkte antworten mit 200.
>
> Die deutsche Sortierung ist nicht angenommen, sondern nachgemessen:
> `Ähre < Apfel < Öl < Zeder`.

---

## Phase 2 — Die App deploybar machen

Reine Bauarbeit im Repo, fasst den Server nicht an. **Nichts davon existiert bisher.**

- [x] **2.1 `Dockerfile`** — Multi-Stage, schlankes Node-Image, `node build/index.js`,
      keine `node_modules` im finalen Bild.
- [x] **2.2 Bootstrap-Weg ins Image** — siehe unten, der zweite Stolperstein.
- [x] **2.3 `docker-compose.prod.yml`** — **ohne** `db`-Service, `hetzner-network` als
      `external: true`, `- default` mit aufführen, Ports nur auf `127.0.0.1:3101`,
      `mem_limit`, `restart: unless-stopped`.
- [x] **2.4 `/health`**, das die Datenbankverbindung **mitprüft**. knoras `/health` tat
      das nicht und meldete `ok`, während die App 500er lieferte.
- [ ] **2.5 Migrationsschritt im Deploy:** `drizzle-kit migrate`, **nicht** `push`.
- [x] **2.6 BRouter-Speicher deckeln** — siehe Rechnung unten.

> **Phase 2 ist bis auf 2.5 erledigt und lokal gegen das gebaute Bild geprüft.**
> Gemessen mit laufendem Prod-Stack: App 18 MiB von 384, BRouter 54 MiB von 512,
> beide Container `healthy`, `/health` meldet bei gestoppter Datenbank 503 und
> danach wieder 200, Routing läuft über das Compose-Netz, und der Bootstrap legt
> im laufenden Container einen Admin an. Bild: 434 MB.
>
> Offen bleibt **2.5**, der Migrationsschritt — der gehört in den Deploy-Ablauf
> und nicht ins Bild.

### 2.2 ausgeschrieben: der Bootstrap funktioniert nur lokal — **gelöst**

`make db-admin` braucht `data/admin.mjs`, `src/lib/server/password.ts` und Node. Ein
Multi-Stage-Image enthält davon **nichts** — der erste Zugang ließe sich auf dem
Server also gar nicht anlegen. Zwei Wege, beide tragfähig:

- die beiden Dateien mit ins finale Image kopieren, Aufruf über `docker compose exec`
- oder als Unterbefehl in den Serverprozess: `node build/index.js --create-admin`

**Gewählt wurde der erste Weg.** `data/admin.mjs` plus die beiden Module
`password.ts` und `username.ts` liegen im Bild; Node 22 strippt die Typen, und
`postgres` ist als Laufzeitabhängigkeit ohnehin da. Die Gebrauchsanweisung des
Skripts nennt jetzt beide Aufrufwege — `make db-admin` auf dem Entwicklungsrechner,
`docker compose exec` auf dem Server. Das Prinzip steht in
[NEUE-APP §4.1](../../optimize-hetzner/NEUE-APP.md#41-der-erste-admin); dort steht auch,
warum das Passwort über `stdin` gehört und nicht als Argument.

### 2.6 ausgeschrieben: die Speicherrechnung

Das BRouter-Dockerfile liefert `-Xmx1g` aus. Gemessen am 8. August:

```
verfügbar auf dem Host      1457 MiB     (enthält reklamierbaren Page-Cache)

  App (adapter-node)         ~384 MiB    mem_limit
  BRouter bei -Xmx384m       ~512 MiB    mem_limit ≈ Heap + 25 %
  ─────────────────────────────────────
  belegt                      896 MiB
  bleibt                     ~560 MiB
```

BRouter lädt Segmente bedarfsweise von der Platte — deshalb genügt wenig Heap. Mit
dem ausgelieferten Gigabyte bliebe dagegen fast nichts übrig.

**Die 1457 MiB sind optimistisch:** darin steckt Page-Cache, den Postgres benutzt.
Nimmt man ihn, wird die gemeinsame Datenbank langsamer. Das ist der zweite Grund für
Phase 1.1.

---

## Phase 3 — Daten auf den Server

- [x] **3.1 BRouter-Segmente** — Deutschland vollständig auf dem Server:
      `E5_N45`, `E5_N50`, `E10_N45`, `E10_N50`, zusammen **720 MB** unter
      `/var/www/wandervogel/data/brouter/segments4`. Jede Datei gegen die
      `Content-Length` der Quelle geprüft, keine `.part`-Reste. Platte danach
      48 GB frei. Die Zugspitze (`E10_N45`) ist damit abgedeckt — das Feld, das
      lokal fehlte
- [ ] **3.2 Kartenkacheln**, falls Entscheidung 0.3 auf „selbst hosten" fällt:
      Protomaps-Extrakt und Mapterhorn-Terrain als PMTiles, per nginx mit
      Range-Requests. Kostet Platte, praktisch keinen RAM.

---

## Phase 4 — Live schalten

Ab hier ist die Reihenfolge zwingend: certbot braucht einen erreichbaren Vhost, der
Vhost einen laufenden Container, der Container seine Datenbank. Ausführlich in
[NEUE-APP §4](../../optimize-hetzner/NEUE-APP.md#4-live-schaltung).

- [ ] **4.1** Verzeichnis `/var/www/wandervogel`, Code per git oder rsync
- [ ] **4.2** `.env` mit Mode 600 — **inklusive `PUBLIC_LEGAL_*`**
- [ ] **4.3** Stack starten, `docker ps` prüfen, **erst dann weiter**
- [ ] **4.4** **Ersten Admin anlegen** (Weg aus 2.2) — **vor** dem Vhost
- [ ] **4.5** nginx-Vhost in `sites-available` **und** Symlink in `sites-enabled`
- [ ] **4.6** Zertifikat per certbot
- [ ] **4.7** Prüfen: Endpunkt, `/health`, `pg_stat_activity`, `free -h`

**Zu 4.2:** Solange die `PUBLIC_LEGAL_*` leer sind, tragen Impressum und
Datenschutzerklärung einen Entwurfshinweis und erfüllen § 5 DDG nicht. Die App ist
seit dem Gastzugang **ohne Anmeldung erreichbar** — die Pflichten greifen ab der
ersten Sekunde, in der der Vhost steht.

**Zu 4.4:** Vor dem Vhost, weil eine erreichbare App ohne Admin im besten Fall
nutzlos ist.

---

## Phase 5 — Nachtragen, sonst macht es niemand

- [ ] `ARCHITEKTUR.md` §5 — Portblock eintragen
- [ ] `ARCHITEKTUR.md` §4.4 — PostGIS in die Extension-Liste
- [ ] `DEPLOYMENT.md` — Zeile in der Übersicht und der Deploy-Weg
- [ ] `OFFENE-PROBLEME.md` — Punkte 27 und 28 auf erledigt
- [ ] Die Abschaltfrage beantworten: **woran würde man merken, dass diese App nicht
      mehr benutzt wird?**
- [ ] **Diese Datei löschen.** Sie ist abgearbeitet, und was von ihr bleiben soll,
      steht dann in den Dokumenten oben.

---

## Die zwei Stolpersteine, auf einen Blick

**Nicht PostGIS.** Das kostet im Betrieb fast nichts, und der Weg ist klar
beschrieben.

1. **Phase 0.3** — die App benutzt drei Dienste, die ihre eigenen Anforderungen im
   Dauerbetrieb verbieten, und bei der Ortssuche gibt es auf diesem Server keine
   saubere Lösung. Eine Entscheidung, keine Bauarbeit, und am Deploy-Tag zu spät.
2. **Phase 2.2** — der Bootstrap funktioniert heute nur auf dem Entwicklungsrechner.
   Man merkt es genau in dem Moment, in dem man sich zum ersten Mal anmelden will.

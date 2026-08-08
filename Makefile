# Wandervogel — lokale Bedienung.
#
#   make          zeigt alle Befehle
#   make start    Dienste + Entwicklungsserver im Hintergrund
#   make stop     alles wieder anhalten
#
# Der Entwicklungsserver läuft bewusst auf dem Host und nicht im Container,
# damit Hot Reload funktioniert. In Docker stehen nur Postgres und BRouter.
#
# **Die Hilfe wird aus den `##`-Kommentaren erzeugt.** Vorher war sie ein
# von Hand gepflegter Block, und genau das ging schief: `db-admin` fehlte
# darin vom ersten Tag an. Ein neues Ziel ohne `##` taucht nicht auf — das
# ist die einzige Regel.

SHELL := /bin/bash

# Die Dienstedatei heißt ausdrücklich `dev`.
#
# Sie enthält einen eigenen Postgres — richtig zum Entwickeln, falsch auf dem
# Server, wo `pg-shared` die Datenbank stellt. Hieße sie `docker-compose.yml`,
# genügte ein `docker compose up -d` im ausgecheckten Verzeichnis, um dort
# einen zweiten Postgres zu starten: er beschädigte nichts, kostete aber
# Speicher, und die App schriebe still in die falsche, leere Datenbank.
# Unter diesem Namen findet ein blanker Aufruf schlicht nichts.
COMPOSE := docker compose -f docker-compose.dev.yml

APP_PORT     ?= 5180
PREVIEW_PORT ?= 3000

RUN_DIR  := .run
DEV_PID  := $(RUN_DIR)/dev.pid
DEV_LOG  := $(RUN_DIR)/dev.log
APP_PID  := $(RUN_DIR)/app.pid
APP_LOG  := $(RUN_DIR)/app.log

.DEFAULT_GOAL := help
.PHONY: help env services start dev stop restart status logs \
        check build preview segments \
        db-generate db-migrate db-studio db-admin db-dump db-restore \
        clean kill-own brouter-restart

## ----------------------------------------------------------------- Übersicht

help:
	@echo 'Wandervogel — verfügbare Befehle:'
	@awk 'BEGIN { FS = ":.*##" } \
		/^##@/ { printf "\n  \033[1m%s\033[0m\n", substr($$0, 5); next } \
		/^[a-z][a-z0-9-]*:.*##/ { printf "    %-14s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ''
	@echo "  Entwicklung auf Port $(APP_PORT), gebaute App auf $(PREVIEW_PORT)."
	@echo '  Logs der Hintergrundserver liegen in $(RUN_DIR)/.'

## -------------------------------------------------------------- Voraussetzungen

$(RUN_DIR):
	@mkdir -p $(RUN_DIR)

# .env wird von Compose gelesen; ohne POSTGRES_PASSWORD startet die
# Datenbank nicht. Deshalb hier prüfen statt später im Container scheitern.
env:
	@if [ ! -f .env ]; then \
		echo 'Es fehlt .env. Anlegen mit:'; \
		echo '  cp .env.example .env   # danach POSTGRES_PASSWORD setzen'; \
		exit 1; \
	fi

# Kein eigenes `make install`: jedes Ziel, das Pakete braucht, hängt hier
# dran und installiert von selbst, sobald package.json oder der Lockfile
# jünger sind als node_modules.
node_modules: package.json pnpm-lock.yaml
	pnpm install
	@touch node_modules

# Kein `services-stop`: `make stop` fährt die Dienste mit herunter, und zwei
# Wege zum selben Ziel sind einer zu viel.
services: env
	$(COMPOSE) up -d
	@echo 'Warte auf die Datenbank …'
	@until [ "$$(docker inspect -f '{{.State.Health.Status}}' wv-db 2>/dev/null)" = healthy ]; do \
		sleep 1; \
	done
	@echo 'Dienste laufen.'

##@ Entwicklung

# Im Hintergrund, damit `make stop` einen Gegenpart hat. Die PID wandert in
# eine Datei — nur was hier notiert ist, darf `make stop` später beenden.
start: node_modules services | $(RUN_DIR) ## Dienste und Entwicklungsserver starten
	@if lsof -ti tcp:$(APP_PORT) >/dev/null 2>&1; then \
		echo 'Auf Port $(APP_PORT) läuft schon etwas — vorher: make stop'; \
		exit 1; \
	fi
	@pnpm dev > $(DEV_LOG) 2>&1 & echo $$! > $(DEV_PID)
	@echo 'Starte Entwicklungsserver …'
	@for i in $$(seq 1 60); do \
		if lsof -ti tcp:$(APP_PORT) >/dev/null 2>&1; then \
			echo 'Läuft auf http://localhost:$(APP_PORT)'; \
			echo "Log: $(DEV_LOG)"; \
			exit 0; \
		fi; \
		sleep 1; \
	done; \
	echo 'Server ist nicht hochgekommen. Letzte Zeilen:'; tail -n 20 $(DEV_LOG); exit 1

dev: node_modules services ## Entwicklungsserver im Vordergrund, Strg-C beendet
	pnpm dev

stop: ## Beide Server und die Docker-Dienste anhalten
	@$(MAKE) --no-print-directory kill-own PIDFILE=$(DEV_PID) PORT=$(APP_PORT) WHAT='Entwicklungsserver'
	@$(MAKE) --no-print-directory kill-own PIDFILE=$(APP_PID) PORT=$(PREVIEW_PORT) WHAT='Produktionsserver'
	$(COMPOSE) down

restart: stop start ## stop, dann start

status: ## Läuft was?
	@$(MAKE) --no-print-directory status-one PIDFILE=$(DEV_PID) PORT=$(APP_PORT) WHAT='Entwicklungsserver'
	@$(MAKE) --no-print-directory status-one PIDFILE=$(APP_PID) PORT=$(PREVIEW_PORT) WHAT='Produktionsserver'
	@$(COMPOSE) ps

# Dieselbe Unterscheidung wie in kill-own, und aus demselben Grund.
#
# Vorher schaute status nur, ob der Port belegt ist. Auf Port 3000 liegt auf
# diesem Rechner aber eine fremde App — status meldete also einen laufenden
# Produktionsserver, den es nie gab. Das ist genau die Verwechslung, die bei
# kill-own schon einmal Docker Desktop mitgerissen hat; hier kostet sie nur
# eine Falschaussage, aber falsch ist sie trotzdem.
.PHONY: status-one
status-one:
	@pid=$$(cat $(PIDFILE) 2>/dev/null); \
	if [ -n "$$pid" ] && kill -0 $$pid 2>/dev/null; then \
		printf '%-19s läuft — http://localhost:%s\n' '$(WHAT):' '$(PORT)'; \
	elif lsof -ti tcp:$(PORT) >/dev/null 2>&1; then \
		printf '%-19s aus (Port %s ist belegt, aber von jemand anderem)\n' '$(WHAT):' '$(PORT)'; \
	else \
		printf '%-19s aus\n' '$(WHAT):'; \
	fi

logs: ## Docker-Logs folgen
	$(COMPOSE) logs -f

# Beendet nur, was dieses Makefile selbst gestartet hat.
#
# Vorher stand hier ein `kill` auf alles, was auf dem Port hört. Das hat
# einen fremden Docker-Proxy auf Port 3000 erwischt — dort lief eine andere
# App — und in der Folge Docker Desktop mitgerissen. Ein Werkzeug, das
# fremde Prozesse abschießt, weil sie zufällig auf derselben Nummer hören,
# ist kaputt, egal wie bequem es sonst wäre.
#
# `pkill -P` zuerst: `pnpm dev` startet Vite als Kindprozess, der ein kill
# auf die pnpm-PID sonst überlebt.
kill-own:
	@pid=$$(cat $(PIDFILE) 2>/dev/null); \
	if [ -z "$$pid" ] || ! kill -0 $$pid 2>/dev/null; then \
		rm -f $(PIDFILE); \
		if lsof -ti tcp:$(PORT) >/dev/null 2>&1; then \
			echo "$(WHAT): Port $(PORT) ist belegt, aber nicht von uns — nichts angefasst."; \
		else \
			echo "$(WHAT) lief nicht."; \
		fi; \
		exit 0; \
	fi; \
	pkill -P $$pid 2>/dev/null || true; \
	kill $$pid 2>/dev/null || true; \
	for i in $$(seq 1 10); do kill -0 $$pid 2>/dev/null || break; sleep 1; done; \
	kill -9 $$pid 2>/dev/null || true; \
	rm -f $(PIDFILE); \
	echo "$(WHAT) angehalten."

##@ Prüfen und Bauen

check: node_modules ## Typen und Svelte prüfen
	pnpm check

build: node_modules ## Produktions-Build (adapter-node)
	pnpm build

# Startet den Build über adapter-node, nicht `vite preview` — so läuft lokal
# dasselbe wie später auf dem Server. Angehalten wird über `make stop`.
preview: build services | $(RUN_DIR) ## Gebaute App starten, wie auf dem Server
	@if lsof -ti tcp:$(PREVIEW_PORT) >/dev/null 2>&1; then \
		echo "Auf Port $(PREVIEW_PORT) läuft schon etwas."; exit 1; \
	fi
	@set -a; . ./.env; set +a; \
		PORT=$(PREVIEW_PORT) node build/index.js > $(APP_LOG) 2>&1 & echo $$! > $(APP_PID)
	@for i in $$(seq 1 30); do \
		if lsof -ti tcp:$(PREVIEW_PORT) >/dev/null 2>&1; then \
			echo 'Läuft auf http://localhost:$(PREVIEW_PORT)'; \
			echo "Log: $(APP_LOG)"; \
			exit 0; \
		fi; \
		sleep 1; \
	done; \
	echo 'Server ist nicht hochgekommen. Letzte Zeilen:'; tail -n 20 $(APP_LOG); exit 1

##@ Datenbank

# drizzle-kit liest DATABASE_URL aus der Umgebung, nicht aus .env — deshalb
# dieselbe Quelle wie bei `make preview`.
DB_ENV := set -a; . ./.env; set +a;

# Kein `db-push`. Das Ziel gab es, war aber ausdrücklich „nur zum
# Experimentieren" — und es ist der einzige Befehl im Projekt, der Daten
# zerstören kann: ohne Migrationsdatei vergleicht drizzle-kit gegen den
# Ist-Zustand und schlägt bei PostGIS-Nebenschemata vor, die komplette
# Erweiterung zu löschen (siehe drizzle.config.ts). Der Weg ist
# db-generate, die erzeugte Datei lesen, dann db-migrate.
db-migrate: env node_modules services ## Schema anwenden
	@$(DB_ENV) pnpm exec drizzle-kit migrate
	@echo 'Migrationen angewendet.'

db-generate: env node_modules ## Migration aus dem Schema erzeugen
	@$(DB_ENV) pnpm exec drizzle-kit generate
	@echo 'Erzeugte Datei vor dem Anwenden lesen — siehe drizzle.config.ts.'

db-studio: env node_modules services ## Tabellen im Browser ansehen
	@$(DB_ENV) pnpm exec drizzle-kit studio

# Der einzige Weg in eine frische Installation: Selbstregistrierung gibt es
# laut Anforderungen 6.1 nicht. Auf einen vorhandenen Namen angewandt setzt
# der Aufruf dessen Passwort zurück — die Notbremse, wenn niemand mehr
# hineinkommt.
db-admin: env node_modules services ## Admin anlegen oder Passwort zurücksetzen: NAME= PASS= ANZEIGE=
	@[ -n "$(NAME)" ] && [ -n "$(PASS)" ] || { $(MAKE) --no-print-directory db-admin-hilfe; exit 1; }
	@$(DB_ENV) NAME='$(NAME)' PASS='$(PASS)' ANZEIGE='$(ANZEIGE)' node data/admin.mjs

# Ohne eckige Klammern.
#
# Vorher stand hier `[ANZEIGE="…"]` — die übliche Schreibweise für „optional"
# aus Handbuchseiten. Wer die Zeile kopiert, bekommt in zsh aber
# `no matches found: [ANZEIGE=…]`: dort ist `[…]` ein Dateimuster. Eine
# Gebrauchsanweisung, die beim Kopieren scheitert, ist keine.
.PHONY: db-admin-hilfe
db-admin-hilfe:
	@echo 'make db-admin — den ersten Zugang anlegen oder ein Passwort zurücksetzen.'
	@echo ''
	@echo '  NAME     Anmeldename. Mindestens 3 Zeichen aus a-z 0-9 . _ - + @'
	@echo '           Eine E-Mail-Adresse ist damit ein gültiger Name.'
	@echo '  PASS     Passwort, mindestens 4 Zeichen. In Anführungszeichen'
	@echo '           setzen, sonst frisst die Shell $$ ! und Leerzeichen.'
	@echo '  ANZEIGE  Anzeigename, wie er in der App steht. Optional;'
	@echo '           ohne Angabe wird NAME genommen.'
	@echo ''
	@echo '  make db-admin NAME=elmar PASS='"'"'geheim-und-lang'"'"''
	@echo '  make db-admin NAME=elmar.hepp@example.com PASS='"'"'geheim-und-lang'"'"' ANZEIGE='"'"'Elmar Hepp'"'"''
	@echo ''
	@echo '  Auf einen vorhandenen Namen angewandt setzt der Aufruf dessen'
	@echo '  Passwort zurück und beendet alle offenen Sitzungen.'

# Erfüllt die Anforderung „Backup der Nutzdaten mit einem Befehl".
db-dump: env services ## Nutzdaten sichern nach data/backup/
	@mkdir -p data/backup
	@f=data/backup/wandervogel-$$(date +%F-%H%M).dump; \
	docker exec wv-db pg_dump -Fc -U $${POSTGRES_USER:-wandervogel} \
		-d $${POSTGRES_DB:-wandervogel} > $$f && \
	echo "Gesichert: $$f ($$(du -h $$f | cut -f1))"

db-restore: env services ## Sicherung zurückspielen: FILE=…
	@[ -n "$(FILE)" ] || { echo 'FILE fehlt: make db-restore FILE=data/backup/…'; exit 1; }
	@docker exec -i wv-db pg_restore -U $${POSTGRES_USER:-wandervogel} \
		-d $${POSTGRES_DB:-wandervogel} --clean --if-exists < $(FILE)
	@echo 'Zurückgespielt.'

##@ Daten und Aufräumen

# Ohne ARGS lädt das Skript Deutschland (~800 MB).
#   make segments ARGS=E5_N45
#   make segments ARGS=--alps
segments: ## BRouter-Segmente laden, z. B. ARGS=E5_N45
	pnpm segments $(ARGS)
	@echo 'Neue Segmente sind erst nach einem Neustart des Routers sichtbar:'
	@echo '  make brouter-restart'

brouter-restart: env ## BRouter neu starten, damit neue Segmente greifen
	$(COMPOSE) restart brouter

# Laufzeitdaten unter data/ bleiben unangetastet — dort liegen Datenbank und
# die großen BRouter-Segmente. Für einen wirklich frischen Stand zusätzlich
# `rm -rf node_modules`; ein eigenes Ziel dafür war ein Einzeiler zu viel.
clean: ## Build-Artefakte entfernen
	rm -rf build .svelte-kit $(RUN_DIR)

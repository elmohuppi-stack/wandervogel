# Wandervogel — lokale Bedienung.
#
#   make start    Dienste + Entwicklungsserver im Hintergrund
#   make stop     alles wieder anhalten
#   make build    Produktions-Build
#
# Der Entwicklungsserver läuft bewusst auf dem Host und nicht im Container,
# damit Hot Reload funktioniert. In Docker stehen nur Postgres und BRouter.

SHELL := /bin/bash

APP_PORT     ?= 5180
PREVIEW_PORT ?= 3000

RUN_DIR  := .run
DEV_PID  := $(RUN_DIR)/dev.pid
DEV_LOG  := $(RUN_DIR)/dev.log
APP_PID  := $(RUN_DIR)/app.pid
APP_LOG  := $(RUN_DIR)/app.log

.DEFAULT_GOAL := help
.PHONY: help install env services services-stop logs start dev stop restart \
        build preview preview-stop check segments status clean clean-all \
        db-generate db-migrate db-push db-studio db-dump db-restore kill-own

## ----------------------------------------------------------------- Übersicht

help:
	@echo 'Wandervogel — verfügbare Befehle:'
	@echo ''
	@echo '  make install        Abhängigkeiten installieren (pnpm)'
	@echo '  make start          Dienste + Entwicklungsserver (Hintergrund, Port $(APP_PORT))'
	@echo '  make dev            Entwicklungsserver im Vordergrund (Strg-C beendet)'
	@echo '  make stop           Entwicklungsserver, Produktionsserver und Dienste anhalten'
	@echo '  make restart        stop, dann start'
	@echo '  make status         läuft was?'
	@echo ''
	@echo '  make build          Produktions-Build (adapter-node)'
	@echo '  make preview        gebaute App starten (Hintergrund, Port $(PREVIEW_PORT))'
	@echo '  make check          Typen und Svelte prüfen'
	@echo ''
	@echo '  make services       nur Docker-Dienste starten'
	@echo '  make services-stop  nur Docker-Dienste anhalten'
	@echo '  make logs           Docker-Logs folgen'
	@echo '  make segments       BRouter-Segmente laden, z. B. ARGS=E5_N45'
	@echo ''
	@echo '  make db-migrate     Datenbankschema anwenden'
	@echo '  make db-generate    Migration aus dem Schema erzeugen'
	@echo '  make db-studio      Tabellen im Browser ansehen'
	@echo '  make db-dump        Nutzdaten sichern nach data/backup/'
	@echo '  make db-restore     Sicherung zurückspielen, FILE=…'
	@echo ''
	@echo '  make clean          Build-Artefakte entfernen'
	@echo '  make clean-all      zusätzlich node_modules (Laufzeitdaten bleiben)'

## -------------------------------------------------------------- Voraussetzungen

$(RUN_DIR):
	@mkdir -p $(RUN_DIR)

# .env wird von docker compose gelesen; ohne POSTGRES_PASSWORD startet die
# Datenbank nicht. Deshalb hier prüfen statt später im Container scheitern.
env:
	@if [ ! -f .env ]; then \
		echo 'Es fehlt .env. Anlegen mit:'; \
		echo '  cp .env.example .env   # danach POSTGRES_PASSWORD setzen'; \
		exit 1; \
	fi

install:
	pnpm install

node_modules: package.json pnpm-lock.yaml
	pnpm install
	@touch node_modules

## ---------------------------------------------------------------- Dienste

services: env
	docker compose up -d
	@echo 'Warte auf die Datenbank …'
	@until [ "$$(docker inspect -f '{{.State.Health.Status}}' wv-db 2>/dev/null)" = healthy ]; do \
		sleep 1; \
	done
	@echo 'Dienste laufen.'

services-stop:
	docker compose down

logs:
	docker compose logs -f

## -------------------------------------------------------- Entwicklungsserver

# Im Hintergrund, damit `make stop` einen Gegenpart hat. Die PID wandert in
# eine Datei — nur was hier notiert ist, darf `make stop` später beenden.
start: node_modules services | $(RUN_DIR)
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

dev: node_modules services
	pnpm dev

stop:
	@$(MAKE) --no-print-directory kill-own PIDFILE=$(DEV_PID) PORT=$(APP_PORT) WHAT='Entwicklungsserver'
	@$(MAKE) --no-print-directory kill-own PIDFILE=$(APP_PID) PORT=$(PREVIEW_PORT) WHAT='Produktionsserver'
	docker compose down

restart: stop start

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
.PHONY: kill-own
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

status:
	@if lsof -ti tcp:$(APP_PORT) >/dev/null 2>&1; then \
		echo 'Entwicklungsserver: läuft — http://localhost:$(APP_PORT)'; \
	else echo 'Entwicklungsserver: aus'; fi
	@if lsof -ti tcp:$(PREVIEW_PORT) >/dev/null 2>&1; then \
		echo 'Produktionsserver:  läuft — http://localhost:$(PREVIEW_PORT)'; \
	else echo 'Produktionsserver:  aus'; fi
	@docker compose ps

## ---------------------------------------------------------------- Build

build: node_modules
	pnpm build

# Startet den Build über adapter-node, nicht `vite preview` — so läuft lokal
# dasselbe wie später auf dem Server.
preview: build services | $(RUN_DIR)
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

preview-stop:
	@$(MAKE) --no-print-directory kill-own PIDFILE=$(APP_PID) PORT=$(PREVIEW_PORT) WHAT='Produktionsserver'

check: node_modules
	pnpm check

# Ohne ARGS lädt das Skript Deutschland (~800 MB).
#   make segments ARGS=E5_N45
#   make segments ARGS=--alps
segments:
	pnpm segments $(ARGS)
	@echo 'Nach neuen Segmenten: docker compose restart brouter'

## ---------------------------------------------------------------- Datenbank

# drizzle-kit liest DATABASE_URL aus der Umgebung, nicht aus .env — deshalb
# dieselbe Quelle wie bei `make preview`.
DB_ENV := set -a; . ./.env; set +a;

db-generate: env node_modules
	@$(DB_ENV) pnpm exec drizzle-kit generate

db-migrate: env node_modules services
	@$(DB_ENV) pnpm exec drizzle-kit migrate
	@echo 'Migrationen angewendet.'

# Nur zum Experimentieren. Schreibt das Schema ohne Migrationsdatei und
# kann deshalb kein CREATE EXTENSION mittragen.
db-push: env node_modules services
	@$(DB_ENV) pnpm exec drizzle-kit push

db-studio: env node_modules services
	@$(DB_ENV) pnpm exec drizzle-kit studio

# Erfüllt die Anforderung „Backup der Nutzdaten mit einem Befehl".
db-dump: env services
	@mkdir -p data/backup
	@f=data/backup/wandervogel-$$(date +%F-%H%M).dump; \
	docker exec wv-db pg_dump -Fc -U $${POSTGRES_USER:-wandervogel} \
		-d $${POSTGRES_DB:-wandervogel} > $$f && \
	echo "Gesichert: $$f ($$(du -h $$f | cut -f1))"

# Zurückspielen: make db-restore FILE=data/backup/…
db-restore: env services
	@[ -n "$(FILE)" ] || { echo 'FILE fehlt: make db-restore FILE=data/backup/…'; exit 1; }
	@docker exec -i wv-db pg_restore -U $${POSTGRES_USER:-wandervogel} \
		-d $${POSTGRES_DB:-wandervogel} --clean --if-exists < $(FILE)
	@echo 'Zurückgespielt.'

## ---------------------------------------------------------------- Aufräumen

# Laufzeitdaten unter data/ bleiben unangetastet — dort liegen Datenbank und
# die großen BRouter-Segmente.
clean:
	rm -rf build .svelte-kit $(RUN_DIR)

clean-all: clean
	rm -rf node_modules

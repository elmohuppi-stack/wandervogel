# Wandervogel — Produktionsbild.
#
# Drei Stufen, damit im letzten Bild nur landet, was zur Laufzeit gebraucht
# wird: `build/` und die Produktionsabhängigkeiten. Gemessen 5 MB + 53 MB.
# Die Regel dahinter steht in optimize-hetzner/ARCHITEKTUR.md 8 — die Images
# auf dem Host waren einmal 30,6 GB und sind jetzt 12,4 GB, und das bleibt
# nur so, wenn jede App mitzieht.
#
# `--prod` heißt nicht „keine node_modules". Der Build von adapter-node lässt
# `drizzle-orm` und `postgres` extern; ohne sie startet der Server nicht.
# Nachgemessen: mit ausschließlich Produktionsabhängigkeiten läuft er.

ARG NODE_VERSION=22.20

# ---------------------------------------------------------------- Abhängigkeiten
FROM node:${NODE_VERSION}-slim AS deps
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------- Bauen
FROM node:${NODE_VERSION}-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Nur die Laufzeitabhängigkeiten übrig lassen. `--prod` entfernt die
# Entwicklungspakete aus dem vorhandenen Baum, statt neu aufzulösen.
RUN pnpm prune --prod

# ---------------------------------------------------------------- Laufzeit
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# `tini` als PID 1: Node reicht SIGTERM sonst nicht an Kindprozesse weiter,
# und `docker compose down` würde zehn Sekunden auf den Timeout warten.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends tini curl \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Migrationen und Schema — der Deploy wendet sie vor dem Start an.
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts

# Der Bootstrap muss ins Bild.
#
# `make db-admin` ist der einzige Weg in eine frische Installation, und er
# braucht drei Dateien: das Skript, das Passwort-Modul und die Namensregel.
# Ohne sie ließe sich auf dem Server kein erster Zugang anlegen — und man
# merkt es genau dann, wenn man sich zum ersten Mal anmelden will.
#
# Die beiden Module sind TypeScript und werden hier *nicht* übersetzt: Node
# 22 strippt Typen von selbst. Genau dafür importieren sie nichts außer
# node-Bordmitteln (siehe den Kopf von src/lib/server/password.ts).
COPY --from=build /app/data/admin.mjs ./data/admin.mjs
# Migrationen laufen ueber drizzle-orm statt drizzle-kit — Letzteres ist eine
# Entwicklungsabhaengigkeit und liegt hier nicht. Begruendung im Skript.
COPY --from=build /app/data/migrate.mjs ./data/migrate.mjs
COPY --from=build /app/src/lib/server/password.ts ./src/lib/server/password.ts
COPY --from=build /app/src/lib/server/username.ts ./src/lib/server/username.ts

# Nicht als root. Das Node-Image bringt den Benutzer `node` bereits mit.
USER node

EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0

# Der Healthcheck prüft die Datenbankverbindung mit — /health tut das, ein
# blanker Portcheck täte es nicht (OFFENE-PROBLEME 21).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD curl -fsS -m 4 http://localhost:3000/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "build/index.js"]

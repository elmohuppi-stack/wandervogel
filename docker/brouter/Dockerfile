# BRouter — Routing-Engine für Wandern und Radfahren.
#
# Eigenes Image statt eines fertigen von Docker Hub, weil die verfügbaren
# Images von 2023 stammen, nur amd64 anbieten und weder Profile noch
# Segmente enthalten. Hier wird das offizielle Release entpackt, die
# mitgelieferten Profile bleiben drin, und die Segmente kommen als Volume.
#
# eclipse-temurin ist multi-arch (amd64 + arm64) — läuft also lokal auf
# Apple Silicon und später auf dem Hetzner-Server ohne Emulation.

FROM eclipse-temurin:21-jre

ARG BROUTER_VERSION=1.7.10
ENV BROUTER_HOME=/opt/brouter

RUN set -eux; \
	apt-get update; \
	apt-get install -y --no-install-recommends curl unzip ca-certificates; \
	rm -rf /var/lib/apt/lists/*; \
	mkdir -p "$BROUTER_HOME"; \
	curl -fsSL -o /tmp/brouter.zip \
		"https://github.com/abrensch/brouter/releases/download/v${BROUTER_VERSION}/brouter-${BROUTER_VERSION}.zip"; \
	unzip -q /tmp/brouter.zip -d /tmp; \
	cp "/tmp/brouter-${BROUTER_VERSION}/brouter-${BROUTER_VERSION}-all.jar" "$BROUTER_HOME/brouter.jar"; \
	cp -r "/tmp/brouter-${BROUTER_VERSION}/profiles2" "$BROUTER_HOME/profiles2"; \
	mkdir -p "$BROUTER_HOME/customprofiles" "$BROUTER_HOME/segments4"; \
	rm -rf /tmp/brouter.zip "/tmp/brouter-${BROUTER_VERSION}"

WORKDIR $BROUTER_HOME

# BRouter lädt Segmente bedarfsweise von der Platte — deshalb genügt
# wenig Heap. 1 GB ist reichlich und passt auf den kleinen Server.
# Der Standardwert ist bewusst klein.
#
# Vorher stand hier -Xmx1g mit dem Kommentar, BRouter lade Segmente
# bedarfsweise von der Platte und brauche deshalb wenig Heap — die Zahl
# widersprach also ihrer eigenen Begründung. Auf dem Zielserver (3,7 GB,
# elf Apps) wäre ein Gigabyte mehr als ein Drittel des Verfügbaren.
#
# Das Prod-Compose überschreibt den Wert ohnehin; hier steht er, damit auch
# ein blanker `docker run` nicht danebenliegt.
ENV JAVA_OPTS="-Xmx384m -Xms128m -DmaxRunningTime=300"

EXPOSE 17777

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
	CMD curl -s -o /dev/null -m 4 http://localhost:17777/ || exit 1

# Argumente: <segmentdir> <profiledir> <customprofiledir> <port> <threads>
CMD java $JAVA_OPTS -cp brouter.jar btools.server.RouteServer \
	segments4 profiles2 customprofiles 17777 2

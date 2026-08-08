#!/usr/bin/env bash
#
# Lädt BRouter-Segmentdateien (.rd5) herunter.
#
# Segmente sind 5°×5°-Felder, benannt nach ihrer Südwest-Ecke. Jedes ist
# 170–240 MB groß, weltweit sind es zusammen etwa 7 GB. Für den Anfang
# genügt das Feld, in dem man wandert.
#
# Läuft mit reinem bash und curl — auch auf dem Server, wo es kein pnpm gibt.
#
#   ./scripts/fetch-brouter-segments.sh              # Standard: Deutschland
#   ./scripts/fetch-brouter-segments.sh E5_N45       # nur Pfalz/Südwest
#   ./scripts/fetch-brouter-segments.sh --alps       # Alpenraum dazu
#
# Nachschlagen, welches Feld man braucht: die Ecke ist auf 5 abgerundet.
# Pfälzerwald (7,9° O / 49,2° N) liegt in E5_N45.

set -euo pipefail

BASE_URL="https://brouter.de/brouter/segments4"
DEST="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/data/brouter/segments4"

# Deutschland vollständig abdecken.
GERMANY=(E5_N45 E5_N50 E10_N45 E10_N50)
# Alpen von Frankreich bis Österreich.
ALPS=(E5_N45 E10_N45)

case "${1:-}" in
	--alps)
		SEGMENTS=("${ALPS[@]}")
		;;
	--germany | '')
		SEGMENTS=("${GERMANY[@]}")
		;;
	--help | -h)
		sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
		exit 0
		;;
	*)
		SEGMENTS=("$@")
		;;
esac

mkdir -p "$DEST"

echo "Ziel: $DEST"
echo "Segmente: ${SEGMENTS[*]}"
echo

total_mb=0
for seg in "${SEGMENTS[@]}"; do
	target="$DEST/${seg}.rd5"

	if [[ -f "$target" ]]; then
		size=$(du -m "$target" | cut -f1)
		echo "  ✓ ${seg}.rd5 liegt schon vor (${size} MB) — übersprungen"
		total_mb=$((total_mb + size))
		continue
	fi

	echo "  ↓ ${seg}.rd5 …"
	# Erst in eine temporäre Datei, damit ein Abbruch keine halbe
	# Segmentdatei hinterlässt, die BRouter beim Start verwirrt.
	if curl -fL --progress-bar -o "${target}.part" "${BASE_URL}/${seg}.rd5"; then
		mv "${target}.part" "$target"
		size=$(du -m "$target" | cut -f1)
		total_mb=$((total_mb + size))
		echo "    fertig (${size} MB)"
	else
		rm -f "${target}.part"
		echo "    FEHLGESCHLAGEN — existiert das Feld '${seg}'?" >&2
		echo "    Übersicht: ${BASE_URL}/" >&2
		exit 1
	fi
done

echo
echo "Insgesamt ${total_mb} MB in $DEST"
echo "Neue Segmente greifen erst nach einem Neustart des Routers:"
echo "  make brouter-restart                                        (Entwicklung)"
echo "  docker compose -f docker-compose.prod.yml restart brouter   (Server)"

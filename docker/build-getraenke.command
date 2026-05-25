#!/bin/bash

# ==========================================================
# bwza-getraenke Sandbox — einmaliger Build + Auth-Setup
# ==========================================================
# Dieses Skript bauen wir genau EINMAL aus.
# Es erzeugt das Docker-Image, startet einen Container, in dem
# du dich bei Claude Code einloggst, und committed dann den
# Zustand als 'bwza-getraenke-auth'.
#
# Danach nutzt 'start-getraenke.command' das Auth-Image.
# ==========================================================

set -e

DOCKER_DIR="/Users/laura/claude-sandbox/projects/getraenke/docker"
IMAGE_BASE="bwza-getraenke"
IMAGE_AUTH="bwza-getraenke-auth"
CONTAINER_BUILD="bwza-getraenke-build"

echo ""
echo "================================================="
echo "  bwza-getraenke: Image bauen + Auth einrichten"
echo "================================================="
echo ""

# Docker laufend?
if ! docker info > /dev/null 2>&1; then
    echo "FEHLER: Docker Desktop läuft nicht. Bitte starten und Skript erneut ausführen."
    read -n 1 -s -r -p "Taste drücken zum Beenden..."
    exit 1
fi
echo "OK - Docker läuft"

# Schritt 1: Basis-Image bauen
echo ""
echo "[1/3] Baue Basis-Image '$IMAGE_BASE'..."
docker build -t "$IMAGE_BASE" "$DOCKER_DIR"
echo "OK - Image gebaut"

# Schritt 2: Build-Container starten, du machst Login
echo ""
echo "[2/3] Starte Container zum Einloggen."
echo ""
echo "Im Container öffnet sich gleich eine Bash."
echo "Tippe dort folgendes ein:"
echo ""
echo "  claude"
echo ""
echo "Dann folge dem Login-Prozess (Browser-Link öffnen, Code eingeben)."
echo "Wenn fertig: 'exit' tippen, dann läuft das Skript weiter."
echo ""
read -n 1 -s -r -p "Taste drücken zum Starten..."
echo ""

# Falls ein alter build-Container existiert: entfernen
docker rm -f "$CONTAINER_BUILD" > /dev/null 2>&1 || true

docker run -it --name "$CONTAINER_BUILD" "$IMAGE_BASE" bash

# Schritt 3: Container als Auth-Image committen
echo ""
echo "[3/3] Sichere den eingeloggten Zustand als '$IMAGE_AUTH'..."
docker commit "$CONTAINER_BUILD" "$IMAGE_AUTH"
docker rm "$CONTAINER_BUILD" > /dev/null
echo "OK - Auth-Image fertig"

echo ""
echo "================================================="
echo "  Fertig!"
echo "================================================="
echo ""
echo "Du kannst jetzt 'start-getraenke.command' nutzen."
echo ""
read -n 1 -s -r -p "Taste drücken zum Beenden..."

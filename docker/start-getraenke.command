#!/bin/bash

# ==========================================================
# bwza-getraenke Sandbox starten
# ==========================================================
# Vorbedingung: 'build-getraenke.command' wurde einmal ausgeführt.
# Dieses Skript startet (oder erstellt neu) den Container und
# öffnet Claude Code im Projekt-Workspace.
# ==========================================================

echo ""
echo "================================================="
echo "  bwza-getraenke Sandbox starten"
echo "================================================="
echo ""

CONTAINER="claude-bwza-getraenke"
IMAGE_AUTH="bwza-getraenke-auth"
PROJECT_PATH="/Users/laura/claude-sandbox/projects/getraenke"

echo "[1/3] Prüfe ob Docker läuft..."
if ! docker info > /dev/null 2>&1; then
    echo "FEHLER: Docker Desktop läuft nicht."
    read -n 1 -s -r -p "Taste drücken zum Beenden..."
    exit 1
fi
echo "OK - Docker läuft"

echo "[2/3] Prüfe Auth-Image..."
if ! docker image inspect "$IMAGE_AUTH" > /dev/null 2>&1; then
    echo "FEHLER: Image '$IMAGE_AUTH' nicht gefunden."
    echo "Bitte zuerst 'build-getraenke.command' ausführen."
    read -n 1 -s -r -p "Taste drücken zum Beenden..."
    exit 1
fi
echo "OK - Auth-Image vorhanden"

echo "[3/3] Starte Container..."
echo ""

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}\$"; then
    echo "Bestehender Container wird fortgesetzt."
    echo ""
    docker start -i "$CONTAINER"
else
    echo "Erstelle neuen Container."
    echo ""
    docker run -it \
        --name "$CONTAINER" \
        -p 3000:3000 \
        -p 4000:4000 \
        -v "$PROJECT_PATH:/home/claude/workspace" \
        "$IMAGE_AUTH" \
        claude --dangerously-skip-permissions
fi

echo ""
echo "Sandbox beendet."
read -n 1 -s -r -p "Taste drücken zum Schließen..."

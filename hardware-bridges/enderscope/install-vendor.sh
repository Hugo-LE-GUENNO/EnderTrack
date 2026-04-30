#!/bin/bash
# install-vendor.sh - Télécharge les dépendances dans vendor/
# Exécuter AVANT de partir dans le désert 🏜️
#
# Usage: ./install-vendor.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENDOR_DIR="$SCRIPT_DIR/vendor"
REQ_FILE="$SCRIPT_DIR/requirements.txt"

echo "📦 Installation des dépendances dans vendor/..."

# Nettoyer
rm -rf "$VENDOR_DIR"
mkdir -p "$VENDOR_DIR"

# Télécharger dans vendor/
pip install --target="$VENDOR_DIR" -r "$REQ_FILE" --no-deps 2>/dev/null || \
pip3 install --target="$VENDOR_DIR" -r "$REQ_FILE" --no-deps

# Aussi installer les sous-dépendances de Flask
pip install --target="$VENDOR_DIR" werkzeug jinja2 click itsdangerous markupsafe blinker 2>/dev/null || \
pip3 install --target="$VENDOR_DIR" werkzeug jinja2 click itsdangerous markupsafe blinker

echo ""
echo "✅ Dépendances installées dans vendor/"
echo "📁 Taille: $(du -sh "$VENDOR_DIR" | cut -f1)"
echo ""
echo "🏜️  Prêt pour le mode offline !"

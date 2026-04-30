#!/bin/bash
# EnderTrack - Script de démarrage simple

echo "🚀 Démarrage d'EnderTrack..."
echo ""
echo "📂 Serveur web sur http://localhost:8000"
echo "🛑 Ctrl+C pour arrêter"
echo ""

python3 -m http.server 8000

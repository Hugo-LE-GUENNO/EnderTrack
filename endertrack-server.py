#!/usr/bin/env python3
"""
endertrack-server.py — Point d'entrée du serveur EnderTrack.
Assemble les modules : basic_functions, stage_connection, plugin_router, network_config.

Usage:
    python endertrack-server.py
    ENDERTRACK_PORT=8080 python endertrack-server.py
    ENDERTRACK_HOST=0.0.0.0 python endertrack-server.py   # accès LAN
"""

import sys
import os

# Ajouter le dossier parent au path pour les imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# Aussi le dossier projet pour que les plugins trouvent leurs dépendances
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Support vendored dependencies (Flask inclus, zéro install)
vendor_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vendor')
if os.path.isdir(vendor_dir):
    sys.path.insert(0, os.path.abspath(vendor_dir))
else:
    # Fallback: hardware-bridges vendor
    vendor_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hardware-bridges', 'enderscope', 'vendor')
    if os.path.isdir(vendor_dir):
        sys.path.insert(0, os.path.abspath(vendor_dir))

from flask import Flask, send_from_directory
from flask_cors import CORS

# ─── Création de l'app Flask ─────────────────────────────────────────────────

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder=PROJECT_ROOT, static_url_path='')
CORS(app)

@app.route('/')
def serve_index():
    return send_from_directory(PROJECT_ROOT, 'index.html')

# ─── Banner ──────────────────────────────────────────────────────────────────

print()
print("╔══════════════════════════════════════════╗")
print("║     🔬 EnderTrack Server v2.0            ║")
print("╚══════════════════════════════════════════╝")
print()

# ─── Enregistrement des modules ──────────────────────────────────────────────

# 1. Fonctions de base (filesystem, browse, paths)
from server import basic_functions
basic_functions.register_routes(app)

# 2. Connexion stage (série, G-code, mouvement)
from server import stage_connection
stage_connection.register_routes(app)

# 3. Routeur de plugins (chargement dynamique Python)
from server import plugin_router
plugin_router.register_routes(app)

# 4. Configuration réseau
from server import network_config

# ─── Démarrage ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print()
    network_config.print_startup_info()
    print()
    app.run(host=network_config.HOST, port=network_config.PORT, debug=False, threaded=True)

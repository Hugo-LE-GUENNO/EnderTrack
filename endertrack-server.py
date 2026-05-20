#!/usr/bin/env python3
"""
endertrack-server.py — Point d'entrée du serveur EnderTrack.
Assemble les modules : basic_functions, stage_connection, plugin_router, network_config.

Usage:
    python3 endertrack-server.py
    python3 endertrack-server.py --port 8080
    python3 endertrack-server.py --lan              # accès réseau local
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

@app.after_request
def _no_cache(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return response

@app.route('/')
def serve_index():
    return send_from_directory(PROJECT_ROOT, 'index.html')

@app.route('/api/version')
def get_version():
    return {'version': VERSION}

@app.route('/api/clients')
def get_clients():
    return {'clients': sorted(_known_clients), 'count': len(_known_clients)}

# ─── Version ─────────────────────────────────────────────────────────────────

import json as _json
_pkg = os.path.join(PROJECT_ROOT, 'package.json')
try:
    with open(_pkg) as _f:
        _pkgdata = _json.load(_f)
        VERSION = _pkgdata['version']
        EDITION = _pkgdata.get('edition', '')
except: VERSION = '?'; EDITION = ''

# ─── Enregistrement des modules ──────────────────────────────────────────────

# Track connected devices
_known_clients = set()

@app.before_request
def _track_clients():
    from flask import request
    ip = request.remote_addr
    if ip and ip not in _known_clients and ip != '127.0.0.1':
        _known_clients.add(ip)
        print(f'  \U0001f4f1 Nouvel appareil: {ip}')

# 1. Fonctions de base (filesystem, browse, paths)
from server import basic_functions
basic_functions.register_routes(app)

# 2. Connexion stage (série, G-code, mouvement)
from server import stage_connection
stage_connection.register_routes(app)

# 3. Routeur de plugins (chargement dynamique Python)
from server import plugin_router
plugin_router.register_routes(app)

# 4. State storage + activity log
from server import state_store
state_store.register_routes(app)

# 5. Sync store (overlays, lists — shared between clients)
from server import sync_store
sync_store.register_routes(app)

from server import stack_handler
stack_handler.register_routes(app)

from server import ome_metadata
ome_metadata.register_routes(app)

# 5. Real-time event stream (SSE)
from server import event_stream
event_stream.register_routes(app)

# 6. Configuration réseau
from server import network_config

# ─── Démarrage ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print()
    edition_str = f" — {EDITION}" if EDITION else ""
    print(f"  🔬 Bienvenue sur EnderTrack v{VERSION}{edition_str}")
    print()
    local_url = f"http://127.0.0.1:{network_config.PORT}"
    print(f"  🌐 Local: \033]8;;{local_url}\033\\{local_url}\033]8;;\033\\")
    if network_config.HOST == '0.0.0.0':
        lan_url = f"http://{network_config.get_local_ip()}:{network_config.PORT}"
        print(f"  🌐 LAN:   \033]8;;{lan_url}\033\\{lan_url}\033]8;;\033\\")
    elif network_config.HOST == '127.0.0.1':
        print(f"  💡 Accès réseau ? → python3 endertrack-server.py --lan")
    print()
    print(f"  📖 https://github.com/Hugo-LE-GUENNO/EnderTrack")
    print()
    import logging
    logging.getLogger('werkzeug').setLevel(logging.ERROR)
    try:
        import flask.cli
        flask.cli.show_server_banner = lambda *a, **k: None
    except: pass
    app.run(host=network_config.HOST, port=network_config.PORT, debug=False, threaded=True)

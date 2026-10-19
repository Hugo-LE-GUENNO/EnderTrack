#!/usr/bin/env python3
"""
endertrack-server.py — EnderTrack server entry point.

Usage:
    python3 endertrack-server.py
    python3 endertrack-server.py --port 8080
    python3 endertrack-server.py --lan
"""

import sys
import os

# Suppress libcamera IPA noise (embedded buffer parsing errors on IMX477 at startup)
os.environ.setdefault('LIBCAMERA_LOG_LEVELS', 'IPARPI:5')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

vendor_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vendor')
if os.path.isdir(vendor_dir):
    sys.path.insert(0, os.path.abspath(vendor_dir))
else:
    vendor_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hardware-bridges', 'enderscope', 'vendor')
    if os.path.isdir(vendor_dir):
        sys.path.insert(0, os.path.abspath(vendor_dir))

from flask import Flask, send_from_directory
from flask_cors import CORS

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

# Version
import json as _json
_pkg = os.path.join(PROJECT_ROOT, 'package.json')
try:
    with open(_pkg) as _f:
        _pkgdata = _json.load(_f)
        VERSION = _pkgdata['version']
        EDITION = _pkgdata.get('edition', '')
except: VERSION = '?'; EDITION = ''

_known_clients = set()

@app.before_request
def _track_clients():
    from flask import request
    ip = request.remote_addr
    if ip and ip not in _known_clients and ip != '127.0.0.1':
        _known_clients.add(ip)
        print(f'  New device: {ip}')

if __name__ == '__main__':
    from server import network_config

    # Print header first
    edition_str = f" — {EDITION}" if EDITION else ""
    print(f"\n  EnderTrack v{VERSION}{edition_str}")
    local_url = f"http://127.0.0.1:{network_config.PORT}"
    print(f"  {local_url}")
    if network_config.HOST == '0.0.0.0':
        lan_url = f"http://{network_config.get_local_ip()}:{network_config.PORT}"
        print(f"  {lan_url}")
    else:
        print(f"  LAN access? -> python3 endertrack-server.py --lan")
    print()

    # Register all modules
    from server import basic_functions
    basic_functions.register_routes(app)

    from server import stage_connection
    stage_connection.register_routes(app)

    from server import plugin_router
    plugin_router.register_routes(app)

    from server import plugin_engine
    plugin_engine.register_routes(app)

    from server import state_store
    state_store.register_routes(app)

    from server import sync_store
    sync_store.register_routes(app)

    from server import stack_handler
    stack_handler.register_routes(app)

    from server import ome_metadata
    ome_metadata.register_routes(app)

    try:
        from server import picamera_handler
        picamera_handler.register_routes(app)
    except Exception:
        pass

    try:
        from server import pilight_handler
        pilight_handler.register_routes(app)
    except Exception:
        pass

    try:
        from server import arduino_light_handler
        arduino_light_handler.register_routes(app)
    except Exception:
        pass

    from server import event_stream
    event_stream.register_routes(app)

    # Restaurer les plugins Python apres tous les register_routes
    plugin_engine.restore_active()

    import logging
    logging.getLogger('werkzeug').setLevel(logging.ERROR)
    try:
        import flask.cli
        flask.cli.show_server_banner = lambda *a, **k: None
    except: pass

    app.run(host=network_config.HOST, port=network_config.PORT, debug=False, threaded=True)

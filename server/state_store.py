"""
state_store.py — Server-side state storage + activity log.
Persists state to data/state.json, logs actions with client IP.
"""

import os
import json
import time

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
STATE_FILE = os.path.join(DATA_DIR, 'state.json')
LOG_FILE = os.path.join(DATA_DIR, 'activity.log')


def _ensure_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def load_state():
    _ensure_dir()
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


_state_hash = ''

def get_state_hash():
    global _state_hash
    return _state_hash

def save_state(state):
    global _state_hash
    _ensure_dir()
    raw = json.dumps(state, sort_keys=True)
    import hashlib
    _state_hash = hashlib.md5(raw.encode()).hexdigest()[:8]
    with open(STATE_FILE, 'w') as f:
        f.write(json.dumps(state, indent=2))


def log_activity(ip, action, details=None):
    _ensure_dir()
    ts = time.strftime('%H:%M:%S')
    msg = f"  [{ts}] {ip} — {action}"
    if details:
        msg += f" ({details})"
    print(msg)
    try:
        with open(LOG_FILE, 'a') as f:
            f.write(msg.strip() + '\n')
    except Exception:
        pass


def register_routes(app):
    from flask import request, jsonify

    @app.route('/api/state', methods=['GET'])
    def _get_state():
        return jsonify(load_state())

    @app.route('/api/state/hash', methods=['GET'])
    def _get_hash():
        return jsonify({'hash': get_state_hash()})

    @app.route('/api/state', methods=['POST'])
    def _save_state():
        data = request.get_json() or {}
        save_state(data)
        return jsonify({'success': True})

    @app.route('/api/state/patch', methods=['POST'])
    def _patch_state():
        """Merge partial update into existing state."""
        patch = request.get_json() or {}
        state = load_state()
        state.update(patch)
        save_state(state)
        return jsonify({'success': True})

    @app.route('/api/log', methods=['POST'])
    def _log():
        """Frontend sends activity logs."""
        data = request.get_json() or {}
        action = data.get('action', '?')
        details = data.get('details')
        ip = request.remote_addr or '?'
        log_activity(ip, action, details)
        return jsonify({'success': True})

    @app.route('/api/log/history', methods=['GET'])
    def _log_history():
        _ensure_dir()
        if os.path.exists(LOG_FILE):
            with open(LOG_FILE, 'r') as f:
                lines = f.readlines()[-100:]  # Last 100 entries
            return jsonify({'log': [l.strip() for l in lines]})
        return jsonify({'log': []})

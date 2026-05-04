"""
sync_store.py — Server-side storage for shared data (overlays, lists).
Stores JSON files in data/ folder. Broadcasts changes via SSE.
"""

import os
import json

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')


def _ensure_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def _read(name):
    path = os.path.join(DATA_DIR, f'{name}.json')
    if os.path.isfile(path):
        with open(path, 'r') as f:
            return json.load(f)
    return None


def _write(name, data):
    _ensure_dir()
    path = os.path.join(DATA_DIR, f'{name}.json')
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)


def register_routes(app):
    from flask import request, jsonify

    try:
        from server.event_stream import bus
    except ImportError:
        bus = None

    def _broadcast(event_type, data):
        if bus:
            bus.publish(event_type, data)

    # --- Overlays ---

    @app.route('/api/sync/overlays', methods=['GET'])
    def _get_overlays():
        data = _read('overlays')
        n = len(data.get('groups', [])) if data else 0
        print(f"  \U0001f4e5 sync/overlays GET -> {n} group(s)")
        return jsonify(data or {'groups': []})

    @app.route('/api/sync/overlays', methods=['POST'])
    def _set_overlays():
        data = request.get_json()
        groups = data.get('groups', []) if data else []
        total = sum(len(g.get('overlays', [])) for g in groups)
        # Don't overwrite server data with empty data
        if not groups or total == 0:
            existing = _read('overlays')
            if existing and existing.get('groups'):
                print(f"  \u26a0\ufe0f sync/overlays POST ignored (empty data, server has data)")
                return jsonify({'success': True, 'skipped': True})
        _write('overlays', data)
        _broadcast('sync:overlays', data)
        print(f"  \U0001f4e4 sync/overlays POST -> {len(groups)} group(s), {total} overlay(s)")
        return jsonify({'success': True})

    # --- Lists ---

    @app.route('/api/sync/lists', methods=['GET'])
    def _get_lists():
        data = _read('lists')
        n = len(data.get('groups', [])) if data else 0
        print(f"  \U0001f4e5 sync/lists GET -> {n} group(s)")
        return jsonify(data or {'groups': []})

    @app.route('/api/sync/lists', methods=['POST'])
    def _set_lists():
        data = request.get_json()
        groups = data.get('groups', []) if data else []
        total = sum(len(g.get('positions', [])) for g in groups)
        # Don't overwrite server data with empty data
        if not groups or total == 0:
            existing = _read('lists')
            if existing and existing.get('groups'):
                ex_total = sum(len(g.get('positions', [])) for g in existing.get('groups', []))
                if ex_total > 0:
                    print(f"  \u26a0\ufe0f sync/lists POST ignored (empty data, server has {ex_total} positions)")
                    return jsonify({'success': True, 'skipped': True})
        _write('lists', data)
        _broadcast('sync:lists', data)
        print(f"  \U0001f4e4 sync/lists POST -> {len(groups)} group(s), {total} position(s)")
        return jsonify({'success': True})

    # --- Config (plateau dimensions, bounds, orientation) ---

    @app.route('/api/sync/config', methods=['GET'])
    def _get_config():
        data = _read('config')
        return jsonify(data or {})

    @app.route('/api/sync/config', methods=['POST'])
    def _set_config():
        data = request.get_json()
        # Merge with existing (don't overwrite everything)
        existing = _read('config') or {}
        existing.update(data)
        _write('config', existing)
        _broadcast('sync:config', existing)
        print(f"  \U0001f4e4 sync/config POST -> {list(data.keys())}")
        return jsonify({'success': True})

    # --- Tracks ---

    @app.route('/api/sync/tracks', methods=['GET'])
    def _get_tracks():
        data = _read('tracks')
        return jsonify(data or {'positionHistory': [], 'continuousTrack': []})

    @app.route('/api/sync/tracks', methods=['POST'])
    def _set_tracks():
        data = request.get_json()
        _write('tracks', data)
        _broadcast('sync:tracks', data)
        return jsonify({'success': True})

    @app.route('/api/sync/tracks', methods=['DELETE'])
    def _clear_tracks():
        _write('tracks', {'positionHistory': [], 'continuousTrack': []})
        _broadcast('sync:tracks', {'positionHistory': [], 'continuousTrack': []})
        return jsonify({'success': True})

    # --- Export all data ---

    @app.route('/api/sync/export', methods=['GET'])
    def _export_all():
        result = {}
        for name in ['overlays', 'lists']:
            data = _read(name)
            if data:
                result[name] = data
        return jsonify(result)

    print("  \U0001f4be sync_store: routes /api/sync/overlays, /api/sync/lists, /api/sync/export")

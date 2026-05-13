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
        return jsonify(data or {'groups': []})

    @app.route('/api/sync/overlays', methods=['POST'])
    def _set_overlays():
        data = request.get_json()
        groups = data.get('groups', []) if data else []
        # Don't overwrite server data with completely empty state (no groups)
        if not groups:
            existing = _read('overlays')
            if existing and existing.get('groups'):

                return jsonify({'success': True, 'skipped': True})
        # Diff logging
        old = _read('overlays') or {'groups': []}
        old_counts = {g.get('name', g.get('id', '?')): len(g.get('overlays', [])) for g in old.get('groups', [])}
        new_counts = {g.get('name', g.get('id', '?')): len(g.get('overlays', [])) for g in groups}
        for name, cnt in new_counts.items():
            old_cnt = old_counts.get(name, 0)
            if name not in old_counts:
                print(f"  + Overlay [{name}] ({cnt} img)")
            elif cnt > old_cnt:
                print(f"  + Overlay [{name}] +{cnt - old_cnt} img ({cnt})")
            elif cnt < old_cnt:
                print(f"  - Overlay [{name}] -{old_cnt - cnt} img ({cnt})")
        for name in old_counts:
            if name not in new_counts:
                print(f"  - Overlay [{name}] supprimé")
        _write('overlays', data)
        _broadcast('sync:overlays', data)
        return jsonify({'success': True})

    # --- Lists ---

    @app.route('/api/sync/lists', methods=['GET'])
    def _get_lists():
        data = _read('lists')
        return jsonify(data or {'groups': []})

    @app.route('/api/sync/lists', methods=['POST'])
    def _set_lists():
        data = request.get_json()
        groups = data.get('groups', []) if data else []
        # Don't overwrite server data with completely empty state (no groups)
        if not groups:
            existing = _read('lists')
            if existing and existing.get('groups'):

                return jsonify({'success': True, 'skipped': True})
        # Diff logging
        old = _read('lists') or {'groups': []}
        old_counts = {g.get('name', g.get('id', '?')): len(g.get('positions', [])) for g in old.get('groups', [])}
        new_counts = {g.get('name', g.get('id', '?')): len(g.get('positions', [])) for g in groups}
        for name, cnt in new_counts.items():
            old_cnt = old_counts.get(name, 0)
            if name not in old_counts:
                print(f"  + Liste [{name}] ({cnt} pts)")
            elif cnt > old_cnt:
                print(f"  + Liste [{name}] +{cnt - old_cnt} pts ({cnt})")
            elif cnt < old_cnt:
                print(f"  - Liste [{name}] -{old_cnt - cnt} pts ({cnt})")
        for name in old_counts:
            if name not in new_counts:
                print(f"  - Liste [{name}] supprimée")
        _write('lists', data)
        _broadcast('sync:lists', data)
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


    # --- Capture save ---

    @app.route('/api/capture/save', methods=['POST'])
    def _save_capture():
        import base64, os
        data = request.get_json()
        if not data or not data.get('frame') or not data.get('path'):
            return jsonify({'success': False, 'error': 'Missing frame or path'}), 400
        path = data['path']
        # Ensure directory exists
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        # Decode base64 frame and save
        try:
            frame_data = base64.b64decode(data['frame'])
            with open(path, 'wb') as f:
                f.write(frame_data)
            print(f"  📷 Capture sauvegardée: {path}")
            return jsonify({'success': True, 'path': path})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    # --- Scenarios ---

    @app.route('/api/sync/scenarios', methods=['GET'])
    def _get_scenarios():
        data = _read('scenarios')
        return jsonify(data or {})

    @app.route('/api/sync/scenarios', methods=['POST'])
    def _set_scenarios():
        data = request.get_json()
        _write('scenarios', data)
        return jsonify({'success': True})

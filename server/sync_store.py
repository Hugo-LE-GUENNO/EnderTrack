"""
sync_store.py — Server-side storage for shared data (overlays, lists).
Stores JSON files in data/ folder. Broadcasts changes via SSE.
"""

import os
import json
import threading

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
_write_lock = threading.Lock()


def _ensure_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def _read(name):
    path = os.path.join(DATA_DIR, f'{name}.json')
    if os.path.isfile(path):
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, ValueError):
            # Corrupted file — remove it
            os.remove(path)
            return None
    return None


def _write(name, data):
    _ensure_dir()
    path = os.path.join(DATA_DIR, f'{name}.json')
    with _write_lock:
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
                print(f"  - Overlay [{name}] deleted")
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
                print(f"  + List [{name}] ({cnt} pts)")
            elif cnt > old_cnt:
                print(f"  + List [{name}] +{cnt - old_cnt} pts ({cnt})")
            elif cnt < old_cnt:
                print(f"  - List [{name}] -{old_cnt - cnt} pts ({cnt})")
        for name in old_counts:
            if name not in new_counts:
                print(f"  - List [{name}] deletede")
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
        from_id = data.pop('_from', None)
        existing = _read('config') or {}
        existing.update(data)
        _write('config', existing)
        broadcast_data = {**existing, '_from': from_id} if from_id else existing
        _broadcast('sync:config', broadcast_data)
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

    # --- Lists atomic operations ---

    @app.route('/api/lists/positions/add', methods=['POST'])
    def _lists_add_position():
        data = request.get_json() or {}
        x, y, z = float(data.get('x', 0)), float(data.get('y', 0)), float(data.get('z', 0))
        name = data.get('name', '')
        group_name = data.get('list')  # optional: target list by name
        lists = _read('lists') or {'groups': [], 'activeGroupId': 1, '_nextGroupId': 2}
        groups = lists.get('groups', [])
        if not groups:
            return jsonify({'success': False, 'error': 'No lists found'}), 404
        if group_name:
            g = next((g for g in groups if g['name'] == group_name), None)
        else:
            active_id = lists.get('activeGroupId')
            g = next((g for g in groups if g['id'] == active_id), groups[0])
        if not g:
            return jsonify({'success': False, 'error': f'List "{group_name}" not found'}), 404
        pos = {'x': round(x, 3), 'y': round(y, 3), 'z': round(z, 3), 'name': name}
        g.setdefault('positions', []).append(pos)
        _write('lists', lists)
        _broadcast('sync:lists', lists)
        print(f"  + List [{g['name']}] +1 pt ({len(g['positions'])})")
        return jsonify({'success': True, 'position': pos, 'list': g['name'], 'count': len(g['positions'])})

    @app.route('/api/lists/positions/remove', methods=['POST'])
    def _lists_remove_position():
        data = request.get_json() or {}
        idx = data.get('index')
        group_name = data.get('list')
        lists = _read('lists') or {'groups': []}
        groups = lists.get('groups', [])
        if group_name:
            g = next((g for g in groups if g['name'] == group_name), None)
        else:
            active_id = lists.get('activeGroupId')
            g = next((g for g in groups if g['id'] == active_id), groups[0] if groups else None)
        if not g:
            return jsonify({'success': False, 'error': 'List not found'}), 404
        positions = g.get('positions', [])
        if idx is None or idx < 0 or idx >= len(positions):
            return jsonify({'success': False, 'error': f'Invalid index {idx}'}), 400
        removed = positions.pop(idx)
        _write('lists', lists)
        _broadcast('sync:lists', lists)
        return jsonify({'success': True, 'removed': removed})

    @app.route('/api/lists/positions/clear', methods=['POST'])
    def _lists_clear_positions():
        data = request.get_json() or {}
        group_name = data.get('list')
        lists = _read('lists') or {'groups': []}
        groups = lists.get('groups', [])
        if group_name:
            g = next((g for g in groups if g['name'] == group_name), None)
        else:
            active_id = lists.get('activeGroupId')
            g = next((g for g in groups if g['id'] == active_id), groups[0] if groups else None)
        if not g:
            return jsonify({'success': False, 'error': 'List not found'}), 404
        count = len(g.get('positions', []))
        g['positions'] = []
        _write('lists', lists)
        _broadcast('sync:lists', lists)
        print(f"  - List [{g['name']}] cleared ({count} pts)")
        return jsonify({'success': True, 'cleared': count})

    @app.route('/api/lists/groups/add', methods=['POST'])
    def _lists_add_group():
        data = request.get_json() or {}
        name = data.get('name', 'New List')
        color = data.get('color', '#4a90e2')
        lists = _read('lists') or {'groups': [], 'activeGroupId': None, '_nextGroupId': 1}
        next_id = lists.get('_nextGroupId', 1)
        g = {'id': next_id, 'name': name, 'visible': True, 'pinned': bool(data.get('pinned', False)), 'color': color, 'positions': []}
        lists.setdefault('groups', []).append(g)
        lists['_nextGroupId'] = next_id + 1
        lists['activeGroupId'] = next_id
        _write('lists', lists)
        _broadcast('sync:lists', lists)
        print(f"  + List [{name}] created")
        return jsonify({'success': True, 'id': next_id, 'name': name})

    @app.route('/api/lists/groups/rename', methods=['POST'])
    def _lists_rename_group():
        data = request.get_json() or {}
        group_name = data.get('list') or data.get('name')
        new_name = data.get('new_name')
        if not group_name or not new_name:
            return jsonify({'success': False, 'error': 'list + new_name required'}), 400
        lists = _read('lists') or {'groups': []}
        g = next((g for g in lists.get('groups', []) if g['name'] == group_name), None)
        if not g:
            return jsonify({'success': False, 'error': f'List "{group_name}" not found'}), 404
        g['name'] = new_name
        _write('lists', lists)
        _broadcast('sync:lists', lists)
        return jsonify({'success': True, 'old_name': group_name, 'new_name': new_name})

    @app.route('/api/lists/groups/delete', methods=['POST'])
    def _lists_delete_group():
        data = request.get_json() or {}
        group_name = data.get('list') or data.get('name')
        if not group_name:
            return jsonify({'success': False, 'error': 'list name required'}), 400
        lists = _read('lists') or {'groups': []}
        before = len(lists.get('groups', []))
        lists['groups'] = [g for g in lists.get('groups', []) if g['name'] != group_name]
        if len(lists['groups']) == before:
            return jsonify({'success': True, 'deleted': False})  # idempotent
        if lists['groups']:
            lists['activeGroupId'] = lists['groups'][0]['id']
        _write('lists', lists)
        _broadcast('sync:lists', lists)
        print(f"  - List [{group_name}] deleted")
        return jsonify({'success': True, 'deleted': True})

    @app.route('/api/lists', methods=['GET'])
    def _lists_get_all():
        lists = _read('lists') or {'groups': []}
        return jsonify(lists)

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
            print(f"   Capture saved: {path}")
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

    @app.route('/api/live/settings', methods=['GET'])
    def _live_settings_get():
        """Load live renderer display settings."""
        import json
        settings_file = os.path.join(os.getcwd(), '.live_settings.json')
        try:
            if os.path.isfile(settings_file):
                with open(settings_file, 'r') as f:
                    return jsonify(json.load(f))
        except:
            pass
        return jsonify({})

    @app.route('/api/live/settings', methods=['POST'])
    def _live_settings_save():
        """Save live renderer display settings."""
        import json
        data = request.get_json()
        if data is None:
            return jsonify({'error': 'No data'}), 400
        settings_file = os.path.join(os.getcwd(), '.live_settings.json')
        try:
            with open(settings_file, 'w') as f:
                json.dump(data, f, indent=2)
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'error': str(e)}), 500



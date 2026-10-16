"""
plugin_engine.py — Système de plugins Python EnderTrack.

Un plugin = un seul fichier plugin.py dans plugins/<id>/
Le serveur scanne, active, génère les routes et publie l'UI via SSE.
"""

import os
import json
import importlib.util
import traceback
import threading

from server import basic_functions

# { plugin_id: { 'module': mod, 'ctx': ctx } }
_active_plugins = {}


def _persistence_path():
    return os.path.join(basic_functions.PROJECT_ROOT, 'data', 'active_plugins.json')

def _save_active():
    try:
        with open(_persistence_path(), 'w') as f:
            json.dump(list(_active_plugins.keys()), f)
    except Exception:
        pass

def _load_active():
    try:
        with open(_persistence_path()) as f:
            return json.load(f)
    except Exception:
        return []


# ─── Context ──────────────────────────────────────────────────────────────────

class PluginContext:
    """Objet injecté dans chaque plugin — accès aux périphériques EnderTrack."""

    def __init__(self, plugin_id):
        self.plugin_id = plugin_id
        self.devices = {}  # périphériques custom enregistrés par le plugin

    @property
    def stage(self):
        from server import stage_connection
        return stage_connection.stage  # None si non connecté

    @property
    def cam(self):
        """Retourne le handler picamera2 si disponible."""
        try:
            from server import picamera_handler
            return picamera_handler
        except:
            return None

    @property
    def light(self):
        import urllib.request, json

        class _Light:
            def _post(self, endpoint, body={}):
                try:
                    req = urllib.request.Request(
                        'http://localhost:5000' + endpoint,
                        data=json.dumps(body).encode(),
                        headers={'Content-Type': 'application/json'},
                        method='POST'
                    )
                    with urllib.request.urlopen(req, timeout=5) as r:
                        return json.loads(r.read())
                except Exception as e:
                    return {'error': str(e)}

            def _get(self, endpoint):
                try:
                    with urllib.request.urlopen('http://localhost:5000' + endpoint, timeout=5) as r:
                        return json.loads(r.read())
                except Exception as e:
                    return {'error': str(e)}

            def status(self):
                return self._get('/api/light/status')

            def on(self, r=255, g=255, b=255, intensity=1.0, id=None):
                body = {'r': r, 'g': g, 'b': b, 'intensity': intensity}
                if id is not None: body['id'] = id
                return self._post('/api/light/on', body)

            def off(self, id=None):
                body = {'id': id} if id is not None else {}
                return self._post('/api/light/off', body)

            def color(self, r, g, b, id=None):
                body = {'r': r, 'g': g, 'b': b}
                if id is not None: body['id'] = id
                return self._post('/api/light/color', body)

            def intensity(self, value, id=None):
                body = {'intensity': value}
                if id is not None: body['id'] = id
                return self._post('/api/light/intensity', body)

        return _Light()

    @property
    def bus(self):
        from server.event_stream import bus
        return bus

    @property
    def lists(self):
        from server.sync_store import _read, _write
        from server.event_stream import bus as _bus

        class _Lists:
            def _post(self, endpoint, body):
                import urllib.request, json
                req = urllib.request.Request(
                    'http://localhost:5000' + endpoint,
                    data=json.dumps(body).encode(),
                    headers={'Content-Type': 'application/json'},
                    method='POST'
                )
                with urllib.request.urlopen(req, timeout=5) as r:
                    return json.loads(r.read())

            def add(self, x, y, z, name='', list=None):
                body = {'x': x, 'y': y, 'z': z, 'name': name}
                if list: body['list'] = list
                return self._post('/api/lists/positions/add', body)

            def remove(self, index, list=None):
                body = {'index': index}
                if list: body['list'] = list
                return self._post('/api/lists/positions/remove', body)

            def clear(self, list=None):
                return self._post('/api/lists/positions/clear', {'list': list} if list else {})

            def new_list(self, name, color='#4a90e2', pinned=False):
                return self._post('/api/lists/groups/add', {'name': name, 'color': color, 'pinned': pinned})

            def rename_list(self, name, new_name):
                return self._post('/api/lists/groups/rename', {'list': name, 'new_name': new_name})

            def delete_list(self, name):
                return self._post('/api/lists/groups/delete', {'list': name})

            @property
            def all(self):
                data = _read('lists') or {}
                return data.get('groups', [])

            def get(self, name):
                groups = self.all
                g = next((g for g in groups if g['name'] == name), None)
                return g['positions'] if g else []

        return _Lists()

    @property
    def config(self):
        """Merge data/config.json + state.json + limites firmware stage."""
        try:
            from server.state_store import load_state
            from server.sync_store import _read
            cfg = _read('config') or {}
            state = load_state()
            cfg['position'] = state.get('position', {'x': 0, 'y': 0, 'z': 0})
            # Inject live stage limits if connected
            try:
                from server import stage_connection
                s = stage_connection.stage
                if s and s.limits:
                    l = s.limits
                    cfg['coordinateBounds'] = {
                        'x': {'min': l['x'][0], 'max': l['x'][1]},
                        'y': {'min': l['y'][0], 'max': l['y'][1]},
                        'z': {'min': l['z'][0], 'max': l['z'][1]},
                    }
                    cfg['plateauDimensions'] = {
                        'x': l['x'][1] - l['x'][0],
                        'y': l['y'][1] - l['y'][0],
                        'z': l['z'][1] - l['z'][0],
                    }
            except Exception:
                pass
            return cfg
        except:
            return {}

    def register_device(self, name, driver):
        """Enregistre un périphérique custom (ex: pousse-seringue Arduino)."""
        self.devices[name] = driver
        print(f"  [PLUGIN] [{self.plugin_id}] device registered: {name}")

    def log(self, message, level='info'):
        """Log visible dans la console serveur + publié via SSE."""
        prefix = {'info': '[INFO]', 'ok': '[OK]', 'error': '[ERR]', 'warn': '[WARN]'}.get(level, '[INFO]')
        print(f"  {prefix} [{self.plugin_id}] {message}")
        self.bus.publish('plugin:log', {
            'plugin_id': self.plugin_id,
            'message': message,
            'level': level
        })

    def update_output(self, output_id, value):
        """Met à jour un output dans l'UI du plugin."""
        self.bus.publish('plugin:output', {
            'plugin_id': self.plugin_id,
            'id': output_id,
            'value': value
        })

    def append_table_row(self, output_id, row):
        """Ajoute une ligne dans un output de type table. row = liste de valeurs."""
        self.bus.publish('plugin:output', {
            'plugin_id': self.plugin_id,
            'id': output_id,
            'value': row
        })


# ─── Scan & Load ──────────────────────────────────────────────────────────────

def get_plugins_dir():
    return os.path.join(basic_functions.PROJECT_ROOT, 'plugins')


def _find_plugin_py(plugin_id):
    """Trouve le fichier .py d'un plugin — seul .py du dossier, ou plugin.py en fallback."""
    folder = os.path.join(get_plugins_dir(), plugin_id)
    py_files = [f for f in os.listdir(folder) if f.endswith('.py')] if os.path.isdir(folder) else []
    if not py_files:
        return None
    if len(py_files) == 1:
        return os.path.join(folder, py_files[0])
    if 'plugin.py' in py_files:
        return os.path.join(folder, 'plugin.py')
    return None


def scan_plugins():
    """Retourne la liste des plugins Python disponibles (ont un .py dans leur dossier)."""
    plugins_dir = get_plugins_dir()
    result = []
    if not os.path.isdir(plugins_dir):
        return result
    for name in sorted(os.listdir(plugins_dir)):
        if _find_plugin_py(name):
            result.append(name)
    return result


def _load_module(plugin_id):
    py = _find_plugin_py(plugin_id)
    if not py:
        raise FileNotFoundError(f"No .py found in plugins/{plugin_id}/")
    spec = importlib.util.spec_from_file_location(f"pyplugin_{plugin_id}", py)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ─── Activation ───────────────────────────────────────────────────────────────

def activate(plugin_id):
    if plugin_id in _active_plugins:
        return True  # déjà actif

    try:
        mod = _load_module(plugin_id)
        ctx = PluginContext(plugin_id)

        # Appel on_load si défini
        if hasattr(mod, 'on_load'):
            mod.on_load(ctx)

        _active_plugins[plugin_id] = {'module': mod, 'ctx': ctx}
        _save_active()
        print(f"  [PLUGIN] Python plugin activated: {plugin_id}")

        # Publier l'UI via SSE
        ui = _build_ui(plugin_id, mod)
        from server.event_stream import bus
        bus.publish('plugin:ui', ui)

        # Publier les scenario actions si définies
        if hasattr(mod, 'SCENARIO_ACTIONS'):
            bus.publish('plugin:scenario_actions', {
                'plugin_id': plugin_id,
                'actions': mod.SCENARIO_ACTIONS
            })

        return True
    except Exception as e:
        print(f"  [ERR] Plugin activation failed {plugin_id}: {e}")
        traceback.print_exc()
        return False


def deactivate(plugin_id):
    entry = _active_plugins.pop(plugin_id, None)
    if not entry:
        return
    mod, ctx = entry['module'], entry['ctx']
    if hasattr(mod, 'on_unload'):
        try:
            mod.on_unload(ctx)
        except Exception as e:
            print(f"  [WARN] on_unload error [{plugin_id}]: {e}")
    # Nettoyer les devices custom
    for name, dev in ctx.devices.items():
        if hasattr(dev, 'close'):
            try:
                dev.close()
            except:
                pass
    _save_active()
    from server.event_stream import bus
    bus.publish('plugin:removed', {'plugin_id': plugin_id})
    print(f"  [OFF] Python plugin deactivated: {plugin_id}")


# ─── UI Builder ───────────────────────────────────────────────────────────────

def _build_ui(plugin_id, mod):
    """Génère le JSON UI depuis le SECTIONS du plugin."""
    sections = getattr(mod, 'SECTIONS', {})
    return {
        'plugin_id':        plugin_id,
        'name':             getattr(mod, 'NAME',             plugin_id),
        'version':          getattr(mod, 'VERSION',          '1.0.0'),
        'sections':         sections,
        'scenario_actions': getattr(mod, 'SCENARIO_ACTIONS', []),
        'extra_js':         getattr(mod, 'EXTRA_JS',         []),
    }


# ─── Exécution d'une action ───────────────────────────────────────────────────

def run_action(plugin_id, action_name, params=None):
    entry = _active_plugins.get(plugin_id)
    if not entry:
        return {'success': False, 'error': f'Plugin not active: {plugin_id}'}

    mod, ctx = entry['module'], entry['ctx']
    fn = getattr(mod, action_name, None)
    if not callable(fn):
        return {'success': False, 'error': f'Unknown action: {action_name}'}

    try:
        result = fn(ctx, params or {})
        return result if isinstance(result, dict) else {'success': True, 'result': result}
    except Exception as e:
        traceback.print_exc()
        return {'success': False, 'error': str(e)}


# ─── Routes Flask ─────────────────────────────────────────────────────────────

def register_routes(app):
    from flask import Blueprint, request, jsonify
    bp = Blueprint('plugin_engine', __name__)

    @bp.route('/api/pyplugins/scan', methods=['GET'])
    def _pe_scan():
        return jsonify({'plugins': scan_plugins()})

    @bp.route('/api/pyplugins/activate', methods=['POST'])
    def _pe_activate():
        data = request.get_json() or {}
        plugin_id = data.get('plugin_id')
        if not plugin_id:
            return jsonify({'success': False, 'error': 'plugin_id required'})
        ok = activate(plugin_id)
        return jsonify({'success': ok, 'plugin_id': plugin_id})

    @bp.route('/api/pyplugins/deactivate', methods=['POST'])
    def _pe_deactivate():
        data = request.get_json() or {}
        plugin_id = data.get('plugin_id')
        if not plugin_id:
            return jsonify({'success': False, 'error': 'plugin_id required'})
        deactivate(plugin_id)
        return jsonify({'success': True})

    @bp.route('/api/pyplugins/list', methods=['GET'])
    def _pe_list():
        return jsonify({
            'available': scan_plugins(),
            'active':    list(_active_plugins.keys())
        })

    @bp.route('/api/pyplugins/<plugin_id>/ui', methods=['GET'])
    def _pe_ui(plugin_id):
        entry = _active_plugins.get(plugin_id)
        if not entry:
            return jsonify({'success': False, 'error': 'Plugin not active'})
        ui = _build_ui(plugin_id, entry['module'])
        return jsonify(ui)

    @bp.route('/api/pyplugins/<plugin_id>/action/<action_name>', methods=['POST'])
    def _pe_action(plugin_id, action_name):
        params = request.get_json(silent=True) or {}
        t = threading.Thread(target=run_action, args=(plugin_id, action_name, params), daemon=True)
        t.start()
        return jsonify({'success': True, 'async': True})

    # Restaurer les plugins actifs au démarrage
    for pid in _load_active():
        try:
            activate(pid)
        except Exception as e:
            print(f"  [WARN] Auto-restore plugin {pid} failed: {e}")

    app.register_blueprint(bp)

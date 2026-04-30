"""
plugin_router.py — Chargement dynamique des modules Python des plugins.
Route universelle /api/plugins/<id>/<tool>/<action>.
"""

import os
import importlib.util
from . import basic_functions

loaded_modules = {}  # {"enderscope/camera": module, ...}


def _resolve_folder(plugin_id):
    """Resolve plugin folder name by scanning plugin.json files."""
    plugins_dir = get_plugins_dir()
    for name in os.listdir(plugins_dir):
        pj = os.path.join(plugins_dir, name, 'plugin.json')
        if os.path.isfile(pj):
            try:
                import json
                with open(pj) as f:
                    manifest = json.load(f)
                if manifest.get('id') == plugin_id:
                    return manifest.get('folder', name)
            except:
                pass
    return None


def get_plugins_dir():
    return os.path.join(basic_functions.PROJECT_ROOT, 'plugins')


def load_module(plugin_id, tool_id, force_reload=False):
    key = f"{plugin_id}/{tool_id}"
    if key in loaded_modules and not force_reload:
        return loaded_modules[key]

    # Cleanup old module before reload
    if key in loaded_modules and force_reload:
        old_mod = loaded_modules[key]
        cleanup = getattr(old_mod, 'ACTIONS', {}).get('/reset')
        if cleanup:
            try:
                cleanup()
                print(f"  \U0001f50c Cleanup called on {key}")
            except Exception as e:
                print(f"  \u26a0\ufe0f Cleanup failed on {key}: {e}")

    script_path = os.path.join(get_plugins_dir(), plugin_id, 'scripts', f'{tool_id}.py')
    if not os.path.isfile(script_path):
        # Try folder name from registry (e.g. smartTracking -> smart-tracking)
        registry = _resolve_folder(plugin_id)
        if registry:
            script_path = os.path.join(get_plugins_dir(), registry, 'scripts', f'{tool_id}.py')
    if not os.path.isfile(script_path):
        return None

    try:
        spec = importlib.util.spec_from_file_location(f"plugin_{key.replace('/', '_')}", script_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        loaded_modules[key] = mod
        print(f"  🔌 Plugin module chargé: {key}")
        return mod
    except Exception as e:
        print(f"  ❌ Échec chargement {key}: {e}")
        return None


def register_routes(app):
    """Enregistre les routes /api/plugins/* sur l'app Flask."""
    from flask import request, jsonify, Response

    @app.route('/api/plugins/activate', methods=['POST'])
    def _activate():
        data = request.get_json() or {}
        plugin_id = data.get('pluginId')
        active = data.get('active', True)
        if not plugin_id:
            return jsonify({'success': False, 'error': 'pluginId requis'})

        if active:
            folder = _resolve_folder(plugin_id) or plugin_id
            scripts_dir = os.path.join(get_plugins_dir(), folder, 'scripts')
            if not os.path.isdir(scripts_dir):
                scripts_dir = os.path.join(get_plugins_dir(), plugin_id, 'scripts')
            if os.path.isdir(scripts_dir):
                for fname in os.listdir(scripts_dir):
                    if fname.endswith('.py'):
                        load_module(plugin_id, fname[:-3], force_reload=True)
            print(f"  🔌 Plugin activé: {plugin_id}")
        else:
            to_remove = [k for k in loaded_modules if k.startswith(f"{plugin_id}/")]
            for k in to_remove:
                del loaded_modules[k]
            print(f"  ⏸️ Plugin désactivé: {plugin_id}")

        return jsonify({'success': True, 'pluginId': plugin_id, 'active': active})

    @app.route('/api/plugins/list', methods=['GET'])
    def _list():
        plugins_dir = get_plugins_dir()
        result = []
        if os.path.isdir(plugins_dir):
            for name in os.listdir(plugins_dir):
                if os.path.isfile(os.path.join(plugins_dir, name, 'plugin.json')):
                    result.append(name)
        return jsonify(result)

    @app.route('/api/plugins/discover', methods=['GET'])
    def _discover():
        """Scan plugins/ folder and return all plugin.json manifests."""
        import json as json_mod
        plugins_dir = get_plugins_dir()
        manifests = []
        if os.path.isdir(plugins_dir):
            for name in sorted(os.listdir(plugins_dir)):
                pj = os.path.join(plugins_dir, name, 'plugin.json')
                if os.path.isfile(pj):
                    try:
                        with open(pj) as f:
                            manifest = json_mod.load(f)
                        if not manifest.get('folder'):
                            manifest['folder'] = name
                        manifests.append(manifest)
                    except Exception as e:
                        print(f"  \u26a0\ufe0f Erreur lecture {pj}: {e}")
        return jsonify(manifests)

    @app.route('/api/plugins/<plugin_id>/<tool_id>/<path:action>', methods=['GET', 'POST'])
    def _action(plugin_id, tool_id, action):
        mod = load_module(plugin_id, tool_id)
        if not mod:
            return jsonify({'success': False, 'error': f'Module introuvable: {plugin_id}/{tool_id}'}), 404

        endpoint = f'/{action}'

        # MJPEG stream
        if endpoint == '/stream' and hasattr(mod, 'stream_generator'):
            return Response(mod.stream_generator(), mimetype='multipart/x-mixed-replace; boundary=frame')

        actions = getattr(mod, 'ACTIONS', {})
        handler = actions.get(endpoint)
        if not handler:
            return jsonify({'success': False, 'error': f'Action inconnue: {endpoint}'}), 404

        params = request.get_json(silent=True) or {}
        try:
            result = handler(params) if params else handler()
            return jsonify(result) if isinstance(result, dict) else jsonify({'success': True, 'result': result})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    print("  🔌 plugin_router: routes /api/plugins/*")

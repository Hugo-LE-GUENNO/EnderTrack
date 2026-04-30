#!/usr/bin/env python3
# enderscope/hardware-server.py - Flask server for Enderscope hardware control

import sys
import os
import time

# Support vendored dependencies (offline / desert mode 🏜️)
vendor_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vendor')
if os.path.isdir(vendor_dir):
    sys.path.insert(0, vendor_dir)

from flask import Flask, request, jsonify
from flask_cors import CORS

# Add current directory to path to import enderscope module
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import enderscope-simple for debugging
try:
    import importlib.util
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    basic_path = os.path.join(script_dir, "enderscope-basic.py")
    
    spec = importlib.util.spec_from_file_location("enderscope_basic", basic_path)
    enderscope_basic = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(enderscope_basic)
    
    Stage = enderscope_basic.Stage
    SerialUtils = enderscope_basic.SerialUtils
    print("✅ Successfully imported enderscope-basic module")
except ImportError as e:
    error_msg = str(e)
    if "serial" in error_msg.lower():
        print("❌ Cannot import enderscope-basic: pyserial manquant")
        print("📝 Pour installer: pip install pyserial")
    else:
        print(f"❌ Cannot import enderscope-basic: {e}")
    Stage = None
    SerialUtils = None
except Exception as e:
    print(f"❌ Error importing enderscope-basic: {e}")
    Stage = None
    SerialUtils = None

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global stage instance
stage = None

@app.route('/api/ports', methods=['GET'])
def get_ports():
    """Get available serial ports"""
    try:
        if SerialUtils:
            ports = SerialUtils.serial_ports()
        else:
            # Fallback for testing
            ports = ['/dev/ttyUSB0', '/dev/ttyACM0', 'COM3', 'COM4']
        
        return jsonify(ports)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/connect', methods=['POST'])
def connect():
    """Connect to Enderscope"""
    global stage
    
    try:
        data = request.get_json()
        port = data.get('port') if data else None
        baud_rate = data.get('baudRate', 115200) if data else 115200
        
        if not port:
            return jsonify({'success': False, 'error': 'Port required'})
        
        if Stage:
            try:
                stage = Stage(port, baud_rate, homing=False)
                return jsonify({'success': True, 'message': f'Connected to {port}'})
            except Exception as stage_error:
                return jsonify({'success': False, 'error': f'Connection failed: {str(stage_error)}'})
        else:
            return jsonify({
                'success': False, 
                'error': 'Impossible de se connecter: dépendances manquantes (installer pyserial)'
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/disconnect', methods=['POST'])
def disconnect():
    """Disconnect from Enderscope"""
    global stage
    
    try:
        if stage and hasattr(stage, 'ser'):
            stage.ser.close()
        stage = None
        
        return jsonify({'success': True, 'message': 'Disconnected'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/home', methods=['POST'])
def home():
    """Home all axes"""
    try:
        if stage:
            stage.home()
            return jsonify({'success': True, 'message': 'Homing completed'})
        else:
            return jsonify({'success': True, 'message': 'Homing completed (simulation)'})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/position', methods=['GET'])
def get_position():
    """Get current position"""
    try:
        if stage:
            pos = stage.get_position(dict=True)
            return jsonify({
                'success': True, 
                'position': {'x': pos['X'], 'y': pos['Y'], 'z': pos['Z']}
            })
        else:
            # Simulation position
            return jsonify({
                'success': True,
                'position': {'x': 0.0, 'y': 0.0, 'z': 0.0}
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/move/absolute', methods=['POST'])
def move_absolute():
    """Move to absolute position"""
    try:
        data = request.get_json()
        x = data.get('x', 0)
        y = data.get('y', 0) 
        z = data.get('z', 0)
        feedrate = data.get('feedrate', 3000)
        
        if stage:
            print(f"⏩ [MOVE ABS] G1 X:{x} Y:{y} Z:{z} F{feedrate}")
            stage.move_absolute(x, y, z, feedrate=feedrate)
            print(f"⏳ [M400] Attente fin mouvement...")
            t0 = time.time()
            stage.finish_moves()  # M400 - attendre fin du mouvement
            dt = time.time() - t0
            print(f"✅ [M400] Mouvement terminé en {dt:.2f}s")
            return jsonify({'success': True, 'message': f'Moved to X:{x} Y:{y} Z:{z}', 'm400_duration': round(dt, 3)})
        else:
            return jsonify({'success': True, 'message': f'Moved to X:{x} Y:{y} Z:{z} (simulation)'})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/move/relative', methods=['POST'])
def move_relative():
    """Move relative distance"""
    try:
        data = request.get_json()
        dx = data.get('dx', 0)
        dy = data.get('dy', 0)
        dz = data.get('dz', 0)
        feedrate = data.get('feedrate', 3000)
        
        if stage:
            print(f"⏩ [MOVE REL] G1 dX:{dx} dY:{dy} dZ:{dz} F{feedrate}")
            stage.move_relative(dx, dy, dz, feedrate=feedrate)
            print(f"⏳ [M400] Attente fin mouvement...")
            t0 = time.time()
            stage.finish_moves()  # M400 - attendre fin du mouvement
            dt = time.time() - t0
            print(f"✅ [M400] Mouvement terminé en {dt:.2f}s")
            return jsonify({'success': True, 'message': f'Moved by dX:{dx} dY:{dy} dZ:{dz}', 'm400_duration': round(dt, 3)})
        else:
            return jsonify({'success': True, 'message': f'Moved by dX:{dx} dY:{dy} dZ:{dz} (simulation)'})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/gcode', methods=['POST'])
def send_gcode():
    """Send raw G-code command"""
    try:
        data = request.get_json()
        command = data.get('command', '').strip()
        
        if not command:
            return jsonify({'success': False, 'error': 'No command provided'})
        
        # Validate G-code: block dangerous commands
        blocked = ['M502', 'M500', 'M501']  # factory reset, save/load EEPROM
        cmd_upper = command.split()[0].upper() if command.split() else ''
        if cmd_upper in blocked:
            return jsonify({'success': False, 'error': f'Blocked command: {cmd_upper}'})
        
        if stage:
            print(f"🔧 [GCODE] Envoi commande: {command}")
            response_lines = stage.send_gcode(command, wait_ok=True)
            return jsonify({'success': True, 'message': f'G-code sent: {command}', 'response': response_lines})
        else:
            print(f"🔧 [SIMULATION] G-code: {command}")
            return jsonify({'success': True, 'message': f'G-code sent (simulation): {command}', 'response': [f'[SIM] {command}', 'ok']})            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/emergency_stop', methods=['POST'])
def emergency_stop():
    """Emergency stop - send M112 (emergency stop) and M999 (reset)"""
    try:
        if stage:
            print(f"🛑 [EMERGENCY] Arrêt d'urgence activé!")
            stage.send_gcode("M112")  # Emergency stop
            time.sleep(0.1)
            stage.send_gcode("M999")  # Reset after emergency stop
            return jsonify({'success': True, 'message': 'Emergency stop executed'})
        else:
            print(f"🛑 [SIMULATION] Arrêt d'urgence")
            return jsonify({'success': True, 'message': 'Emergency stop (simulation)'})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/beep', methods=['POST'])
def beep():
    """Send M300 beep command"""
    try:
        if stage:
            print(f"🔊 [BEEP] Bip!")
            stage.send_gcode("M300")
            return jsonify({'success': True, 'message': 'Beep sent'})
        else:
            print(f"🔊 [SIMULATION] Bip!")
            return jsonify({'success': True, 'message': 'Beep sent (simulation)'})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get server status"""
    connected = False
    if stage and hasattr(stage, 'ser') and stage.ser and stage.ser.is_open:
        connected = True
    
    return jsonify({
        'success': True,
        'connected': connected,
        'simulation_mode': Stage is None,
        'port': stage.port if stage and hasattr(stage, 'port') else None,
        'message': 'Enderscope server running'
    })

# =============================================================================
# DYNAMIC PLUGIN ROUTER
# Loads Python modules from plugins/<id>/scripts/ on demand
# =============================================================================

loaded_plugin_modules = {}  # {"enderscope/camera": module, ...}

def get_plugins_dir():
    """Resolve plugins/ directory relative to project root."""
    server_dir = os.path.dirname(os.path.abspath(__file__))
    # hardware-bridges/enderscope/ -> project root
    project_root = os.path.abspath(os.path.join(server_dir, '..', '..'))
    return os.path.join(project_root, 'plugins')

def load_plugin_module(plugin_id, tool_id):
    """Dynamically import a plugin's Python script."""
    key = f"{plugin_id}/{tool_id}"
    if key in loaded_plugin_modules:
        return loaded_plugin_modules[key]

    script_path = os.path.join(get_plugins_dir(), plugin_id, 'scripts', f'{tool_id}.py')
    if not os.path.isfile(script_path):
        return None

    try:
        spec = importlib.util.spec_from_file_location(f"plugin_{key.replace('/', '_')}", script_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        loaded_plugin_modules[key] = mod
        print(f"🔌 Loaded plugin module: {key}")
        return mod
    except Exception as e:
        print(f"❌ Failed to load plugin module {key}: {e}")
        return None


@app.route('/api/plugins/activate', methods=['POST'])
def plugin_activate():
    """Frontend notifies server that a plugin was activated/deactivated."""
    data = request.get_json() or {}
    plugin_id = data.get('pluginId')
    active = data.get('active', True)

    if not plugin_id:
        return jsonify({'success': False, 'error': 'pluginId required'})

    if active:
        # Pre-load all tool scripts for this plugin
        scripts_dir = os.path.join(get_plugins_dir(), plugin_id, 'scripts')
        if os.path.isdir(scripts_dir):
            for fname in os.listdir(scripts_dir):
                if fname.endswith('.py'):
                    tool_id = fname[:-3]
                    load_plugin_module(plugin_id, tool_id)
        print(f"🔌 Plugin activated: {plugin_id}")
    else:
        # Unload modules
        to_remove = [k for k in loaded_plugin_modules if k.startswith(f"{plugin_id}/")]
        for k in to_remove:
            del loaded_plugin_modules[k]
        print(f"⏸️ Plugin deactivated: {plugin_id}")

    return jsonify({'success': True, 'pluginId': plugin_id, 'active': active})


@app.route('/api/plugins/list', methods=['GET'])
def plugin_list():
    """List available plugins by scanning the plugins/ directory."""
    plugins_dir = get_plugins_dir()
    result = []
    if os.path.isdir(plugins_dir):
        for name in os.listdir(plugins_dir):
            manifest_path = os.path.join(plugins_dir, name, 'plugin.json')
            if os.path.isfile(manifest_path):
                result.append(name)
    return jsonify(result)


@app.route('/api/plugins/<plugin_id>/<tool_id>/<path:action>', methods=['GET', 'POST'])
def plugin_action(plugin_id, tool_id, action):
    """Universal router: dispatches to the plugin module's ACTIONS dict."""
    mod = load_plugin_module(plugin_id, tool_id)
    if not mod:
        return jsonify({'success': False, 'error': f'Module not found: {plugin_id}/{tool_id}'}), 404

    actions = getattr(mod, 'ACTIONS', {})
    endpoint = f'/{action}'

    # Handle stream endpoint specially (MJPEG)
    if endpoint == '/stream' and hasattr(mod, 'stream_generator'):
        from flask import Response
        return Response(mod.stream_generator(), mimetype='multipart/x-mixed-replace; boundary=frame')

    handler = actions.get(endpoint)
    if not handler:
        return jsonify({'success': False, 'error': f'Unknown action: {endpoint}'}), 404

    params = request.get_json(silent=True) or {}
    try:
        result = handler(params) if params else handler()
        if isinstance(result, dict):
            return jsonify(result)
        return jsonify({'success': True, 'result': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/browse', methods=['GET'])
def browse_directory():
    """Browse filesystem directories (Jupyter-style server-side browsing)."""
    path = request.args.get('path', os.path.expanduser('~'))
    try:
        path = os.path.abspath(path)
        if not os.path.isdir(path):
            path = os.path.dirname(path)
        entries = []
        for name in sorted(os.listdir(path)):
            full = os.path.join(path, name)
            if os.path.isdir(full) and not name.startswith('.'):
                entries.append(name)
        parent = os.path.dirname(path)
        return jsonify({
            'success': True,
            'path': path,
            'parent': parent if parent != path else None,
            'dirs': entries
        })
    except PermissionError:
        return jsonify({'success': False, 'error': f'Permission denied: {path}'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


if __name__ == '__main__':
    print("🔬 Starting Enderscope Hardware Server...")
    print("📡 Server will run on http://localhost:5000")
    
    if Stage is None:
        print("⚠️  Running in SIMULATION mode (enderscope-basic.py not found)")
    else:
        print("✅ Hardware control enabled (enderscope-basic)")
    
    app.run(host='127.0.0.1', port=5000, debug=False)
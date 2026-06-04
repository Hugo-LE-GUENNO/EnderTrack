# server/arduino_light_handler.py — Arduino Enderlights serial control
"""
Communicates with Enderlights firmware via USB serial.
Commands: S0/S1 (shutter), R/G/B (color), A (all), M (mode), P (param), ? (query)
"""

import threading
import time

try:
    import serial
    HAS_SERIAL = True
except ImportError:
    HAS_SERIAL = False

_lock = threading.Lock()
_ser = None
_port = '/dev/ttyUSB0'
_baud = 57600
_connected = False

_shutter = False
_r = 20
_g = 20
_b = 20
_intensity = 1.0
_mode = 0
_parameter = 0


def _connect():
    global _ser, _connected
    if not HAS_SERIAL:
        return False
    if _ser and _ser.is_open:
        return True
    try:
        _ser = serial.Serial(_port, _baud, timeout=1)
        time.sleep(2)  # Arduino resets on serial open
        _ser.reset_input_buffer()
        _connected = True
        print(f"  💡 Arduino light connected on {_port}", flush=True)
        return True
    except Exception as e:
        print(f"  💡 Arduino light failed: {e}", flush=True)
        _connected = False
        return False


def _send(cmd):
    with _lock:
        if not _ser or not _ser.is_open:
            if not _connect():
                return "Err"
        try:
            _ser.write((cmd + '\n').encode())
            return _ser.readline().decode().strip()
        except Exception as e:
            return f"Err:{e}"


def _apply():
    r = min(255, max(0, int(_r * _intensity)))
    g = min(255, max(0, int(_g * _intensity)))
    b = min(255, max(0, int(_b * _intensity)))
    _send(f"R{r}")
    _send(f"G{g}")
    _send(f"B{b}")
    _send(f"S{1 if _shutter else 0}")


def register_routes(app):
    from flask import request, jsonify
    global _port, _baud

    # Read port from config
    try:
        import json, os
        cfg_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', 'config.json')
        with open(cfg_path) as f:
            cfg = json.load(f)
        _port = cfg.get('arduino_light_port', _port)
        _baud = cfg.get('arduino_light_baud', _baud)
    except:
        pass

    _connect()

    @app.route('/api/arduino-light/status')
    def _al_status():
        return jsonify({
            'connected': _connected,
            'port': _port,
            'shutter': _shutter,
            'r': _r, 'g': _g, 'b': _b,
            'intensity': _intensity,
            'mode': _mode, 'parameter': _parameter
        })

    @app.route('/api/arduino-light/configure', methods=['POST'])
    def _al_configure():
        global _port, _baud, _ser, _connected
        data = request.get_json() or {}
        if 'port' in data:
            _port = data['port']
        if 'baud' in data:
            _baud = int(data['baud'])
        if _ser and _ser.is_open:
            _ser.close()
        _connected = False
        ok = _connect()
        return jsonify({'success': True, 'connected': ok, 'port': _port})

    @app.route('/api/arduino-light/on', methods=['POST'])
    def _al_on():
        global _shutter, _r, _g, _b, _intensity, _port
        data = request.get_json() or {}
        # Auto-configure port if passed
        if 'port' in data and data['port'] != _port:
            _port = data['port']
            _connect()
        _shutter = True
        if 'r' in data: _r = min(255, max(0, int(data['r'])))
        if 'g' in data: _g = min(255, max(0, int(data['g'])))
        if 'b' in data: _b = min(255, max(0, int(data['b'])))
        if 'intensity' in data: _intensity = max(0, min(1, float(data['intensity'])))
        _apply()
        return jsonify({'success': True, 'shutter': True, 'r': _r, 'g': _g, 'b': _b, 'intensity': _intensity})

    @app.route('/api/arduino-light/off', methods=['POST'])
    def _al_off():
        global _shutter
        _shutter = False
        _send("S0")
        return jsonify({'success': True, 'shutter': False})

    @app.route('/api/arduino-light/toggle', methods=['POST'])
    def _al_toggle():
        global _shutter
        _shutter = not _shutter
        _send(f"S{1 if _shutter else 0}")
        return jsonify({'success': True, 'shutter': _shutter})

    @app.route('/api/arduino-light/color', methods=['POST'])
    def _al_color():
        global _r, _g, _b
        data = request.get_json() or {}
        if 'r' in data: _r = min(255, max(0, int(data['r'])))
        if 'g' in data: _g = min(255, max(0, int(data['g'])))
        if 'b' in data: _b = min(255, max(0, int(data['b'])))
        if _shutter:
            _apply()
        return jsonify({'success': True, 'r': _r, 'g': _g, 'b': _b})

    @app.route('/api/arduino-light/intensity', methods=['POST'])
    def _al_intensity():
        global _intensity
        data = request.get_json() or {}
        if 'intensity' in data:
            _intensity = max(0, min(1, float(data['intensity'])))
        if _shutter:
            _apply()
        return jsonify({'success': True, 'intensity': _intensity})

    @app.route('/api/arduino-light/mode', methods=['POST'])
    def _al_mode():
        global _mode, _parameter
        data = request.get_json() or {}
        if 'mode' in data:
            _mode = int(data['mode'])
            _send(f"M{_mode}")
        if 'parameter' in data:
            _parameter = int(data['parameter'])
            _send(f"P{_parameter}")
        return jsonify({'success': True, 'mode': _mode, 'parameter': _parameter})

    print(f"  {'✅' if _connected else '🎮'} Arduino light routes registered ({_port})")

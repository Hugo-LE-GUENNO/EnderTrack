"""
stage_connection.py — Connexion série + contrôle stage motorisé.
Gère la connexion, le G-code, les mouvements, le homing, l'arrêt d'urgence.
"""

import time
import threading

_serial_lock = threading.Lock()

# ─── Import pyserial (optionnel) ─────────────────────────────────────────────

try:
    import serial
    import serial.tools.list_ports
    HAS_SERIAL = True
except ImportError:
    HAS_SERIAL = False

# ─── Stage class ─────────────────────────────────────────────────────────────

stage = None  # Instance globale
_connecting = False


class Stage:
    """Contrôle d'un stage motorisé 3 axes via G-code série."""

    def __init__(self, port, baudrate=115200, homing=False):
        self.port = port
        self.baudrate = baudrate
        self.position = {'X': 0.0, 'Y': 0.0, 'Z': 0.0}
        self.firmware_name = None
        self.limits = None
        self.speeds = None

        self.ser = serial.Serial(port, baudrate, timeout=2)
        time.sleep(2.5)
        self.ser.reset_input_buffer()
        time.sleep(0.3)
        self.ser.reset_input_buffer()

        lines = []
        for attempt in range(3):
            self.ser.reset_input_buffer()
            lines = self.send_gcode("M115", wait_ok=True, timeout=5)
            if any('FIRMWARE_NAME' in l or l.startswith('ok') for l in lines):
                break
            time.sleep(1)
        response = ' '.join(lines)
        if 'FIRMWARE_NAME' in response or 'ok' in response.lower():
            for line in lines:
                if 'FIRMWARE_NAME:' in line:
                    self.firmware_name = line.split('FIRMWARE_NAME:')[1].split(' ')[0].strip()
            self.send_gcode("G21", wait_ok=True)
            self.send_gcode("G90", wait_ok=True)
            self._probe_limits()   # M211
            self._probe_speeds()   # M503
            self.get_position()    # M114
            if homing:
                self.home()
            name = self.firmware_name or 'G-code device'
            print(f"  [OK] Stage connected: {port} @ {baudrate} ({name})")
            if self.limits:
                l = self.limits
                print(f"  [DIM] Limites: X[{l['x'][0]}, {l['x'][1]}] Y[{l['y'][0]}, {l['y'][1]}] Z[{l['z'][0]}, {l['z'][1]}]")
        else:
            self.ser.close()
            raise Exception(f"Device on {port} does not respond to G-code (no M115 response)")

    def _probe_speeds(self):
        """Parse M503 to get firmware max speeds (M203). Publishes maxFeedrate/maxZSpeed only."""
        try:
            lines = self.send_gcode("M503", wait_ok=True, timeout=10)
            import re
            for line in lines:
                m = re.search(r'\bM203\b.*X([\d.]+).*Y([\d.]+).*Z([\d.]+)', line)
                if m:
                    self.speeds = {
                        'xy_mms': min(float(m.group(1)), float(m.group(2))),
                        'z_mms': float(m.group(3))
                    }
                    max_feedrate = int(self.speeds['xy_mms'] * 60)
                    max_z_speed = self.speeds['z_mms']
                    print(f"  [SPD] M203 XY:{self.speeds['xy_mms']}mm/s Z:{max_z_speed}mm/s (max: {max_feedrate}mm/min)")
                    try:
                        from server.event_stream import bus
                        from server.sync_store import _read, _write
                        existing = _read('config') or {}
                        # Clamp user feedrate/zSpeed to firmware max if they exceed it
                        changed = False
                        if existing.get('feedrate', 0) > max_feedrate:
                            existing['feedrate'] = max_feedrate
                            changed = True
                        if existing.get('zSpeed', 0) > max_z_speed:
                            existing['zSpeed'] = max_z_speed
                            changed = True
                        existing['maxFeedrate'] = max_feedrate
                        existing['maxZSpeed'] = max_z_speed
                        _write('config', existing)
                        bus.publish('sync:config', existing)
                    except: pass
                    return
        except Exception:
            pass

    def _probe_limits(self):
        """Parse M211 to get real axis limits from firmware."""
        try:
            lines = self.send_gcode("M211", wait_ok=True, timeout=5)
            import re
            for line in lines:
                # Marlin: "echo:Soft endstops: ON  Min: X-27.00 Y-11.00 Z0.00  Max: X220.00 Y220.00 Z250.00"
                m = re.search(
                    r'Min:\s*X([\d.\-]+)\s+Y([\d.\-]+)\s+Z([\d.\-]+)\s+Max:\s*X([\d.\-]+)\s+Y([\d.\-]+)\s+Z([\d.\-]+)',
                    line, re.IGNORECASE
                )
                if m:
                    self.limits = {
                        'x': (float(m.group(1)), float(m.group(4))),
                        'y': (float(m.group(2)), float(m.group(5))),
                        'z': (float(m.group(3)), float(m.group(6))),
                    }
                    return
        except Exception:
            pass

    def send_gcode(self, command, wait_ok=False, timeout=10, _log=True):
        with _serial_lock:
            if not self.ser.is_open:
                raise Exception("Serial port closed")
            if not command.endswith("\n"):
                command += "\n"
            cmd = command.strip()
            _silent = cmd in ('M115', 'G21', 'G90', 'G91')
            if _log and not _silent:
                print(f"  > {cmd}")
            self.ser.write(command.encode('utf-8'))
            if wait_ok:
                lines = []
                deadline = time.time() + timeout
                while time.time() < deadline:
                    line = self.ser.readline().decode('utf-8', errors='ignore').strip()
                    if not line:
                        continue
                    lines.append(line)
                    if line.startswith('ok'):
                        self.ser.timeout = 0.3
                        while True:
                            extra = self.ser.readline().decode('utf-8', errors='ignore').strip()
                            if not extra:
                                break
                            lines.append(extra)
                        self.ser.timeout = 2
                        if _log and not _silent:
                            for l in lines:
                                if l != 'ok':
                                    print(f"  < {l}")
                        return lines
                lines.append("timeout")
                return lines
            return ["sent"]

    def move_absolute(self, x, y, z, feedrate=3000):
        import math
        print(f"  > [ABS] G1 X{x} Y{y} Z{z} F{feedrate}")
        try:
            from server.event_stream import bus
            sx, sy, sz = self.position['X'], self.position['Y'], self.position['Z']
            distXY = math.sqrt((x - sx)**2 + (y - sy)**2)
            distZ = abs(z - sz)
            speedXY = feedrate / 60
            speedZ = min(feedrate / 60, 5)
            duration = max(distXY / speedXY if distXY > 0 else 0, distZ / speedZ if distZ > 0 else 0)
            bus.publish('position:moving', {'x': x, 'y': y, 'z': z, 'sx': sx, 'sy': sy, 'sz': sz, 'duration': max(duration, 0.2) * 1000})
        except: pass
        lines = self.send_gcode(f"G1 X{x} Y{y} Z{z} F{feedrate}", wait_ok=True, _log=False)
        if 'timeout' in lines: self.firmware_name = None; return
        self.position = {'X': float(x), 'Y': float(y), 'Z': float(z)}
        try:
            from server.event_stream import bus
            bus.publish('position:arrived', {'x': float(x), 'y': float(y), 'z': float(z)})
        except: pass

    def move_relative(self, dx, dy, dz, feedrate=3000):
        import math
        print(f"  > [REL] G1 X{dx} Y{dy} Z{dz} F{feedrate}")
        sx, sy, sz = self.position['X'], self.position['Y'], self.position['Z']
        tx, ty, tz = sx + float(dx), sy + float(dy), sz + float(dz)
        try:
            from server.event_stream import bus
            distXY = math.sqrt(dx**2 + dy**2)
            distZ = abs(dz)
            speedXY = feedrate / 60
            speedZ = min(feedrate / 60, 5)
            duration = max(distXY / speedXY if distXY > 0 else 0, distZ / speedZ if distZ > 0 else 0)
            bus.publish('position:moving', {'x': tx, 'y': ty, 'z': tz, 'sx': sx, 'sy': sy, 'sz': sz, 'duration': max(duration, 0.2) * 1000})
        except: pass
        # G91→G1→G90 doit être atomique — on tient le lock pour toute la séquence
        with _serial_lock:
            if not self.ser.is_open:
                raise Exception("Serial port closed")
            for cmd in ("G91\n", f"G1 X{dx} Y{dy} Z{dz} F{feedrate}\n", "G90\n"):
                self.ser.write(cmd.encode('utf-8'))
                deadline = time.time() + 10
                while time.time() < deadline:
                    line = self.ser.readline().decode('utf-8', errors='ignore').strip()
                    if line.startswith('ok'):
                        break
        self.position['X'] = tx
        self.position['Y'] = ty
        self.position['Z'] = tz
        try:
            from server.event_stream import bus
            bus.publish('position:arrived', {'x': tx, 'y': ty, 'z': tz})
        except: pass

    def finish_moves(self):
        time.sleep(0.05)
        self.send_gcode("M400", wait_ok=True)

    def home(self):
        self.send_gcode("G28", wait_ok=True)
        self.send_gcode("M400", wait_ok=True)
        self.get_position()  # lit la vraie position firmware via M114

    def get_position(self, as_dict=False, timeout=10):
        try:
            lines = self.send_gcode("M114", wait_ok=True, timeout=timeout)
            if 'timeout' not in lines:
                for line in lines:
                    if 'X:' in line:
                        before_count = line.split('Count')[0]
                        for part in before_count.split():
                            if part.startswith('X:'): self.position['X'] = float(part[2:])
                            elif part.startswith('Y:'): self.position['Y'] = float(part[2:])
                            elif part.startswith('Z:'): self.position['Z'] = float(part[2:])
                        break
        except Exception:
            pass
        if as_dict:
            return self.position
        return self.position['X'], self.position['Y'], self.position['Z']

    def close(self):
        if self.ser and self.ser.is_open:
            self.ser.close()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def serial_ports():
    if not HAS_SERIAL:
        return ['/dev/ttyUSB0', '/dev/ttyACM0', 'COM3']
    return [p.device for p in serial.tools.list_ports.comports()]


def is_connected():
    if stage is None or not hasattr(stage, 'ser') or not stage.ser or not stage.ser.is_open:
        return False
    # Check if port still physically exists
    import os
    port = stage.ser.port
    if port and not os.path.exists(port):
        try:
            stage.ser.close()
        except:
            pass
        return False
    return True


# ─── Flask routes registration ───────────────────────────────────────────────

def register_routes(app):
    """Enregistre les routes /api/stage/* sur l'app Flask."""
    from flask import request, jsonify
    global stage

    @app.route('/api/ports', methods=['GET'])
    def _ports():
        return jsonify(serial_ports())

    _last_fail = {}

    @app.route('/api/connect', methods=['POST'])
    def _connect():
        global stage, _connecting
        data = request.get_json() or {}
        port = data.get('port')
        baud = data.get('baudRate', 115200)
        if not port:
            return jsonify({'success': False, 'error': 'Port required'})
        if not HAS_SERIAL:
            return jsonify({'success': False, 'error': 'pyserial not installed (pip install pyserial)'})
        # Already connected to this port — just return success
        if stage and is_connected() and hasattr(stage, 'port') and stage.port == port:
            return jsonify({'success': True, 'message': f'Already connected to {port}', 'firmware': getattr(stage, 'firmware_name', None)})
        if _connecting:
            return jsonify({'success': False, 'error': 'Connection in progress...'})
        try:
            _connecting = True
            stage = Stage(port, baud, homing=False)
            _last_fail.pop(port, None)
            _connecting = False
            # Position already read in Stage.__init__ — just publish it
            p = stage.position
            try:
                from server.event_stream import bus
                bus.publish('position:gcode', {'x': p['X'], 'y': p['Y'], 'z': p['Z']})
            except Exception:
                pass
            # Publish real dimensions to frontend
            if stage.limits:
                l = stage.limits
                config = {
                    'plateauDimensions': {'x': l['x'][1], 'y': l['y'][1], 'z': l['z'][1]},
                    'coordinateBounds': {
                        'x': {'min': l['x'][0], 'max': l['x'][1]},
                        'y': {'min': l['y'][0], 'max': l['y'][1]},
                        'z': {'min': l['z'][0], 'max': l['z'][1]},
                    },
                    'safetyLimits': {
                        'x': {'min': l['x'][0], 'max': l['x'][1]},
                        'y': {'min': l['y'][0], 'max': l['y'][1]},
                        'z': {'min': l['z'][0], 'max': l['z'][1]},
                    },
                }
                try:
                    from server.event_stream import bus
                    bus.publish('sync:config', config)
                except Exception:
                    pass
            return jsonify({'success': True, 'message': f'Connected to {port}', 'firmware': stage.firmware_name, 'limits': stage.limits})
        except Exception as e:
            _connecting = False
            if _last_fail.get(port) != str(e):
                print(f'  x Connection failed: {port} - {e}')
                _last_fail[port] = str(e)
            return jsonify({'success': False, 'error': str(e)})

    @app.route('/api/disconnect', methods=['POST'])
    def _disconnect():
        global stage, _connecting
        if stage:
            stage.close()
        stage = None
        _connecting = False
        print('  - Disconnected')
        return jsonify({'success': True})

    @app.route('/api/status', methods=['GET'])
    def _status():
        return jsonify({
            'success': True,
            'connected': is_connected(),
            'firmware': getattr(stage, 'firmware_name', None) if stage else None,
            'simulation_mode': not HAS_SERIAL,
            'port': stage.port if stage else None,
            'message': 'EnderTrack server running'
        })

    @app.route('/api/position', methods=['GET'])
    def _position():
        p = stage.position if stage else {'X': 0.0, 'Y': 0.0, 'Z': 0.0}
        return jsonify({'success': True, 'position': {'x': p.get('X', 0), 'y': p.get('Y', 0), 'z': p.get('Z', 0)}})

    @app.route('/api/move/absolute', methods=['POST'])
    def _move_abs():
        data = request.get_json() or {}
        x, y, z = data.get('x', 0), data.get('y', 0), data.get('z', 0)
        feedrate = data.get('feedrate', 3000)
        t0 = time.time()
        if stage:
            stage.move_absolute(x, y, z, feedrate=feedrate)
            stage.finish_moves()
        return jsonify({'success': True, 'duration': round(time.time() - t0, 3)})

    @app.route('/api/move/relative', methods=['POST'])
    def _move_rel():
        data = request.get_json() or {}
        dx, dy, dz = data.get('dx', 0), data.get('dy', 0), data.get('dz', 0)
        feedrate = data.get('feedrate', 3000)
        t0 = time.time()
        if stage:
            stage.move_relative(dx, dy, dz, feedrate=feedrate)
            stage.finish_moves()
        return jsonify({'success': True, 'duration': round(time.time() - t0, 3)})

    @app.route('/api/home', methods=['POST'])
    def _home():
        if stage:
            try:
                from server.event_stream import bus
                bus.publish('position:moving', {'x': 0, 'y': 0, 'z': 0})
            except: pass
            stage.home()
            p = stage.position
            try:
                from server.event_stream import bus
                bus.publish('position:arrived', {'x': p['X'], 'y': p['Y'], 'z': p['Z']})
            except: pass
        return jsonify({'success': True})

    @app.route('/api/gcode', methods=['POST'])
    def _gcode():
        data = request.get_json() or {}
        command = data.get('command', '').strip()
        if not command:
            return jsonify({'success': False, 'error': 'Commande vide'})
        blocked = ['M502', 'M500', 'M501']
        if command.split()[0].upper() in blocked:
            return jsonify({'success': False, 'error': f'Blocked command: {command.split()[0]}'})
        if stage:
            lines = stage.send_gcode(command, wait_ok=True)
            cmd_upper = command.strip().upper()
            is_move = cmd_upper.startswith('G0') or cmd_upper.startswith('G1')
            is_home = cmd_upper.startswith('G28')
            is_redefine = cmd_upper.startswith('G92')
            if is_move or is_home or is_redefine:
                stage.send_gcode('M400', wait_ok=True)
                stage.get_position()
                p = stage.position
                print(f"  [POS]   X:{p['X']} Y:{p['Y']} Z:{p['Z']} -> position:gcode")
                try:
                    from server.event_stream import bus
                    bus.publish('position:gcode', {'x': p['X'], 'y': p['Y'], 'z': p['Z']})
                    if is_home:
                        stage._probe_limits()
                        if stage.limits:
                            l = stage.limits
                            config = {
                                'plateauDimensions': {'x': l['x'][1] - l['x'][0], 'y': l['y'][1] - l['y'][0], 'z': l['z'][1] - l['z'][0]},
                                'coordinateBounds': {
                                    'x': {'min': l['x'][0], 'max': l['x'][1]},
                                    'y': {'min': l['y'][0], 'max': l['y'][1]},
                                    'z': {'min': l['z'][0], 'max': l['z'][1]},
                                },
                                'safetyLimits': {
                                    'x': {'min': l['x'][0], 'max': l['x'][1]},
                                    'y': {'min': l['y'][0], 'max': l['y'][1]},
                                    'z': {'min': l['z'][0], 'max': l['z'][1]},
                                },
                            }
                            bus.publish('sync:config', config)
                except: pass
            return jsonify({'success': True, 'response': lines})
        return jsonify({'success': True, 'response': [f'[SIM] {command}', 'ok']})

    @app.route('/api/emergency_stop', methods=['POST'])
    def _estop():
        global stage
        if stage:
            try:
                stage.send_gcode("M410")
                print('  ! Emergency stop')
            except:
                pass
        return jsonify({'success': True})

    @app.route('/api/firmware_kill', methods=['POST'])
    def _firmware_kill():
        """Hard kill - M112. Requires power cycle to recover."""
        global stage
        if stage:
            try:
                stage.send_gcode("M112")
                time.sleep(0.5)
                # Try M999 reset, but likely won't work
                stage.send_gcode("M999")
                time.sleep(1)
                # Check if firmware recovered
                try:
                    stage.send_gcode("M114")
                except:
                    # Firmware dead, close connection
                    try:
                        stage.ser.close()
                    except:
                        pass
                    stage = None
            except:
                try:
                    stage.ser.close()
                except:
                    pass
                stage = None
        return jsonify({'success': True, 'firmware_alive': stage is not None})

    @app.route('/api/reset_firmware', methods=['POST'])
    def _reset_firmware():
        """Reset microcontroller via DTR toggle + full reconnect."""
        global stage
        if not stage or not hasattr(stage, 'ser') or not stage.ser:
            return jsonify({'success': False, 'error': 'Not connected'})
        try:
            port = stage.ser.port
            baudrate = stage.ser.baudrate
            # Close cleanly
            try:
                stage.ser.close()
            except:
                pass
            stage = None
            # Reopen just for DTR toggle
            import serial as ser_mod
            tmp = ser_mod.Serial()
            tmp.port = port
            tmp.baudrate = baudrate
            tmp.dtr = False
            tmp.open()
            time.sleep(0.1)
            tmp.dtr = True
            time.sleep(0.1)
            tmp.close()
            # Wait for bootloader + Marlin init
            time.sleep(3)
            # Reconnect fresh
            try:
                stage = Stage(port, baudrate)
                return jsonify({'success': True, 'response': ['Reset OK - reconnected']})
            except Exception as e2:
                stage = None
                return jsonify({'success': False, 'error': f'Reset done but reconnect failed: {e2}'})
        except Exception as e:
            stage = None
            return jsonify({'success': False, 'error': str(e)})

    @app.route('/api/beep', methods=['POST'])
    def _beep():
        if stage:
            stage.send_gcode("M300")
        return jsonify({'success': True})


    @app.route('/api/move/stream', methods=['POST'])
    def _move_stream():
        """Send raw G-code for continuous movement (no M400 wait)."""
        data = request.get_json() or {}
        gcode = data.get('gcode', '')
        if stage and gcode:
            stage.send_gcode(gcode, wait_ok=False, _log=False)
        return jsonify({'success': True})

    @app.route('/api/move/stop', methods=['POST'])
    def _move_stop():
        """Quick stop: M410 aborts current move, G90 restores absolute mode."""
        if stage:
            stage.send_gcode("M410", wait_ok=False, _log=False)
            time.sleep(0.1)
            stage.send_gcode("G90", wait_ok=True, _log=False)
        return jsonify({'success': True})

    @app.route('/api/position/real', methods=['GET'])
    def _position_real():
        """Get real position from M114 (blocking query)."""
        if stage:
            p = stage.get_position(as_dict=True)
            return jsonify({'success': True, 'position': {'x': p.get('X', p.get('x', 0)), 'y': p.get('Y', p.get('y', 0)), 'z': p.get('Z', p.get('z', 0))}})
        return jsonify({'success': True, 'position': {'x': 0.0, 'y': 0.0, 'z': 0.0}})

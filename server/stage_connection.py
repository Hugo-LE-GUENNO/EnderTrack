"""
stage_connection.py — Connexion série + contrôle stage motorisé.
Gère la connexion, le G-code, les mouvements, le homing, l'arrêt d'urgence.
"""

import time

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

        self.ser = serial.Serial(port, baudrate, timeout=2)
        time.sleep(2)
        self.ser.reset_input_buffer()

        # Verify this is a G-code device via M115
        lines = self.send_gcode("M115", wait_ok=True, timeout=5)
        response = ' '.join(lines)
        if 'FIRMWARE_NAME' in response or 'ok' in response.lower():
            for line in lines:
                if 'FIRMWARE_NAME:' in line:
                    self.firmware_name = line.split('FIRMWARE_NAME:')[1].split(' ')[0].strip()
            self.send_gcode("G21", wait_ok=True)
            self.send_gcode("G90", wait_ok=True)
            if homing:
                self.home()
            name = self.firmware_name or 'G-code device'
            print(f"  ✅ Stage connecté: {port} @ {baudrate} ({name})")
        else:
            self.ser.close()
            raise Exception(f"Le device sur {port} ne répond pas au G-code (pas de réponse à M115)")

    def send_gcode(self, command, wait_ok=False, timeout=10):
        if not self.ser.is_open:
            raise Exception("Port série fermé")
        if not command.endswith("\n"):
            command += "\n"
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
                    return lines
            lines.append("timeout")
            return lines
        return ["sent"]

    def move_absolute(self, x, y, z, feedrate=3000):
        self.send_gcode(f"G1 X{x} Y{y} Z{z} F{feedrate}", wait_ok=True)
        self.position = {'X': float(x), 'Y': float(y), 'Z': float(z)}

    def move_relative(self, dx, dy, dz, feedrate=3000):
        self.send_gcode("G91", wait_ok=True)
        try:
            self.send_gcode(f"G1 X{dx} Y{dy} Z{dz} F{feedrate}", wait_ok=True)
            self.position['X'] += float(dx)
            self.position['Y'] += float(dy)
            self.position['Z'] += float(dz)
        finally:
            self.send_gcode("G90", wait_ok=True)

    def finish_moves(self):
        time.sleep(0.05)
        self.send_gcode("M400", wait_ok=True)

    def home(self):
        self.send_gcode("G28", wait_ok=True)
        self.send_gcode("M400", wait_ok=True)
        self.position = {'X': 0.0, 'Y': 0.0, 'Z': 0.0}

    def get_position(self, as_dict=False):
        """Read real position from firmware via M114."""
        try:
            lines = self.send_gcode("M114", wait_ok=True)
            for line in lines:
                if 'X:' in line:
                    # M114 returns: "X:38.90 Y:19.73 Z:0.00 E:0.00 Count X:3112 Y:1578 Z:-13"
                    # We want the first set (mm), not the Count (steps)
                    before_count = line.split('Count')[0]
                    for part in before_count.split():
                        if part.startswith('X:'):
                            self.position['X'] = float(part[2:])
                        elif part.startswith('Y:'):
                            self.position['Y'] = float(part[2:])
                        elif part.startswith('Z:'):
                            self.position['Z'] = float(part[2:])
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
            return jsonify({'success': False, 'error': 'Port requis'})
        if not HAS_SERIAL:
            return jsonify({'success': False, 'error': 'pyserial non installé (pip install pyserial)'})
        # Already connected to this port — just return success
        if stage and is_connected() and hasattr(stage, 'port') and stage.port == port:
            return jsonify({'success': True, 'message': f'Déjà connecté à {port}', 'firmware': getattr(stage, 'firmware_name', None)})
        if _connecting:
            return jsonify({'success': False, 'error': 'Connexion en cours...'})
        try:
            _connecting = True
            stage = Stage(port, baud, homing=False)
            _last_fail.pop(port, None)
            _connecting = False
            print(f'  + Connecte: {port} @ {baud}')
            return jsonify({'success': True, 'message': f'Connecté à {port}', 'firmware': stage.firmware_name})
        except Exception as e:
            _connecting = False
            if _last_fail.get(port) != str(e):
                print(f'  x Connexion echouee: {port} - {e}')
                _last_fail[port] = str(e)
            return jsonify({'success': False, 'error': str(e)})

    @app.route('/api/disconnect', methods=['POST'])
    def _disconnect():
        global stage
        if stage:
            stage.close()
        stage = None
        print('  - Deconnecte')
        return jsonify({'success': True})

    @app.route('/api/status', methods=['GET'])
    def _status():
        return jsonify({
            'success': True,
            'connected': is_connected(),
            'simulation_mode': not HAS_SERIAL,
            'port': stage.port if stage else None,
            'message': 'EnderTrack server running'
        })

    @app.route('/api/position', methods=['GET'])
    def _position():
        if stage:
            p = stage.get_position(as_dict=True)
            return jsonify({'success': True, 'position': {'x': p.get('X', p.get('x', 0)), 'y': p.get('Y', p.get('y', 0)), 'z': p.get('Z', p.get('z', 0))}})
        return jsonify({'success': True, 'position': {'x': 0.0, 'y': 0.0, 'z': 0.0}})

    @app.route('/api/move/absolute', methods=['POST'])
    def _move_abs():
        data = request.get_json() or {}
        x, y, z = data.get('x', 0), data.get('y', 0), data.get('z', 0)
        feedrate = data.get('feedrate', 3000)
        if stage:
            # Get current position for animation start
            cur = stage.get_position(as_dict=True)
            sx, sy, sz = cur.get('X', 0), cur.get('Y', 0), cur.get('Z', 0)
            # Estimate duration
            import math
            distXY = math.sqrt((x - sx)**2 + (y - sy)**2)
            distZ = abs(z - sz)
            speedXY = feedrate / 60
            speedZ = min(feedrate / 60, 5)
            duration = max(distXY / speedXY if distXY > 0 else 0, distZ / speedZ if distZ > 0 else 0) * 1000
            duration = max(duration, 200)
            # Broadcast animation start BEFORE moving
            try:
                from server.event_stream import bus
                bus.publish('position:moving', {'x': x, 'y': y, 'z': z, 'sx': sx, 'sy': sy, 'sz': sz, 'duration': duration})
            except: pass
            stage.move_absolute(x, y, z, feedrate=feedrate)
            t0 = time.time()
            stage.finish_moves()
            dt = time.time() - t0
            print(f'  > Move X{x} Y{y} Z{z} F{feedrate} ({round(dt*1000)}ms)')
            try:
                from server.event_stream import bus
                bus.publish('position:arrived', {'x': x, 'y': y, 'z': z})
            except: pass
            return jsonify({'success': True, 'm400_duration': round(dt, 3)})
        return jsonify({'success': True, 'simulation': True})

    @app.route('/api/move/relative', methods=['POST'])
    def _move_rel():
        data = request.get_json() or {}
        dx, dy, dz = data.get('dx', 0), data.get('dy', 0), data.get('dz', 0)
        feedrate = data.get('feedrate', 3000)
        if stage:
            cur = stage.get_position(as_dict=True)
            sx, sy, sz = cur.get('X', 0), cur.get('Y', 0), cur.get('Z', 0)
            tx, ty, tz = sx + dx, sy + dy, sz + dz
            import math
            distXY = math.sqrt(dx**2 + dy**2)
            distZ = abs(dz)
            speedXY = feedrate / 60
            speedZ = min(feedrate / 60, 5)
            duration = max(distXY / speedXY if distXY > 0 else 0, distZ / speedZ if distZ > 0 else 0) * 1000
            duration = max(duration, 200)
            try:
                from server.event_stream import bus
                bus.publish('position:moving', {'x': tx, 'y': ty, 'z': tz, 'sx': sx, 'sy': sy, 'sz': sz, 'duration': duration})
            except: pass
            stage.move_relative(dx, dy, dz, feedrate=feedrate)
            t0 = time.time()
            stage.finish_moves()
            dt = time.time() - t0
            print(f'  > Rel dX{dx} dY{dy} dZ{dz} F{feedrate} ({round(dt*1000)}ms)')
            try:
                from server.event_stream import bus
                bus.publish('position:arrived', {'x': tx, 'y': ty, 'z': tz})
            except: pass
            return jsonify({'success': True, 'm400_duration': round(dt, 3)})
        return jsonify({'success': True, 'simulation': True})

    @app.route('/api/home', methods=['POST'])
    def _home():
        if stage:
            stage.home()
            print('  > Home')
            try:
                from server.event_stream import bus
                bus.publish('position:homed', {})
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
            return jsonify({'success': False, 'error': f'Commande bloquée: {command.split()[0]}'})
        if stage:
            lines = stage.send_gcode(command, wait_ok=True)
            return jsonify({'success': True, 'response': lines})
        return jsonify({'success': True, 'response': [f'[SIM] {command}', 'ok']})

    @app.route('/api/emergency_stop', methods=['POST'])
    def _estop():
        global stage
        if stage:
            try:
                stage.send_gcode("M410")
                time.sleep(0.1)
                stage.send_gcode("M114")
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


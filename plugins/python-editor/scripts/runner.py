import io, sys, traceback
_globals = {}
_running = False


class _SimStage:
    """Stage simulé — délègue au movement module via l'API HTTP."""
    def __init__(self):
        self.position = {'X': 0.0, 'Y': 0.0, 'Z': 0.0}
        self._base = 'http://localhost:5000'

    def _call(self, endpoint, body):
        import urllib.request, json, time
        req = urllib.request.Request(
            self._base + endpoint,
            data=json.dumps({k: float(v) if hasattr(v, 'item') else v for k, v in body.items()}).encode(),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                data = json.loads(r.read())
            duration = data.get('duration', data.get('m400_duration', 0.3))
            time.sleep(max(float(duration), 0.05))
            self._sync_position()
        except Exception:
            pass

    def _sync_position(self):
        try:
            from server import state_store
            p = state_store.load_state().get('position', {})
            self.position = {'X': p.get('x', 0.0), 'Y': p.get('y', 0.0), 'Z': p.get('z', 0.0)}
        except Exception:
            pass

    def move_absolute(self, x, y, z, feedrate=3000):
        self._call('/api/move/absolute', {'x': x, 'y': y, 'z': z, 'feedrate': feedrate})

    def move_relative(self, dx, dy, dz, feedrate=3000):
        self._call('/api/move/relative', {'dx': dx, 'dy': dy, 'dz': dz, 'feedrate': feedrate})

    def get_position(self, as_dict=False):
        self._sync_position()
        if as_dict:
            return self.position
        return self.position['X'], self.position['Y'], self.position['Z']

    def send_gcode(self, command, wait_ok=True):
        print(f'[sim] {command}')
        return ['ok']

    def home(self):
        self._call('/api/move/absolute', {'x': 0, 'y': 0, 'z': 0, 'feedrate': 3000})

    def safe_home(self):
        self._call('/api/move/absolute', {'x': 0, 'y': 0, 'z': self.position.get('Z', 0), 'feedrate': 3000})

    def move_towards(self, direction, distance, feedrate=3000):
        _map = {'north': (0,1,0), 'south': (0,-1,0), 'east': (1,0,0), 'west': (-1,0,0), 'up': (0,0,1), 'down': (0,0,-1)}
        dx, dy, dz = [v * distance for v in _map[direction.lower()]]
        self._call('/api/move/relative', {'dx': dx, 'dy': dy, 'dz': dz, 'feedrate': feedrate})

    def move_axis(self, axis, distance, feedrate=3000):
        d = {'x': (distance,0,0), 'y': (0,distance,0), 'z': (0,0,distance)}[axis.lower()]
        self._call('/api/move/relative', {'dx': d[0], 'dy': d[1], 'dz': d[2], 'feedrate': feedrate})

    def set_speed(self, speed):
        self._call('/api/move/relative', {'dx': 0, 'dy': 0, 'dz': 0, 'feedrate': speed})

    def finish_moves(self):
        import time; time.sleep(0.1)

    def __repr__(self):
        self._sync_position()
        return f"<SimStage X={self.position['X']} Y={self.position['Y']} Z={self.position['Z']}>"


class _ApiStage:
    """Wrapper pour le vrai stage — passe par les routes HTTP pour que le frontend suive."""
    def __init__(self, real_stage):
        self._stage = real_stage
        self._base = 'http://localhost:5000'

    def _call(self, endpoint, body):
        import urllib.request, json, time
        req = urllib.request.Request(
            self._base + endpoint,
            data=json.dumps({k: float(v) if hasattr(v, 'item') else v for k, v in body.items()}).encode(),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read())
            duration = data.get('duration', data.get('m400_duration', 0.05))
            time.sleep(max(float(duration) * 0.1, 0.05))  # small extra buffer
        except Exception:
            pass

    def move_absolute(self, x, y, z, feedrate=3000):
        self._call('/api/move/absolute', {'x': x, 'y': y, 'z': z, 'feedrate': feedrate})

    def move_relative(self, dx, dy, dz, feedrate=3000):
        self._call('/api/move/relative', {'dx': dx, 'dy': dy, 'dz': dz, 'feedrate': feedrate})

    def get_position(self, as_dict=False):
        return self._stage.get_position(as_dict=as_dict)

    def send_gcode(self, command, wait_ok=True):
        return self._stage.send_gcode(command, wait_ok=wait_ok)

    def home(self):
        self._call('/api/move/absolute', {'x': 0, 'y': 0, 'z': 0, 'feedrate': 3000})

    def safe_home(self):
        p = self._stage.position
        self._call('/api/move/absolute', {'x': 0, 'y': 0, 'z': p.get('Z', 0), 'feedrate': 3000})

    def move_towards(self, direction, distance, feedrate=3000):
        _map = {'north': (0,1,0), 'south': (0,-1,0), 'east': (1,0,0), 'west': (-1,0,0), 'up': (0,0,1), 'down': (0,0,-1)}
        dx, dy, dz = [v * distance for v in _map[direction.lower()]]
        self._call('/api/move/relative', {'dx': dx, 'dy': dy, 'dz': dz, 'feedrate': feedrate})

    def move_axis(self, axis, distance, feedrate=3000):
        d = {'x': (distance,0,0), 'y': (0,distance,0), 'z': (0,0,distance)}[axis.lower()]
        self._call('/api/move/relative', {'dx': d[0], 'dy': d[1], 'dz': d[2], 'feedrate': feedrate})

    def set_speed(self, speed):
        self._stage.set_speed(speed)

    def finish_moves(self):
        self._stage.finish_moves()

    def send_gcode(self, command, wait_ok=True):
        return self._stage.send_gcode(command, wait_ok=wait_ok)

    def __repr__(self):
        p = self._stage.position
        return f"<Stage X={p['X']} Y={p['Y']} Z={p['Z']}>"


def _get_stage():
    mod = sys.modules.get('server.stage_connection') or sys.modules.get('stage_connection')
    if mod and getattr(mod, 'stage', None) is not None:
        return _ApiStage(mod.stage)
    return _SimStage()

class _CamProxy:
    """Camera proxy — capture via HTTP API."""
    def __init__(self):
        self._base = 'http://localhost:5000'

    def _post(self, endpoint, body=None):
        import urllib.request, json
        req = urllib.request.Request(
            self._base + endpoint,
            data=json.dumps(body or {}).encode(),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())

    def _get(self, endpoint):
        import urllib.request, json
        with urllib.request.urlopen(self._base + endpoint, timeout=5) as r:
            return json.loads(r.read())

    def capture(self, path=None):
        """Capture image. If path given → save to disk, else → return base64."""
        return self._post('/api/camera/picam/capture', {'path': path} if path else {})

    def set_exposure(self, value):
        return self._post('/api/camera/picam/config', {'exposure': int(value)})

    def set_gain(self, value):
        return self._post('/api/camera/picam/config', {'gain': float(value)})

    def set_resolution(self, w, h):
        return self._post('/api/camera/picam/config', {'resolution': [w, h]})

    @property
    def config(self):
        return self._get('/api/camera/picam/config')

    def __repr__(self):
        try:
            cfg = self.config
            return f"<Camera {cfg['resolution'][0]}×{cfg['resolution'][1]} exp={cfg['exposure']} gain={cfg['gain']}>"
        except:
            return '<Camera (unavailable)>'


class _LightProxy:
    """Light proxy — control via HTTP API."""
    def __init__(self):
        self._base = 'http://localhost:5000'

    def _post(self, endpoint, body=None):
        import urllib.request, json
        req = urllib.request.Request(
            self._base + endpoint,
            data=json.dumps(body or {}).encode(),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read())

    def on(self, intensity=None, r=None, g=None, b=None, id=None):
        body = {}
        if id is not None: body['id'] = id
        if intensity is not None: body['intensity'] = intensity
        if r is not None: body['r'] = r
        if g is not None: body['g'] = g
        if b is not None: body['b'] = b
        return self._post('/api/light/on', body)

    def off(self, id=None):
        return self._post('/api/light/off', {'id': id} if id else {})

    def set_intensity(self, value, id=None):
        body = {'intensity': float(value)}
        if id is not None: body['id'] = id
        return self._post('/api/light/intensity', body)

    def set_color(self, r, g, b, id=None):
        body = {'r': r, 'g': g, 'b': b}
        if id is not None: body['id'] = id
        return self._post('/api/light/color', body)

    def toggle(self, id=None):
        return self._post('/api/light/toggle', {'id': id} if id else {})

    def __repr__(self):
        return '<Light proxy>'


class _ListsProxy:
    """Lists proxy — add/remove/clear positions via HTTP API."""
    def __init__(self):
        self._base = 'http://localhost:5000'

    def _post(self, endpoint, body=None):
        import urllib.request, json
        req = urllib.request.Request(
            self._base + endpoint,
            data=json.dumps(body or {}).encode(),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read())

    def _get(self, endpoint):
        import urllib.request, json
        with urllib.request.urlopen(self._base + endpoint, timeout=5) as r:
            return json.loads(r.read())

    def add(self, x, y, z, name='', list=None):
        """Add a position to the active list (or named list)."""
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
        """Return all lists with their positions."""
        return self._get('/api/lists').get('groups', [])

    def get(self, name):
        """Return positions of a named list."""
        groups = self.all
        g = next((g for g in groups if g['name'] == name), None)
        return g['positions'] if g else []

    def __repr__(self):
        try:
            groups = self.all
            return f"<Lists {[g['name'] + '(' + str(len(g['positions'])) + ')' for g in groups]}>"
        except:
            return '<Lists proxy>'


def _build_globals():
    """Injecte les objets disponibles dans le kernel à chaque run."""
    if '__builtins__' not in _globals:
        import builtins
        _globals['__builtins__'] = builtins
    _globals['stage'] = _get_stage()
    _globals['cam'] = _CamProxy()
    _globals['light'] = _LightProxy()
    _globals['lists'] = _ListsProxy()
    try:
        import numpy as np
        _globals['np'] = np
    except ImportError:
        pass
    try:
        import cv2
        _globals['cv2'] = cv2
    except ImportError:
        pass

def _action_run(params):
    global _globals, _running
    script = params.get('script', '')
    if not script.strip():
        return {'success': True, 'output': ''}
    _running = True
    _build_globals()
    buf = io.StringIO()
    old_stdout, old_stderr = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = buf
    try:
        exec(compile(script, '<python-editor>', 'exec'), _globals)
        return {'success': True, 'output': buf.getvalue()}
    except Exception:
        return {'success': False, 'output': buf.getvalue(), 'error': traceback.format_exc()}
    finally:
        sys.stdout, sys.stderr = old_stdout, old_stderr
        _running = False

def _action_reset(params=None):
    global _globals
    _globals = {}
    return {'success': True}

def _action_context(params=None):
    stage = _get_stage()
    is_sim = isinstance(stage, _SimStage)
    ctx = {
        'stage': True,
        'stage_sim': is_sim,
        'stage_port': 'simulator' if is_sim else getattr(stage, 'port', None),
        'stage_position': stage.get_position(as_dict=True),
        'cam': True,
        'light': True,
        'lists': True,
        'np': 'np' in _globals,
        'cv2': 'cv2' in _globals,
        'user_vars': [k for k in _globals if not k.startswith('_') and k not in ('stage', 'cam', 'light', 'lists', 'np', 'cv2')],
    }
    return {'success': True, 'context': ctx}

ACTIONS = {
    '/run':     _action_run,
    '/reset':   _action_reset,
    '/context': _action_context,
}

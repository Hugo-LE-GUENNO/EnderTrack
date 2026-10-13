"""
smart-vision/scripts/vision.py
Server-side script runner for Smart Vision plugin.

In user scripts:
  - `frame`  : numpy BGR array (current camera frame)
  - `stage`  : Stage instance — stage.move_relative(dx, dy, dz), stage.move_absolute(x,y,z),
                                 stage.get_position(), stage.send_gcode('G28')
  - `result` : dict to fill — result['overlay'], result['move'], result['log'], result['extra']
  - `np`, `cv2` available automatically
"""

import traceback
import base64
import numpy as np

# ── shared state ──────────────────────────────────────────────────────────────
_user_script  = ""
_user_globals = {}
_last_frame   = None   # numpy BGR array pushed by the browser


DEFAULT_SCRIPT = """\
import cv2

# Available objects:
#   frame  — numpy BGR array from camera
#   stage  — stage.move_relative(dx, dy, dz, feedrate=1000)
#             stage.move_absolute(x, y, z, feedrate=3000)
#             stage.get_position()  -> {'X':..., 'Y':..., 'Z':...}
#   result — fill with: overlay, move, log, extra

gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
_, thresh = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

overlay = []
for c in contours:
    if cv2.contourArea(c) < 200:
        continue
    M = cv2.moments(c)
    if M['m00'] == 0:
        continue
    cx = int(M['m10'] / M['m00'])
    cy = int(M['m01'] / M['m00'])
    overlay.append({'type': 'circle', 'x': cx, 'y': cy, 'r': 12, 'color': '#00ff88'})

result['overlay'] = overlay
result['log'] = f'{len(overlay)} object(s) detected'
"""


def _get_frame_array():
    """Return latest frame: browser-pushed frame first, then picamera fallback."""
    global _last_frame
    if _last_frame is not None:
        return _last_frame
    # Fallback: picamera2
    try:
        from server import picamera_handler
        _, output = picamera_handler._get_picam()
        if output and output.frame:
            buf = np.frombuffer(output.frame, dtype=np.uint8)
            import cv2
            return cv2.imdecode(buf, cv2.IMREAD_COLOR)
    except Exception:
        pass
    return None


def _get_stage():
    """Return the live Stage instance (same object EnderTrack uses)."""
    try:
        from server import stage_connection
        return stage_connection.stage  # may be None if not connected
    except Exception:
        return None


def _run_script(script, frame, stage):
    import io, sys
    result = {'overlay': [], 'move': None, 'log': '', 'extra': {}}
    globs = dict(_user_globals)
    globs.update({'frame': frame, 'stage': stage, 'result': result, 'np': np})
    try:
        import cv2
        globs['cv2'] = cv2
    except ImportError:
        pass
    # Capture stdout (print)
    buf = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = buf
    try:
        exec(compile(script, '<smart-vision>', 'exec'), globs)
    finally:
        sys.stdout = old_stdout
    printed = buf.getvalue().strip()
    if printed:
        result['log'] = (result['log'] + '\n' + printed).strip() if result['log'] else printed
    # Persist user-defined variables
    skip = {'frame', 'stage', 'result', 'np', 'cv2'}
    for k, v in globs.items():
        if k.startswith('_') or k in skip:
            continue
        try:
            if not isinstance(v, np.ndarray):
                _user_globals[k] = v
        except Exception:
            pass
    return result


# ── ACTIONS ───────────────────────────────────────────────────────────────────

def _action_run(params):
    script = params.get('script', _user_script) or DEFAULT_SCRIPT
    frame  = _get_frame_array()  # may be None — script can check
    stage  = _get_stage()
    try:
        result = _run_script(script, frame, stage)
        return {'success': True, **result}
    except Exception:
        return {'success': False, 'error': traceback.format_exc()}


def _action_set_script(params):
    global _user_script
    _user_script = params.get('script', '')
    return {'success': True}


def _action_get_script(params=None):
    return {'success': True, 'script': _user_script or DEFAULT_SCRIPT}


def _action_reset(params=None):
    global _user_globals, _last_frame
    _user_globals = {}
    _last_frame = None
    return {'success': True}


def _action_push_frame(params):
    """Receive a JPEG frame (base64) from the browser and store it."""
    global _last_frame
    b64 = params.get('frame', '')
    if not b64:
        return {'success': False, 'error': 'No frame data'}
    try:
        buf = np.frombuffer(base64.b64decode(b64), dtype=np.uint8)
        import cv2
        _last_frame = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}


ACTIONS = {
    '/run':         _action_run,
    '/push-frame':  _action_push_frame,
    '/set-script':  _action_set_script,
    '/get-script':  _action_get_script,
    '/reset':       _action_reset,
}

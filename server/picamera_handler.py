# server/picamera_handler.py — Picamera2 MJPEG stream and capture
"""
Provides MJPEG streaming and high-quality capture via Picamera2.
Only loaded if picamera2 is available (Raspberry Pi).
"""

import io
import os
import json
import time
import threading

try:
    from picamera2 import Picamera2
    from picamera2.encoders import MJPEGEncoder
    from picamera2.outputs import FileOutput
    HAS_PICAMERA2 = True
except ImportError:
    HAS_PICAMERA2 = False


class StreamingOutput(io.BufferedIOBase):
    """Thread-safe MJPEG frame buffer."""
    def __init__(self):
        self.frame = None
        self.condition = threading.Condition()

    def write(self, buf):
        with self.condition:
            self.frame = buf
            self.condition.notify_all()
        return len(buf)


_picam = None
_stream_output = None
_config = {
    'resolution': [1280, 720],
    'exposure': 100000,
    'gain': 1.0,
    'pixel_size': 1.0,
    'pixel_size_ref_res': [640, 480],
    'rotation': 0,
    'flip_h': False,
    'flip_v': False,
    'format': 'tiff'
}
_CONFIG_FILE = os.path.join(os.getcwd(), '.picam_config.json')


def _load_config():
    global _config
    if os.path.isfile(_CONFIG_FILE):
        try:
            with open(_CONFIG_FILE, 'r') as f:
                saved = json.load(f)
                _config.update(saved)
        except:
            pass


def _save_config():
    try:
        with open(_CONFIG_FILE, 'w') as f:
            json.dump(_config, f, indent=2)
    except:
        pass


def _get_picam():
    global _picam, _stream_output
    if _picam is None and HAS_PICAMERA2:
        _load_config()
        _picam = Picamera2()
        res = tuple(_config['resolution'])
        cfg = _picam.create_video_configuration(
            main={'format': 'RGB888', 'size': res},
            lores={'size': (min(640, res[0]), min(480, res[1])), 'format': 'YUV420'}
        )
        _picam.configure(cfg)
        _stream_output = StreamingOutput()
        _picam.start_recording(MJPEGEncoder(), FileOutput(_stream_output))
        time.sleep(0.5)
        # Apply saved controls
        controls = {
            'ExposureTime': int(_config['exposure']),
            'AnalogueGain': float(_config['gain']),
            'FrameDurationLimits': (100, max(100000, int(_config['exposure']) + 100000))
        }
        _picam.set_controls(controls)
        print(f"  📷 Picamera2: {res[0]}×{res[1]} exp={_config['exposure']} gain={_config['gain']}")
    return _picam, _stream_output


def _restart_camera(new_res):
    """Restart camera with new resolution."""
    global _picam, _stream_output
    if _picam:
        _picam.stop_recording()
        _picam.stop()
        _picam.close()
        _picam = None
        _stream_output = None
    _config['resolution'] = list(new_res)
    _save_config()
    _get_picam()


def register_routes(app):
    """Register picamera2 routes if available."""
    if not HAS_PICAMERA2:
        print("  ⚠️  picamera2 not available — camera routes disabled")
        return

    from flask import Response, request, jsonify

    _load_config()

    @app.route('/api/camera/picam/stream')
    def _picam_stream():
        """MJPEG stream from picamera2."""
        _, output = _get_picam()
        if not output:
            return "No camera", 503

        def generate():
            while True:
                with output.condition:
                    output.condition.wait()
                    frame = output.frame
                if frame:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

        return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

    @app.route('/api/camera/picam/frame')
    def _picam_frame():
        """Return latest JPEG frame as binary (for polling)."""
        _, output = _get_picam()
        if not output or not output.frame:
            return "No frame", 503
        return Response(output.frame, mimetype='image/jpeg',
                        headers={'Cache-Control': 'no-cache, no-store'})

    @app.route('/api/camera/picam/capture', methods=['POST'])
    def _picam_capture():
        """Capture a full-resolution frame and save."""
        import numpy as np
        import base64

        picam, _ = _get_picam()
        if not picam:
            return jsonify({'error': 'No camera'}), 503

        data = request.get_json() or {}
        path = data.get('path', '')
        fmt = data.get('format', _config.get('format', 'tiff'))

        # Capture raw array
        arr = picam.capture_array("main")

        if path:
            from PIL import Image
            img = Image.fromarray(arr)
            # Apply rotation
            rot = _config.get('rotation', 0)
            if rot:
                img = img.rotate(-rot, expand=True)
            # Apply flip
            if _config.get('flip_h'):
                img = img.transpose(Image.FLIP_LEFT_RIGHT)
            if _config.get('flip_v'):
                img = img.transpose(Image.FLIP_TOP_BOTTOM)
            # Convert to grayscale for TIFF
            if fmt in ('tiff', 'tif'):
                img = img.convert('L')

            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
            img.save(path, compression='tiff_deflate' if fmt in ('tiff', 'tif') else None)
            print(f"  📷 Capture: {path} ({img.size[0]}×{img.size[1]})")
            return jsonify({'success': True, 'path': path, 'width': img.size[0], 'height': img.size[1]})

        # Return as base64 JPEG for live preview
        from PIL import Image
        img = Image.fromarray(arr)
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=80)
        b64 = base64.b64encode(buf.getvalue()).decode('ascii')
        return jsonify({'success': True, 'frame': b64, 'width': arr.shape[1], 'height': arr.shape[0]})

    @app.route('/api/camera/picam/config', methods=['GET'])
    def _picam_config_get():
        """Get current camera config."""
        return jsonify(_config)

    @app.route('/api/camera/picam/config', methods=['POST'])
    def _picam_config_set():
        """Set camera controls and config."""
        picam, _ = _get_picam()
        data = request.get_json() or {}
        restart_needed = False

        # Resolution change requires restart
        if 'resolution' in data:
            new_res = data['resolution']
            if new_res != _config['resolution']:
                restart_needed = True
                _config['resolution'] = new_res

        # Update config values
        for key in ('pixel_size', 'pixel_size_ref_res', 'rotation', 'flip_h', 'flip_v', 'format'):
            if key in data:
                _config[key] = data[key]

        # Apply camera controls
        controls = {}
        if 'exposure' in data:
            exp = int(data['exposure'])
            _config['exposure'] = exp
            controls['ExposureTime'] = exp
            controls['FrameDurationLimits'] = (100, max(100000, exp + 100000))
        if 'gain' in data:
            g = float(data['gain'])
            _config['gain'] = g
            controls['AnalogueGain'] = g

        if restart_needed:
            _restart_camera(tuple(_config['resolution']))
        elif controls and picam:
            try:
                picam.set_controls(controls)
            except Exception as e:
                print(f"  ⚠️ set_controls: {e}")

        _save_config()
        return jsonify({'success': True, 'config': _config})

    @app.route('/api/camera/picam/autofocus', methods=['POST'])
    def _picam_autofocus():
        """Run 3-phase autofocus."""
        import numpy as np
        import requests as http_req
        from server.autofocus import Autofocus

        picam, _ = _get_picam()
        if not picam:
            return jsonify({'error': 'No camera'}), 503

        data = request.get_json() or {}
        na = float(data.get('na', 0.25))
        settle = int(data.get('settle_ms', 200))
        min_step = float(data.get('min_step_mm', 0.01))
        z_min = float(data.get('z_min', -2.0))
        z_max = float(data.get('z_max', 2.0))

        # Get current Z from state
        try:
            r = http_req.get('http://localhost:5000/api/position', timeout=5)
            current_z = float(r.json().get('position', {}).get('z', 0.0))
        except:
            current_z = 0.0

        af = Autofocus(na=na, settle_ms=settle, min_step_mm=min_step)

        def capture_func():
            arr = picam.capture_array("main")
            return arr

        def move_z_func(dz_mm):
            try:
                http_req.post('http://localhost:5000/api/move/relative',
                    json={'dx': 0, 'dy': 0, 'dz': round(dz_mm, 4), 'feedrate': 3000},
                    timeout=30)
            except Exception as e:
                print(f"  ⚠️ AF move_z error: {e}")

        print(f"  🔬 Autofocus start z={current_z:.3f} range=[{z_min},{z_max}]")
        ok, best_z, score = af.search(capture_func, move_z_func, z_min, z_max, current_z)
        print(f"  🔬 Autofocus {'✅' if ok else '❌'} z={best_z:.4f} score={score:.2f}")
        return jsonify({'success': ok, 'best_z': best_z, 'score': score})

    print("  ✅ Picamera2 routes registered")

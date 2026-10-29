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
_camera_lock = threading.RLock()
_config = {
    'resolution': [1280, 720],
    'exposure': 100000,
    'gain': 1.0,
    'pixel_size': 1.0,
    'pixel_size_ref_res': [640, 480],
    'rotation': 0,
    'flip_h': False,
    'flip_v': False,
    'format': 'tiff',
    'color_mode': 'gray',
    'stream_format': 'RGB888'  # RGB888 | BGR888
}
_CONFIG_FILE = os.path.join(os.getcwd(), '.picam_config.json')


def _load_config():
    global _config
    if os.path.isfile(_CONFIG_FILE):
        try:
            with open(_CONFIG_FILE, 'r') as f:
                saved = json.load(f)
                if not saved.get('exposure'): saved.pop('exposure', None)  # ignore exposure=0
                saved.pop('gain', None)  # always start at minimum gain
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
    with _camera_lock:
        if _picam is None and HAS_PICAMERA2:
            _load_config()
            _picam = Picamera2()
            res = tuple(_config['resolution'])
            cfg = _picam.create_video_configuration(
                main={'format': _config.get('stream_format', 'RGB888'), 'size': res},
                lores={'size': (min(640, res[0]), min(480, res[1])), 'format': 'YUV420'}
            )
            _picam.configure(cfg)
            _stream_output = StreamingOutput()
            _picam.start_recording(MJPEGEncoder(), FileOutput(_stream_output))
            time.sleep(0.5)
            try:
                _config['sensor'] = _picam.camera_properties.get('Model', '')
            except: pass
            controls = {
                'ExposureTime': int(_config['exposure']),
                'AnalogueGain': float(_config['gain']),
            }
            _picam.set_controls(controls)
            print(f"   Picamera2: {res[0]}×{res[1]} exp={_config['exposure']} gain={_config['gain']}")
        return _picam, _stream_output


def _restart_camera(new_res=None):
    """Restart camera with new resolution/format."""
    global _picam, _stream_output
    with _camera_lock:
        if _picam:
            try: _picam.stop_recording()
            except: pass
            try: _picam.stop()
            except: pass
            try: _picam.close()
            except: pass
            _picam = None
            _stream_output = None
        if new_res:
            _config['resolution'] = list(new_res)
        _save_config()
        time.sleep(0.5)
        if HAS_PICAMERA2:
            _load_config()
            _picam = Picamera2()
            res = tuple(_config['resolution'])
            cfg = _picam.create_video_configuration(
                main={'format': _config.get('stream_format', 'RGB888'), 'size': res},
                lores={'size': (min(640, res[0]), min(480, res[1])), 'format': 'YUV420'}
            )
            _picam.configure(cfg)
            _stream_output = StreamingOutput()
            _picam.start_recording(MJPEGEncoder(), FileOutput(_stream_output))
            time.sleep(0.5)
            _picam.set_controls({
                'ExposureTime': int(_config['exposure']),
                'AnalogueGain': float(_config['gain']),
            })
            print(f"   Picamera2 restart: {res[0]}x{res[1]}")


def capture(path, fmt=None):
    """Capture une image et la sauvegarde. Retourne {'success': True, 'path': path} ou {'success': False, 'error': ...}."""
    if not HAS_PICAMERA2:
        return {'success': False, 'error': 'picamera2 not available'}
    picam, _ = _get_picam()
    if not picam:
        return {'success': False, 'error': 'Camera not initialized'}
    try:
        from PIL import Image
        fmt = fmt or _config.get('format', 'tiff')
        arr = picam.capture_array("main")
        img = Image.fromarray(arr)
        rot = _config.get('rotation', 0)
        if rot:
            img = img.rotate(-rot, expand=True)
        if _config.get('flip_h'):
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
        if _config.get('flip_v'):
            img = img.transpose(Image.FLIP_TOP_BOTTOM)
        if fmt in ('tiff', 'tif'):
            img = img.convert('L')
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        img.save(path, compression='tiff_deflate' if fmt in ('tiff', 'tif') else None)
        return {'success': True, 'path': path}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def register_routes(app):
    """Register picamera2 routes if available."""
    from flask import Response, request, jsonify

    @app.route('/api/camera/picam/devices')
    def _picam_devices():
        if not HAS_PICAMERA2:
            return jsonify({'devices': []})
        try:
            from picamera2 import Picamera2
            infos = Picamera2.global_camera_info()
            devices = [{'id': str(i), 'name': info.get('Model', f'Camera {i}')} for i, info in enumerate(infos)]
        except Exception as e:
            devices = []
        return jsonify({'devices': devices})

    if not HAS_PICAMERA2:
        return

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
        import traceback

        picam, _ = _get_picam()
        if not picam:
            return jsonify({'error': 'No camera'}), 503

        try:
            data = request.get_json() or {}
            path = data.get('path', '')
            fmt = data.get('format', _config.get('format', 'tiff'))
            cap_exp = data.get('exposure')
            cap_gain = data.get('gain')
            cap_res = data.get('resolution')  # e.g. [4056, 3040]

            # Save live settings
            live_exp = _config.get('exposure', 0)
            live_gain = _config.get('gain', 1.0)
            live_res = list(_config.get('resolution', [1280, 720]))

            # Restart camera at capture resolution if different
            if cap_res and list(cap_res) != live_res:
                with _camera_lock:
                    try: picam.stop_recording()
                    except: pass
                    try: picam.stop()
                    except: pass
                    cfg = picam.create_still_configuration(
                        main={'format': _config.get('stream_format', 'RGB888'), 'size': tuple(cap_res)}
                    )
                    picam.configure(cfg)
                    picam.start()
                    time.sleep(0.5)

            # Apply capture settings if provided
            cap_controls = {}
            if cap_exp and int(cap_exp) > 0:
                cap_controls['ExposureTime'] = int(cap_exp)
            if cap_gain and float(cap_gain) > 0:
                cap_controls['AnalogueGain'] = float(cap_gain)
            if cap_controls:
                picam.set_controls(cap_controls)

            # Wait for exposure to complete (exposure time + 2 frames margin)
            eff_exp = cap_controls.get('ExposureTime', live_exp)
            if eff_exp > 0:
                time.sleep(eff_exp / 1_000_000 + 0.2)

            # Capture
            arr = picam.capture_array("main")

            # Restore live settings
            if cap_res and list(cap_res) != live_res:
                _restart_camera(tuple(live_res))
                picam, _ = _get_picam()
            else:
                picam.set_controls({'ExposureTime': live_exp, 'AnalogueGain': live_gain})
            if path:
                from PIL import Image
                img = Image.fromarray(arr)
                if data.get('apply_rotation') is True:
                    rot = _config.get('rotation', 0)
                    if rot:
                        img = img.rotate(-rot, expand=True)
                    if _config.get('flip_h'):
                        img = img.transpose(Image.FLIP_LEFT_RIGHT)
                    if _config.get('flip_v'):
                        img = img.transpose(Image.FLIP_TOP_BOTTOM)
                color_mode = data.get('color_mode') or _config.get('color_mode', 'gray')
                if color_mode == 'gray':
                    img = img.convert('L')
                elif color_mode == 'bgr':
                    r, g, b = img.split()
                    img = Image.merge('RGB', (b, g, r))
                # rgb: keep as-is
                os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
                import datetime
                meta = data.get('metadata', {})
                pixel_size = data.get('pixel_size') or _config.get('pixel_size')
                save_metadata = data.get('save_metadata', True)

                if fmt in ('tiff', 'tif'):
                    tiffinfo = {}
                    if pixel_size and float(pixel_size) > 0:
                        ps = float(pixel_size)
                        tiffinfo[270] = f'ImageJ=1.54p\nunit=micron\nspacing={ps}\n'
                        tiffinfo[282] = 1.0 / ps
                        tiffinfo[283] = 1.0 / ps
                        tiffinfo[296] = 1
                    img.save(path, compression='tiff_deflate', tiffinfo=tiffinfo)
                else:
                    img.save(path)

                if save_metadata:
                    stage = data.get('stage')
                    yaml_path = os.path.splitext(path)[0] + '.yaml'
                    with open(yaml_path, 'w') as f:
                        f.write(f"image: {os.path.basename(path)}\n")
                        f.write(f"date: {datetime.datetime.now().strftime('%Y-%m-%dT%H:%M:%S')}\n")
                        f.write(f"pixel_size_um: {float(pixel_size) if pixel_size else 'null'}\n")
                        f.write(f"sensor: {_config.get('sensor', '')}\n")
                        f.write(f"exposure_us: {cap_controls.get('ExposureTime', live_exp)}\n")
                        f.write(f"gain: {round(cap_controls.get('AnalogueGain', live_gain), 3)}\n")
                        f.write(f"width: {img.size[0]}\n")
                        f.write(f"height: {img.size[1]}\n")
                        f.write(f"bit_depth: {arr.dtype}\n")
                        f.write(f"color_mode: {color_mode}\n")
                        f.write(f"format: {fmt}\n")
                        if stage:
                            f.write(f"stage:\n  x: {stage.get('x')}\n  y: {stage.get('y')}\n  z: {stage.get('z')}\n")
                        if meta:
                            f.write("custom:\n")
                            for k, v in meta.items():
                                f.write(f"  {k}: {v}\n")
                print(f"   Capture: {path} ({img.size[0]}x{img.size[1]}) {color_mode}")
                return jsonify({'success': True, 'path': path, 'width': img.size[0], 'height': img.size[1]})

            # Return as base64 JPEG for live preview
            from PIL import Image
            img = Image.fromarray(arr)
            buf = io.BytesIO()
            img.save(buf, format='JPEG', quality=80)
            b64 = base64.b64encode(buf.getvalue()).decode('ascii')
            return jsonify({'success': True, 'frame': b64, 'width': arr.shape[1], 'height': arr.shape[0]})

        except Exception as e:
            tb = traceback.format_exc()
            print(f"[capture] ERROR: {e}\n{tb}")
            return jsonify({'error': str(e), 'traceback': tb}), 500

    @app.route('/api/camera/picam/config', methods=['GET'])
    def _picam_config_get():
        """Get current camera config."""
        result = dict(_config)
        picam, _ = _get_picam()
        if picam:
            try:
                cc = picam.camera_controls
                if 'ExposureTime' in cc:
                    lim = cc['ExposureTime']
                    if lim[0] > 0 and lim[1] > lim[0]:
                        result['exposure_limits'] = [int(lim[0]), int(lim[1])]
                if 'AnalogueGain' in cc:
                    lim = cc['AnalogueGain']
                    print(f'[picam] AnalogueGain raw limits: {lim}')
                    if lim[0] >= 0 and lim[1] > lim[0]:
                        result['gain_limits'] = [float(lim[0]), float(lim[1])]
                        print(f'[picam] gain_limits sent: {result["gain_limits"]}')
                    else:
                        print(f'[picam] gain_limits REJECTED')
            except:
                pass
            try:
                props = picam.camera_properties
                full = props.get('PixelArraySize')
                if full:
                    w, h = int(full[0]), int(full[1])
                    seen, resolutions = set(), []
                    for div in [1, 2, 4, 8]:
                        rw, rh = w // div, h // div
                        if (rw, rh) not in seen and rw >= 320:
                            seen.add((rw, rh))
                            resolutions.append([rw, rh])
                    result['available_resolutions'] = resolutions
                    print(f'[picam] PixelArraySize={full} -> resolutions={resolutions}')
            except Exception as e:
                print(f'[picam] available_resolutions error: {e}')
        return jsonify(result)

    @app.route('/api/camera/picam/config', methods=['POST'])
    def _picam_config_set():
        """Set camera controls and config."""
        picam, _ = _get_picam()
        data = request.get_json() or {}
        restart_needed = False

        # Resolution or stream_format change requires restart
        if 'resolution' in data:
            new_res = data['resolution']
            if new_res != _config['resolution']:
                restart_needed = True
                _config['resolution'] = new_res

        if 'stream_format' in data and data['stream_format'] != _config.get('stream_format', 'RGB888'):
            restart_needed = True

        # Update config values
        for key in ('pixel_size', 'pixel_size_ref_res', 'rotation', 'flip_h', 'flip_v', 'format', 'color_mode', 'stream_format'):
            if key in data:
                _config[key] = data[key]

        # Apply camera controls
        controls = {}
        if 'exposure' in data:
            exp = int(data['exposure'])
            if exp > 0:
                _config['exposure'] = exp
                controls['ExposureTime'] = exp
        if 'gain' in data:
            g = float(data['gain'])
            _config['gain'] = g
            controls['AnalogueGain'] = g

        if restart_needed:
            _restart_camera(tuple(_config['resolution']) if 'resolution' in data else None)
        elif controls and picam:
            try:
                picam.set_controls(controls)
            except Exception as e:
                print(f"  set_controls: {e}")

        _save_config()
        return jsonify({'success': True, 'config': _config})

    @app.route('/api/camera/picam/autofocus', methods=['POST'])
    def _picam_autofocus():
        """Run 3-phase autofocus."""
        import numpy as np
        import requests as http_req
        import importlib
        from server import autofocus as _af_mod
        importlib.reload(_af_mod)
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
                print(f"  ️ AF move_z error: {e}")

        mode = data.get('mode', 'full')
        print(f"  AF start z={current_z:.3f} range=[{z_min},{z_max}] mode={mode}")

        if mode == 'quick':
            import time as _t
            z = current_z
            z, best2_z, _ = af._scan(capture_func, move_z_func, z, af.coarse_step, z_min, z_max, "P2")
            if abs(z - best2_z) > 0.001:
                move_z_func(best2_z - z); z = best2_z; _t.sleep(af.settle_ms / 1000.0)
            move_z_func(af.backlash_mm); z += af.backlash_mm; _t.sleep(af.settle_ms / 1000.0)
            best_score, best_z, drops, prev_score = 0.0, z, 0, 0.0
            for _ in range(int((af.backlash_mm * 2) / af.fine_step)):
                af._move(move_z_func, -af.fine_step); z -= af.fine_step
                score = af._measure(capture_func)
                if score > best_score:
                    best_score = score; best_z = z; drops = 0
                elif score < prev_score:
                    drops += 1
                    if drops >= 3: break
                else:
                    drops = 0
                prev_score = score
            if best_z != z:
                move_z_func(best_z - z); _t.sleep(af.settle_ms / 1000.0)
            ok, score = True, best_score
        else:
            ok, best_z, score = af.search(capture_func, move_z_func, z_min, z_max, current_z)

        print(f"  AF done ok={ok} z={best_z:.4f} score={score:.2f}")
        return jsonify({'success': ok, 'best_z': best_z, 'score': score})

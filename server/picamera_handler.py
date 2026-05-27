# server/picamera_handler.py — Picamera2 MJPEG stream and capture
"""
Provides MJPEG streaming and high-quality capture via Picamera2.
Only loaded if picamera2 is available (Raspberry Pi).
"""

import io
import os
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


def _get_picam():
    global _picam, _stream_output
    if _picam is None and HAS_PICAMERA2:
        _picam = Picamera2()
        config = _picam.create_video_configuration(
            main={"size": (1280, 720), "format": "RGB888"},
            lores={"size": (640, 480), "format": "YUV420"}
        )
        _picam.configure(config)
        _stream_output = StreamingOutput()
        _picam.start_recording(MJPEGEncoder(), FileOutput(_stream_output))
        print("  📷 Picamera2 started (1280x720)")
    return _picam, _stream_output


def register_routes(app):
    """Register picamera2 routes if available."""
    if not HAS_PICAMERA2:
        print("  ⚠️  picamera2 not available — camera routes disabled")
        return

    from flask import Response, request, jsonify

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

    @app.route('/api/camera/picam/capture', methods=['POST'])
    def _picam_capture():
        """Capture a full-resolution frame."""
        import numpy as np
        import base64

        picam, _ = _get_picam()
        if not picam:
            return jsonify({'error': 'No camera'}), 503

        data = request.get_json() or {}
        path = data.get('path', '')

        # Capture raw array
        arr = picam.capture_array("main")
        # arr is RGB888 (H, W, 3) uint8

        if path:
            from PIL import Image
            img = Image.fromarray(arr)
            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
            if path.endswith('.tiff') or path.endswith('.tif'):
                img.save(path, compression='tiff_deflate')
            else:
                img.save(path)
            print(f"  📷 Capture: {path} ({arr.shape[1]}x{arr.shape[0]})")
            return jsonify({'success': True, 'path': path, 'width': arr.shape[1], 'height': arr.shape[0]})

        # Return as base64 for client-side handling
        b64 = base64.b64encode(arr.tobytes()).decode('ascii')
        return jsonify({
            'success': True,
            'width': arr.shape[1],
            'height': arr.shape[0],
            'channels': 3,
            'dtype': 'uint8',
            'data': b64
        })

    @app.route('/api/camera/picam/config', methods=['GET'])
    def _picam_config_get():
        """Get current camera config."""
        picam, _ = _get_picam()
        if not picam:
            return jsonify({'error': 'No camera'}), 503
        controls = picam.camera_controls
        metadata = picam.capture_metadata()
        return jsonify({
            'exposure': metadata.get('ExposureTime', 0),
            'gain': metadata.get('AnalogueGain', 1.0),
            'available_controls': list(controls.keys())
        })

    @app.route('/api/camera/picam/config', methods=['POST'])
    def _picam_config_set():
        """Set camera controls (exposure, gain, etc)."""
        picam, _ = _get_picam()
        if not picam:
            return jsonify({'error': 'No camera'}), 503
        data = request.get_json() or {}
        controls = {}
        if 'exposure' in data:
            controls['ExposureTime'] = int(data['exposure'])
        if 'gain' in data:
            controls['AnalogueGain'] = float(data['gain'])
        if controls:
            picam.set_controls(controls)
        return jsonify({'success': True, 'applied': controls})

    print("  ✅ Picamera2 routes registered")

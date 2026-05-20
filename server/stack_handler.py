# server/stack_handler.py — Multi-page TIFF stack reader
"""
Serves individual pages from multi-page TIFF files for the Stack Viewer.
Uses Pillow (PIL) for TIFF reading.
"""

import os
import io
import json
from flask import request, jsonify, send_file

def register_routes(app):
    """Register stack-related API routes."""

    @app.route('/api/stack/info', methods=['GET'])
    def _stack_info():
        """Get metadata about a TIFF stack (number of pages, dimensions)."""
        filepath = request.args.get('file', '')
        if not filepath:
            return jsonify({'error': 'No file specified'}), 400

        full = os.path.join(os.getcwd(), filepath)
        if not os.path.isfile(full):
            return jsonify({'error': 'File not found'}), 404

        try:
            from PIL import Image
            img = Image.open(full)
            n_pages = 0
            try:
                while True:
                    n_pages += 1
                    img.seek(n_pages)
            except EOFError:
                pass

            img.seek(0)
            width, height = img.size
            mode = img.mode

            return jsonify({
                'file': filepath,
                'pages': n_pages,
                'width': width,
                'height': height,
                'mode': mode,
                'fileSize': os.path.getsize(full)
            })
        except ImportError:
            return jsonify({'error': 'Pillow not installed'}), 500
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/stack/page', methods=['GET'])
    def _stack_page():
        """Serve a single page from a multi-page TIFF as PNG."""
        filepath = request.args.get('file', '')
        index = int(request.args.get('index', 0))

        if not filepath:
            return jsonify({'error': 'No file specified'}), 400

        full = os.path.join(os.getcwd(), filepath)
        if not os.path.isfile(full):
            return jsonify({'error': 'File not found'}), 404

        try:
            from PIL import Image
            img = Image.open(full)
            img.seek(index)

            # Convert to RGB if needed for PNG output
            frame = img.copy()
            if frame.mode == 'I;16':
                # 16-bit → 8-bit (auto-scale)
                import numpy as np
                arr = np.array(frame)
                arr = ((arr - arr.min()) / max(1, arr.max() - arr.min()) * 255).astype('uint8')
                frame = Image.fromarray(arr)
            elif frame.mode not in ('RGB', 'RGBA', 'L'):
                frame = frame.convert('L')

            buf = io.BytesIO()
            frame.save(buf, format='PNG')
            buf.seek(0)
            return send_file(buf, mimetype='image/png')
        except ImportError:
            return jsonify({'error': 'Pillow not installed'}), 500
        except EOFError:
            return jsonify({'error': f'Page {index} not found'}), 404
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/stack/create', methods=['POST'])
    def _stack_create():
        """Create a multi-page TIFF from a list of capture files."""
        data = request.get_json()
        if not data or not data.get('files') or not data.get('output'):
            return jsonify({'error': 'Missing files or output path'}), 400

        files = data['files']
        output = data['output']

        try:
            from PIL import Image
            frames = []
            for f in files:
                full = os.path.join(os.getcwd(), f)
                if os.path.isfile(full):
                    frames.append(Image.open(full))

            if not frames:
                return jsonify({'error': 'No valid files'}), 400

            os.makedirs(os.path.dirname(os.path.abspath(output)), exist_ok=True)
            frames[0].save(output, save_all=True, append_images=frames[1:], compression='tiff_deflate')
            print(f"  📚 Stack créé: {output} ({len(frames)} pages)")
            return jsonify({'success': True, 'path': output, 'pages': len(frames)})
        except ImportError:
            return jsonify({'error': 'Pillow not installed'}), 500
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/stack/settings', methods=['GET'])
    def _stack_settings_get():
        """Load per-channel display settings for a stack file."""
        filepath = request.args.get('file', '')
        if not filepath:
            return jsonify({}), 200
        settings_file = os.path.join(os.getcwd(), '.stack_settings.json')
        try:
            if os.path.isfile(settings_file):
                with open(settings_file, 'r') as f:
                    all_settings = json.load(f)
                return jsonify(all_settings.get(filepath, {}))
        except:
            pass
        return jsonify({}), 200

    @app.route('/api/stack/settings', methods=['POST'])
    def _stack_settings_save():
        """Save per-channel display settings for a stack file."""
        data = request.get_json()
        if not data or not data.get('file'):
            return jsonify({'error': 'No file specified'}), 400
        filepath = data['file']
        settings_file = os.path.join(os.getcwd(), '.stack_settings.json')
        try:
            all_settings = {}
            if os.path.isfile(settings_file):
                with open(settings_file, 'r') as f:
                    all_settings = json.load(f)
            all_settings[filepath] = {
                'channels': data.get('channels', {}),
                'composite': data.get('composite', False)
            }
            with open(settings_file, 'w') as f:
                json.dump(all_settings, f, indent=2)
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/stack/raw', methods=['GET'])
    def _stack_raw():
        """Serve raw pixel data as binary (uint8 or uint16) with metadata header."""
        filepath = request.args.get('file', '')
        index = int(request.args.get('index', 0))

        if not filepath:
            return jsonify({'error': 'No file specified'}), 400

        full = os.path.join(os.getcwd(), filepath)
        if not os.path.isfile(full):
            return jsonify({'error': 'File not found'}), 404

        try:
            from PIL import Image
            import numpy as np
            img = Image.open(full)
            img.seek(index)
            frame = img.copy()
            arr = np.array(frame)

            # Ensure native byte order (little-endian on x86)
            if arr.dtype.byteorder == '>' or (arr.dtype.byteorder == '=' and np.dtype(arr.dtype).byteorder == '>'):
                arr = arr.astype(arr.dtype.newbyteorder('<'))

            # Determine if grayscale or RGB
            if arr.ndim == 2:
                channels = 1
                dtype = 'uint16' if arr.dtype.itemsize == 2 else 'uint8'
            else:
                channels = arr.shape[2]
                dtype = 'uint16' if arr.dtype.itemsize == 2 else 'uint8'

            # Send as JSON with base64-encoded raw data
            import base64
            raw_bytes = arr.tobytes()
            return jsonify({
                'width': arr.shape[1],
                'height': arr.shape[0],
                'channels': channels,
                'dtype': dtype,
                'data': base64.b64encode(raw_bytes).decode('ascii')
            })
        except ImportError:
            return jsonify({'error': 'Pillow/numpy not installed'}), 500
        except EOFError:
            return jsonify({'error': f'Page {index} not found'}), 404
        except Exception as e:
            return jsonify({'error': str(e)}), 500

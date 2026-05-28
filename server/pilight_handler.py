# server/pilight_handler.py — NeoPixel LED control
"""
Multi-light NeoPixel control via GPIO. Shared strip per pin.
Only loaded if neopixel is available (Raspberry Pi with sudo).
"""

import threading

try:
    import neopixel
    import board
    HAS_NEOPIXEL = True
except Exception:
    HAS_NEOPIXEL = False

_lock = threading.Lock()
_strips = {}  # { 'D18': { 'obj': NeoPixel, 'total': N } }
_lights = {}  # { id: { id, name, pin, total_pixels, start, end, r, g, b, intensity, is_on } }
_next_id = 1


def _get_board_pin(pin_name):
    if not HAS_NEOPIXEL:
        return None
    return getattr(board, pin_name, None)


def _get_strip(pin_name, total_pixels):
    if not HAS_NEOPIXEL:
        return None
    if pin_name in _strips:
        strip = _strips[pin_name]
        if total_pixels > strip['total']:
            bp = _get_board_pin(pin_name)
            if bp:
                strip['obj'] = neopixel.NeoPixel(bp, total_pixels, auto_write=False)
                strip['total'] = total_pixels
        return strip['obj']
    else:
        bp = _get_board_pin(pin_name)
        if bp:
            obj = neopixel.NeoPixel(bp, total_pixels, auto_write=False)
            _strips[pin_name] = {'obj': obj, 'total': total_pixels}
            return obj
    return None


def _apply_all():
    with _lock:
        for pin, strip in _strips.items():
            obj = strip['obj']
            if obj:
                for i in range(strip['total']):
                    obj[i] = (0, 0, 0)
        for l in _lights.values():
            strip_obj = _strips.get(l['pin'], {}).get('obj')
            if not strip_obj:
                continue
            if l['is_on']:
                r = min(255, max(0, int(l['r'] * l['intensity'])))
                g = min(255, max(0, int(l['g'] * l['intensity'])))
                b = min(255, max(0, int(l['b'] * l['intensity'])))
                color = (r, g, b)
            else:
                color = (0, 0, 0)
            total = _strips[l['pin']]['total']
            for i in range(l['start'], min(l['end'], total)):
                strip_obj[i] = color
        for strip in _strips.values():
            if strip['obj']:
                try:
                    strip['obj'].show()
                except Exception:
                    pass


def _serialize(l):
    return {k: l[k] for k in ('id', 'name', 'pin', 'total_pixels', 'start', 'end', 'r', 'g', 'b', 'intensity', 'is_on')}


def _find(lid):
    if lid is not None:
        return _lights.get(int(lid))
    if len(_lights) == 1:
        return list(_lights.values())[0]
    return None


def register_routes(app):
    from flask import request, jsonify

    @app.route('/api/light/status')
    def _light_status():
        return jsonify({
            'connected': HAS_NEOPIXEL,
            'backend': 'neopixel' if HAS_NEOPIXEL else 'simulation',
            'lights': [_serialize(l) for l in _lights.values()]
        })

    @app.route('/api/light/add', methods=['POST'])
    def _light_add():
        global _next_id
        data = request.get_json() or {}
        pin = data.get('pin', 'D18')
        total_pixels = int(data.get('total_pixels', 1))
        start = int(data.get('start', 0))
        end = int(data.get('end', total_pixels))
        _get_strip(pin, max(total_pixels, end))
        light = {
            'id': _next_id, 'name': data.get('name', f'Light {_next_id}'),
            'pin': pin, 'total_pixels': total_pixels, 'start': start, 'end': end,
            'r': int(data.get('r', 255)), 'g': int(data.get('g', 255)), 'b': int(data.get('b', 255)),
            'intensity': float(data.get('intensity', 1.0)), 'is_on': False
        }
        _lights[_next_id] = light
        _next_id += 1
        return jsonify({'success': True, 'light': _serialize(light)})

    @app.route('/api/light/remove', methods=['POST'])
    def _light_remove():
        data = request.get_json() or {}
        l = _find(data.get('id'))
        if not l:
            return jsonify({'error': 'not found'}), 404
        l['is_on'] = False
        del _lights[l['id']]
        _apply_all()
        return jsonify({'success': True})

    @app.route('/api/light/toggle', methods=['POST'])
    def _light_toggle():
        data = request.get_json() or {}
        l = _find(data.get('id'))
        if not l:
            return jsonify({'error': 'not found'}), 404
        l['is_on'] = not l['is_on']
        _apply_all()
        return jsonify({'success': True, 'is_on': l['is_on'], 'id': l['id']})

    @app.route('/api/light/on', methods=['POST'])
    def _light_on():
        data = request.get_json() or {}
        l = _find(data.get('id'))
        if not l:
            return jsonify({'error': 'not found'}), 404
        l['is_on'] = True
        if 'intensity' in data:
            l['intensity'] = max(0, min(1, float(data['intensity'])))
        if 'r' in data:
            l['r'] = min(255, max(0, int(data['r'])))
        if 'g' in data:
            l['g'] = min(255, max(0, int(data['g'])))
        if 'b' in data:
            l['b'] = min(255, max(0, int(data['b'])))
        _apply_all()
        return jsonify({'success': True, **_serialize(l)})

    @app.route('/api/light/off', methods=['POST'])
    def _light_off():
        data = request.get_json() or {}
        l = _find(data.get('id'))
        if not l:
            return jsonify({'error': 'not found'}), 404
        l['is_on'] = False
        _apply_all()
        return jsonify({'success': True, 'is_on': False, 'id': l['id']})

    @app.route('/api/light/intensity', methods=['POST'])
    def _light_intensity():
        data = request.get_json() or {}
        l = _find(data.get('id'))
        if not l or 'intensity' not in data:
            return jsonify({'error': 'id + intensity required'}), 400
        l['intensity'] = max(0, min(1, float(data['intensity'])))
        _apply_all()
        return jsonify({'success': True, 'intensity': l['intensity'], 'id': l['id']})

    @app.route('/api/light/color', methods=['POST'])
    def _light_color():
        data = request.get_json() or {}
        l = _find(data.get('id'))
        if not l:
            return jsonify({'error': 'not found'}), 404
        if 'r' in data:
            l['r'] = min(255, max(0, int(data['r'])))
        if 'g' in data:
            l['g'] = min(255, max(0, int(data['g'])))
        if 'b' in data:
            l['b'] = min(255, max(0, int(data['b'])))
        _apply_all()
        return jsonify({'success': True, 'r': l['r'], 'g': l['g'], 'b': l['b'], 'id': l['id']})

    @app.route('/api/light/configure', methods=['POST'])
    def _light_configure():
        data = request.get_json() or {}
        l = _find(data.get('id'))
        if not l:
            return jsonify({'error': 'not found'}), 404
        for k in ('name', 'pin', 'total_pixels', 'start', 'end'):
            if k in data:
                l[k] = int(data[k]) if k in ('total_pixels', 'start', 'end') else data[k]
        _get_strip(l['pin'], max(l['total_pixels'], l['end']))
        _apply_all()
        return jsonify({'success': True, 'light': _serialize(l)})

    # Create default light
    global _next_id
    _get_strip('D18', 1)
    _lights[_next_id] = {
        'id': _next_id, 'name': 'Light 1', 'pin': 'D18',
        'total_pixels': 1, 'start': 0, 'end': 1,
        'r': 255, 'g': 255, 'b': 255, 'intensity': 1.0, 'is_on': False
    }
    _next_id += 1

    print(f"  {'✅' if HAS_NEOPIXEL else '🎮'} PiLight routes registered ({('neopixel' if HAS_NEOPIXEL else 'simulation')})")

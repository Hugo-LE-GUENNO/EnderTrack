"""
plugins/disco/disco.py
🕺 Disco mode — mouvements aléatoires + lumière qui clignote dans tous les sens
"""

import time
import random
import threading

NAME        = "Disco"
VERSION     = "1.0.0"
DESCRIPTION = "Mouvements aléatoires + lumière disco 🕺"

SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "slider", "id": "duration", "label": "Durée (s)",      "min": 2,  "max": 30,  "default": 10,  "step": 1},
            {"type": "slider", "id": "move_amp", "label": "Amplitude (mm)", "min": 1,  "max": 20,  "default": 5,   "step": 1},
            {"type": "slider", "id": "bpm",      "label": "BPM",            "min": 60, "max": 240, "default": 120, "step": 10},
            {"type": "button", "label": "🕺 DISCO", "action": "run", "style": "primary"},
        ],
        "outputs": [
            {"type": "text", "id": "status", "label": "Status"},
        ]
    }
}

_stop_event = threading.Event()
_running = False

SCENARIO_ACTIONS = [
    {
        'id': 'run',
        'label': '🕺 Disco',
        'icon': '🕺',
        'timeout_ms': 45000,
        'params': [
            {'id': 'duration', 'label': 'Durée (s)',      'type': 'number', 'default': 10,  'min': 2,  'max': 30},
            {'id': 'move_amp', 'label': 'Amplitude (mm)', 'type': 'number', 'default': 5,   'min': 1,  'max': 20},
            {'id': 'bpm',      'label': 'BPM',            'type': 'number', 'default': 120, 'min': 60, 'max': 240},
        ]
    }
]

COLORS = [
    (255, 0,   0),
    (0,   255, 0),
    (0,   0,   255),
    (255, 255, 0),
    (0,   255, 255),
    (255, 0,   255),
    (255, 128, 0),
    (255, 255, 255),
]


def run(ctx, params):
    global _running, _stop_event

    ctx.log("Disco start")

    if _running:
        _stop_event.set()
        time.sleep(0.3)

    stage    = ctx.stage
    light    = ctx.light
    duration = float(params.get('duration', 10))
    move_amp = float(params.get('move_amp', 5))
    bpm      = float(params.get('bpm',      120))
    beat     = 60.0 / bpm

    # Vérifier si des lights sont dispo
    st = light.status()
    ctx.log(f"Light status: {st}")
    has_light = bool(st.get('lights'))

    if not stage:
        ctx.update_output('status', '✗ Stage non connecté')
        return {'success': False}

    x0 = stage.position['X']
    y0 = stage.position['Y']
    z0 = stage.position['Z']

    _stop_event.clear()
    _running = True
    ctx.update_output('status', '🕺 DISCO !!!')

    try:
        t_end = time.time() + duration
        while time.time() < t_end and not _stop_event.is_set():
            dx = random.uniform(-move_amp, move_amp)
            dy = random.uniform(-move_amp, move_amp)
            dz = random.uniform(-1, 1)
            stage.move_absolute(x0 + dx, y0 + dy, z0 + dz, feedrate=3000)

            if has_light:
                r, g, b = random.choice(COLORS)
                light.on(r=r, g=g, b=b, intensity=random.uniform(0.3, 1.0))

            time.sleep(beat * 0.5)

            if has_light:
                light.off()

            time.sleep(beat * 0.5)

    finally:
        _running = False
        stage.move_absolute(x0, y0, z0, feedrate=2000)
        if has_light:
            light.off()
        ctx.update_output('status', '✓ Fini')

    return {'success': True}

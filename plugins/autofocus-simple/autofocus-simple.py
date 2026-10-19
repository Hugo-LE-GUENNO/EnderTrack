"""
plugins/autofocus-simple/autofocus-simple.py
Autofocus rapide — scan lineaire, Laplacien numpy, expo forcee courte.
"""

import numpy as np
import time

NAME        = "Autofocus"
VERSION     = "1.1.0"
DESCRIPTION = "Fast autofocus — Z scan, Laplacian variance, adaptive step"

SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "slider", "id": "range",      "label": "Range (mm)",   "min": 0.1,  "max": 10.0, "default": 2.0,  "step": 0.1},
            {"type": "slider", "id": "step_mult",  "label": "Step (x pixel size)", "min": 1, "max": 50, "default": 10, "step": 1},
            {"type": "button", "label": "Autofocus", "action": "run", "style": "primary"},
        ],
        "outputs": [
            {"type": "text",  "id": "status", "label": "Status"},
            {"type": "graph", "id": "curve",  "label": "Focus curve", "xlabel": "Z (mm)", "ylabel": "Score"},
        ]
    }
}

SCENARIO_ACTIONS = [
    {
        'id': 'run',
        'label': 'Autofocus',
        'timeout_ms': 120000,
        'params': [
            {'id': 'range',     'label': 'Range (mm)',        'type': 'number', 'default': 2.0, 'min': 0.1, 'max': 10.0},
            {'id': 'step_mult', 'label': 'Step (x pixel size)', 'type': 'number', 'default': 10,  'min': 1,   'max': 50},
        ]
    }
]


def _score(picam, n_frames=3):
    scores = []
    for _ in range(n_frames):
        arr  = picam.capture_array("main")
        gray = (0.299 * arr[:,:,0] + 0.587 * arr[:,:,1] + 0.114 * arr[:,:,2]).astype(np.float32)
        lap  = (-4*gray[1:-1,1:-1] + gray[:-2,1:-1] + gray[2:,1:-1]
                + gray[1:-1,:-2] + gray[1:-1,2:])
        scores.append(float(lap.var()))
    return float(np.median(scores))


def run(ctx, params):
    stage = ctx.stage
    cam   = ctx.cam
    if not stage:
        ctx.update_output('status', 'Stage not connected')
        return {'success': False}
    if not cam:
        ctx.update_output('status', 'Camera not available')
        return {'success': False}

    picam, _ = cam._get_picam()
    if not picam:
        ctx.update_output('status', 'Camera not started')
        return {'success': False}

    # Pas adaptatif au pixel size
    pixel_size_um = cam._config.get('pixel_size', 1.0)   # µm/px
    step_mult     = float(params.get('step_mult', 10))
    step          = max(0.005, min(1.0, pixel_size_um * step_mult / 1000.0))  # µm → mm

    rng    = float(params.get('range', 2.0))
    z0     = stage.position['Z']
    z_start = round(z0 - rng / 2, 4)
    z_end   = round(z0 + rng / 2, 4)
    n_steps = int(rng / step)

    ctx.update_output('status', f'Scanning {n_steps} steps x {step:.3f}mm')
    ctx.reset_graph('curve')

    stage.move_absolute(stage.position['X'], stage.position['Y'], z_start, feedrate=3000)
    stage.finish_moves()
    time.sleep(0.05)

    best_z, best_score = z_start, -1.0
    z = z_start
    try:
        while z <= z_end + 1e-6:
            score = _score(picam)
            ctx.update_graph('curve', z, score)
            if score > best_score:
                best_score = score
                best_z = z
            z = round(z + step, 4)
            stage.move_absolute(stage.position['X'], stage.position['Y'], z, feedrate=3000)
            stage.finish_moves()
            time.sleep(0.05)
    finally:
        pass

    stage.move_absolute(stage.position['X'], stage.position['Y'], best_z, feedrate=3000)
    stage.finish_moves()

    ctx.log(f'AF done -> z={best_z:.3f} score={best_score:.1f}', level='ok')
    ctx.update_output('status', f'z={best_z:.3f}mm  (step={step:.3f}mm)')
    return {'success': True, 'best_z': best_z, 'score': best_score}

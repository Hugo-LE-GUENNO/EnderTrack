"""
plugins/hill-climbing-autofocus/hill-climbing-autofocus.py
Autofocus hill-climbing — va dans une direction tant que ca s'ameliore,
fait demi-tour avec pas reduit quand ca baisse. Converge en O(log n).
"""

import numpy as np
import time

NAME        = "Hill-Climbing Autofocus"
VERSION     = "1.0.0"
DESCRIPTION = "Hill-climbing autofocus — fast convergence, no full scan"

SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "slider", "id": "step_mult", "label": "Step (x pixel size)", "min": 1, "max": 50, "default": 10, "step": 1},
            {"type": "slider", "id": "max_steps", "label": "Max steps",           "min": 5, "max": 100, "default": 40, "step": 5},
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
        'label': 'Hill-Climbing Autofocus',
        'timeout_ms': 120000,
        'params': [
            {'id': 'step_mult', 'label': 'Step (x pixel size)', 'type': 'number', 'default': 10, 'min': 1,  'max': 50},
            {'id': 'max_steps', 'label': 'Max steps',           'type': 'number', 'default': 40, 'min': 5,  'max': 100},
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

    pixel_size_um = cam._config.get('pixel_size', 1.0)
    step_mult     = float(params.get('step_mult', 10))
    max_steps     = int(params.get('max_steps', 40))
    step          = max(0.005, min(1.0, pixel_size_um * step_mult / 1000.0))

    x0 = stage.position['X']
    y0 = stage.position['Y']
    z  = stage.position['Z']

    ctx.reset_graph('curve')
    ctx.update_output('status', f'Starting at z={z:.3f} step={step:.3f}mm')

    current_score = _score(picam)
    ctx.update_graph('curve', z, current_score)

    direction   = +1
    n_reversals = 0
    total_steps = 0

    while total_steps < max_steps:
        next_z = round(z + direction * step, 4)
        stage.move_absolute(x0, y0, next_z, feedrate=3000)
        stage.finish_moves()
        time.sleep(0.05)

        new_score = _score(picam)
        ctx.update_graph('curve', next_z, new_score)
        total_steps += 1

        if new_score > current_score:
            current_score = new_score
            z = next_z
            ctx.update_output('status', f'z={z:.3f} score={current_score:.0f}')
        else:
            direction   *= -1
            step         = round(step / 2, 4)
            n_reversals += 1
            ctx.update_output('status', f'Reversal #{n_reversals} z={z:.3f} step={step:.4f}mm')
            if step < 0.001:
                break

    stage.move_absolute(x0, y0, z, feedrate=3000)
    stage.finish_moves()

    ctx.log(f'HC-AF done -> z={z:.3f} score={current_score:.1f} ({total_steps} steps)', level='ok')
    ctx.update_output('status', f'z={z:.3f}mm  ({total_steps} steps, {n_reversals} reversals)')
    return {'success': True, 'best_z': z, 'score': current_score}

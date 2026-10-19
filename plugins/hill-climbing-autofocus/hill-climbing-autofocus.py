"""
plugins/hill-climbing-autofocus/hill-climbing-autofocus.py
Phase 1 — gros pas pour trouver le bon versant.
Phase 2 — hill-climbing fin pour converger au sommet.
"""

import numpy as np
import time

NAME        = "Hill-Climbing Autofocus"
VERSION     = "1.1.0"
DESCRIPTION = "Coarse scan + hill-climbing fine convergence"

SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "slider", "id": "range",      "label": "Range (mm)",          "min": 0.1, "max": 10.0, "default": 2.0, "step": 0.1},
            {"type": "slider", "id": "step_mult",  "label": "Fine step (x px size)","min": 1,   "max": 50,   "default": 10,  "step": 1},
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
            {'id': 'range',     'label': 'Range (mm)',           'type': 'number', 'default': 2.0, 'min': 0.1, 'max': 10.0},
            {'id': 'step_mult', 'label': 'Fine step (x px size)','type': 'number', 'default': 10,  'min': 1,   'max': 50},
        ]
    }
]


def _score(picam, n=3):
    scores = []
    for _ in range(n):
        arr  = picam.capture_array("main")
        gray = (0.299*arr[:,:,0] + 0.587*arr[:,:,1] + 0.114*arr[:,:,2]).astype(np.float32)
        lap  = (-4*gray[1:-1,1:-1] + gray[:-2,1:-1] + gray[2:,1:-1]
                + gray[1:-1,:-2] + gray[1:-1,2:])
        scores.append(float(lap.var()))
    return float(np.median(scores))


def _move(stage, x, y, z):
    stage.move_absolute(x, y, z, feedrate=3000)
    stage.finish_moves()
    time.sleep(0.05)


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
    rng           = float(params.get('range', 2.0))
    fine_step     = max(0.005, min(0.5, pixel_size_um * step_mult / 1000.0))
    coarse_step   = fine_step * 8

    x0 = stage.position['X']
    y0 = stage.position['Y']
    z0 = stage.position['Z']

    ctx.reset_graph('curve')

    # ── Phase 1 : scan grossier sur toute la range ──────────────────────────
    ctx.update_output('status', 'Phase 1: coarse scan...')
    z_start = round(z0 - rng / 2, 4)
    z_end   = round(z0 + rng / 2, 4)

    _move(stage, x0, y0, z_start)

    coarse_points = []
    z = z_start
    while z <= z_end + 1e-6:
        s = _score(picam)
        coarse_points.append((z, s))
        ctx.update_graph('curve', z, s)
        z = round(z + coarse_step, 4)
        if z <= z_end + 1e-6:
            _move(stage, x0, y0, z)

    best_coarse = max(coarse_points, key=lambda p: p[1])
    best_z, best_score = best_coarse

    ctx.update_output('status', f'Coarse best z={best_z:.3f} — refining...')

    # ── Phase 2 : hill-climbing fin autour du meilleur point ────────────────
    _move(stage, x0, y0, best_z)
    current_score = _score(picam)
    z = best_z

    direction   = +1
    step        = fine_step
    n_reversals = 0
    total_steps = 0

    while total_steps < 60:
        next_z = round(z + direction * step, 4)
        _move(stage, x0, y0, next_z)
        new_score = _score(picam)
        ctx.update_graph('curve', next_z, new_score)
        total_steps += 1

        if new_score > current_score:
            current_score = new_score
            z = next_z
        else:
            direction   *= -1
            step         = round(step / 2, 4)
            n_reversals += 1
            if step < 0.001:
                break

    _move(stage, x0, y0, z)

    ctx.log(f'HC-AF done -> z={z:.3f} score={current_score:.1f} ({total_steps} fine steps)', level='ok')
    ctx.update_output('status', f'z={z:.3f}mm  ({len(coarse_points)} coarse + {total_steps} fine steps)')
    return {'success': True, 'best_z': z, 'score': current_score}

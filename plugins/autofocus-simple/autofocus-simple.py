"""
plugins/autofocus-simple/autofocus-simple.py
Autofocus rapide — scan linéaire 1 passe, maximise le contraste Laplacien.
"""

import numpy as np
import time

NAME        = "Autofocus"
VERSION     = "1.0.0"
DESCRIPTION = "Autofocus rapide par scan Z"

SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "slider", "id": "range",   "label": "Range (mm)",  "min": 0.5, "max": 5.0, "default": 2.0, "step": 0.5},
            {"type": "slider", "id": "step",    "label": "Step (mm)",   "min": 0.05, "max": 0.5, "default": 0.1, "step": 0.05},
            {"type": "button", "label": "Autofocus", "action": "run", "style": "primary"},
        ],
        "outputs": [
            {"type": "text",  "id": "status", "label": "Status"},
            {"type": "graph", "id": "curve",  "label": "Focus curve", "xlabel": "Z (mm)", "ylabel": "Score"},
        ]
    }
}


def _score(cam):
    """Capture une frame et retourne le score de netteté (variance Laplacien)."""
    import io
    picam, _ = cam._get_picam()
    if not picam:
        return 0.0
    arr = picam.capture_array("main")
    gray = (0.299 * arr[:,:,0] + 0.587 * arr[:,:,1] + 0.114 * arr[:,:,2]).astype(np.float32)
    lap = (-4*gray[1:-1,1:-1] + gray[:-2,1:-1] + gray[2:,1:-1]
           + gray[1:-1,:-2] + gray[1:-1,2:])
    return float(lap.var())


def run(ctx, params):
    stage = ctx.stage
    cam   = ctx.cam
    if not stage:
        ctx.update_output('status', 'Stage not connected')
        return {'success': False, 'error': 'Stage non connecté'}
    if not cam:
        ctx.update_output('status', 'Camera not available')
        return {'success': False, 'error': 'Camera not available'}

    z0      = stage.position['Z']
    rng     = float(params.get('range', 2.0))
    step    = float(params.get('step',  0.1))
    z_start = z0 - rng / 2
    z_end   = z0 + rng / 2

    ctx.log(f"AF scan z=[{z_start:.2f}, {z_end:.2f}] step={step}")
    ctx.update_output('status', 'Scanning...')
    ctx.reset_graph('curve')

    # Aller au début du scan
    stage.move_absolute(stage.position['X'], stage.position['Y'], z_start, feedrate=1000)
    stage.finish_moves()
    time.sleep(0.1)

    best_z, best_score = z_start, 0.0
    z = z_start

    while z <= z_end + 1e-6:
        score = _score(cam)
        ctx.update_graph('curve', z, score)
        if score > best_score:
            best_score = score
            best_z = z
        z = round(z + step, 4)
        stage.move_absolute(stage.position['X'], stage.position['Y'], z, feedrate=1000)
        stage.finish_moves()
        time.sleep(0.05)

    # Aller à la meilleure position
    stage.move_absolute(stage.position['X'], stage.position['Y'], best_z, feedrate=1000)
    stage.finish_moves()

    ctx.log(f"AF done -> z={best_z:.3f} score={best_score:.1f}", level='ok')
    ctx.update_output('status', f'z={best_z:.3f}mm')
    return {'success': True, 'best_z': best_z, 'score': best_score}

"""
plugins/xy-test/plugin.py
Test des extrémités XY — va aux 4 coins, capture une image à chaque point, enregistre les positions.
"""

import os
import time

NAME        = "Test XY"
VERSION     = "1.2.0"
DESCRIPTION = "Teste les extrémités XY, capture une image à chaque coin"

_BTN = {"type": "button", "label": "▶ Tester les extrémités XY", "action": "run_test", "style": "primary"}
_OUT = {"type": "table", "id": "xy_test_log", "label": "Positions atteintes", "columns": ["Corner", "X", "Y", "Status"]}

SECTIONS = {
    "navigation": {"inputs": [_BTN], "outputs": [_OUT]},
    "automation": {"inputs": [_BTN], "outputs": [_OUT]},
    "waypoints":  {"inputs": [_BTN], "outputs": [_OUT]},
    "settings":   {"inputs": [_BTN], "outputs": [_OUT]},
}


def run_test(ctx, params):
    stage = ctx.stage
    if not stage:
        return {'success': False, 'error': 'Stage non connecté'}

    config = ctx.config
    bounds = config.get('coordinateBounds', {})
    x_min  = bounds.get('x', {}).get('min', 0)
    x_max  = bounds.get('x', {}).get('max', 100)
    y_min  = bounds.get('y', {}).get('min', 0)
    y_max  = bounds.get('y', {}).get('max', 100)

    corners = [
        (x_min, y_min, "X_min Y_min"),
        (x_max, y_min, "X_max Y_min"),
        (x_max, y_max, "X_max Y_max"),
        (x_min, y_max, "X_min Y_max"),
    ]

    # Crée (ou recrée) la liste dédiée
    ctx.lists.delete_list('Extreme Positions')
    ctx.lists.new_list('Extreme Positions', color='#e2844a', pinned=True)

    errors = []
    z = stage.position['Z']
    capture_dir = os.path.join(os.getcwd(), 'captures', 'xy-test')
    os.makedirs(capture_dir, exist_ok=True)
    timestamp = time.strftime('%Y%m%d_%H%M%S')

    for x, y, label in corners:
        try:
            ctx.log(f"→ {label} ({x}, {y})")
            stage.move_absolute(x, y, z, feedrate=3000)
            stage.finish_moves()

            # Capture
            img_path = os.path.join(capture_dir, f"{timestamp}_{label.replace(' ', '_')}.tiff")
            if ctx.cam:
                res = ctx.cam.capture(img_path)
                cap_status = f"✓ {os.path.basename(img_path)}" if res.get('success') else f"✗ {res.get('error','?')}"
            else:
                cap_status = "(no cam)"

            ctx.lists.add(x, y, z, name=label, list='Extreme Positions')
            ctx.append_table_row('xy_test_log', [label, f"{x:.2f}", f"{y:.2f}", cap_status])
        except Exception as e:
            errors.append(f"{label}: {e}")
            ctx.append_table_row('xy_test_log', [label, f"{x:.2f}", f"{y:.2f}", f"✗ {e}"])

    # Retour au centre
    cx, cy = (x_min + x_max) / 2, (y_min + y_max) / 2
    stage.move_absolute(cx, cy, z, feedrate=3000)
    stage.finish_moves()

    if errors:
        ctx.log(f'{len(errors)} erreur(s)', level='error')
        return {'success': False, 'errors': errors}

    ctx.log('Test XY terminé — 4 positions enregistrées', level='ok')
    return {'success': True}

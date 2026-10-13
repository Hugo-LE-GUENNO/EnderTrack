"""
plugins/py-extruder/extruder.py
Contrôle de l'extrudeur — avance/recul avec distance et vitesse réglables.
"""

NAME        = "Extrudeur"
ICON        = ''
VERSION     = "1.0.0"
DESCRIPTION = "Contrôle moteur extrudeur via G-code"

SCENARIO_ACTIONS = [
    {
        "id":     "advance",
        "label":  " Extrudeur — Avance",
        "icon":   "",
        "params": [
            {"id": "distance", "label": "Distance (mm)", "type": "number", "default": 5,   "min": 0.1, "max": 100, "step": 0.1},
            {"id": "speed",    "label": "Vitesse (mm/min)", "type": "number", "default": 300, "min": 10,  "max": 3000, "step": 10},
        ]
    },
    {
        "id":     "retract",
        "label":  " Extrudeur — Recul",
        "icon":   "",
        "params": [
            {"id": "distance", "label": "Distance (mm)", "type": "number", "default": 5,   "min": 0.1, "max": 100, "step": 0.1},
            {"id": "speed",    "label": "Vitesse (mm/min)", "type": "number", "default": 300, "min": 10,  "max": 3000, "step": 10},
        ]
    },
]


SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "button", "label": "◄ Recul",   "action": "retract"},
            {"type": "button", "label": "Avance ►",  "action": "advance", "style": "primary"},
            {"type": "slider", "id": "distance", "label": "Distance", "min": 0.1, "max": 50,   "default": 5},
            {"type": "slider", "id": "speed",    "label": "Vitesse",  "min": 10,  "max": 3000, "default": 300},
        ],
        "outputs": [
            {"type": "table", "id": "history", "label": "Historique", "columns": ["Dir", "Dist (mm)", "Vitesse"]}
        ]
    },
    "settings": {
        "inputs": [
            {"type": "slider", "id": "max_dist", "label": "Dist max", "min": 1, "max": 200, "default": 50},
            {"type": "button", "label": " Sauvegarder", "action": "save_settings"},
        ],
        "outputs": [
            {"type": "value", "id": "settings_status", "label": "Statut"}
        ]
    },
    "waypoints": {
        "inputs": [
            {"type": "input",  "id": "purge_dist", "label": "Purge (mm)", "default": "20", "input_type": "number"},
            {"type": "button", "label": " Purger à chaque waypoint", "action": "purge"},
        ],
        "outputs": [
            {"type": "log", "id": "waypoint_log", "label": "Log"}
        ]
    },
    "automation": {
        "inputs": [
            {"type": "slider",   "id": "auto_dist",  "label": "Dist auto", "min": 1, "max": 50, "default": 10},
            {"type": "dropdown", "id": "auto_mode",  "label": "Mode",
             "options": [{"value": "before", "label": "Avant chaque pos"}, {"value": "after", "label": "Après chaque pos"}]},
            {"type": "button", "label": "▶ Activer", "action": "enable_auto", "style": "primary"},
        ],
        "outputs": [
            {"type": "value", "id": "auto_status", "label": "Mode actif"}
        ]
    }
}


def _extrude(ctx, params, direction):
    stage = ctx.stage
    if not stage:
        return {'success': False, 'error': 'Stage non connecté'}
    distance = float(params.get('distance', 5)) * direction
    speed    = int(params.get('speed', 300))
    for line in ["M302 S0", "G91", f"G1 E{distance} F{speed}", "G90"]:
        stage.send_gcode(line, wait_ok=True)
    ctx.append_table_row('history', [
        '►' if direction > 0 else '◄',
        f"{abs(distance):.1f}",
        str(speed)
    ])
    return {'success': True}


def advance(ctx, params):
    return _extrude(ctx, params, 1)


def retract(ctx, params):
    return _extrude(ctx, params, -1)


def leti(ctx, params):
    stage = ctx.stage
    stage.send_gcode("G28 X Y", wait_ok=True)
    return {'success': True}


def save_settings(ctx, params):
    max_dist = params.get('max_dist', 50)
    ctx.update_output('settings_status', f' Dist max: {max_dist} mm')
    return {'success': True}


def purge(ctx, params):
    stage = ctx.stage
    if not stage:
        return {'success': False, 'error': 'Stage non connecté'}
    dist = float(params.get('purge_dist', 20))
    ctx.update_output('waypoint_log', f' Purge {dist} mm...')
    for line in ["M302 S0", "G91", f"G1 E{dist} F200", "G90"]:
        stage.send_gcode(line, wait_ok=True)
    ctx.update_output('waypoint_log', f' Purge {dist} mm OK')
    return {'success': True}


def enable_auto(ctx, params):
    mode = params.get('auto_mode', 'before')
    dist = params.get('auto_dist', 10)
    label = 'Avant' if mode == 'before' else 'Après'
    ctx.update_output('auto_status', f'{label} — {dist} mm')
    return {'success': True}

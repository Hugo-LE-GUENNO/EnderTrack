import time
import threading

NAME        = "Tempo Bed"
VERSION     = "1.0.0"
DESCRIPTION = "Heated bed control — set temperature, monitor, wait"

SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "slider", "id": "target", "label": "Target (C)", "min": 0, "max": 120, "default": 60, "step": 1},
            {"type": "button", "label": "Heat ON",  "action": "heat_on",  "style": "primary"},
            {"type": "button", "label": "Heat OFF", "action": "heat_off", "style": "secondary"},
        ],
        "outputs": [
            {"type": "text", "id": "status", "label": "Status"},
        ]
    }
}

SCENARIO_ACTIONS = [
    {
        'id': 'heat_on',
        'label': 'Bed ON',
        'timeout_ms': 10000,
        'params': [
            {'id': 'target', 'label': 'Temperature (C)', 'type': 'number', 'default': 60, 'min': 0, 'max': 120},
        ]
    },
    {
        'id': 'heat_off',
        'label': 'Bed OFF',
        'timeout_ms': 5000,
        'params': []
    },
    {
        'id': 'wait_temp',
        'label': 'Bed wait temp',
        'timeout_ms': 600000,
        'params': [
            {'id': 'target',    'label': 'Target (C)',    'type': 'number', 'default': 60, 'min': 0,   'max': 120},
            {'id': 'tolerance', 'label': 'Tolerance (C)', 'type': 'number', 'default': 2,  'min': 0.5, 'max': 10},
        ]
    },
]


def heat_on(ctx, params):
    stage = ctx.stage
    if not stage:
        ctx.update_output('status', 'Stage not connected')
        return {'success': False}
    target = int(params.get('target', 60))
    stage.send_gcode(f'M140 S{target}', wait_ok=True)
    ctx.log(f'Bed ON -> {target}C', level='ok')
    ctx.update_output('status', f'Heating to {target}C')
    return {'success': True}


def heat_off(ctx, params):
    stage = ctx.stage
    if not stage:
        ctx.update_output('status', 'Stage not connected')
        return {'success': False}
    stage.send_gcode('M140 S0', wait_ok=True)
    ctx.log('Bed OFF', level='ok')
    ctx.update_output('status', 'OFF')
    return {'success': True}


def wait_temp(ctx, params):
    stage = ctx.stage
    if not stage:
        ctx.update_output('status', 'Stage not connected')
        return {'success': False}
    target    = float(params.get('target', 60))
    tolerance = float(params.get('tolerance', 2))
    for _ in range(600):
        lines = stage.send_gcode('M105', wait_ok=True)
        for line in lines:
            if 'B:' in line:
                try:
                    current = float(line.split('B:')[1].split()[0])
                    ctx.update_output('status', f'Bed {current:.1f} / {target}C')
                    if abs(current - target) <= tolerance:
                        ctx.log(f'Bed reached {current:.1f}C', level='ok')
                        return {'success': True}
                except (ValueError, IndexError):
                    pass
        time.sleep(1)
    ctx.update_output('status', 'Timeout')
    return {'success': False, 'error': 'timeout'}

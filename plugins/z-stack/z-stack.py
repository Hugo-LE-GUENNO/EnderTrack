import time

NAME        = "Z Stack"
VERSION     = "1.0.0"
DESCRIPTION = "Capture images at each Z step across a range"

SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "slider", "id": "range",  "label": "Range (mm)",  "min": 0.1, "max": 5.0, "default": 1.0, "step": 0.1},
            {"type": "slider", "id": "step",   "label": "Step (mm)",   "min": 0.05, "max": 1.0, "default": 0.2, "step": 0.05},
            {"type": "text",   "id": "prefix", "label": "Prefix",      "default": "stack"},
            {"type": "button", "label": "Acquire", "action": "run", "style": "primary"},
        ],
        "outputs": [
            {"type": "text", "id": "status", "label": "Status"},
        ]
    }
}

SCENARIO_ACTIONS = [
    {
        'id': 'run',
        'label': 'Z Stack',
        'timeout_ms': 120000,
        'params': [
            {'id': 'range',  'label': 'Range (mm)', 'type': 'number', 'default': 1.0},
            {'id': 'step',   'label': 'Step (mm)',  'type': 'number', 'default': 0.2},
            {'id': 'prefix', 'label': 'Prefix',     'type': 'text',   'default': 'stack'},
        ]
    }
]


def run(ctx, params):
    stage  = ctx.stage
    cam    = ctx.cam
    light  = ctx.light

    if not stage:
        ctx.update_output('status', 'Stage not connected')
        return {'success': False}
    if not cam:
        ctx.update_output('status', 'Camera not available')
        return {'success': False}

    rng    = float(params.get('range', 1.0))
    step   = float(params.get('step', 0.2))
    prefix = params.get('prefix', 'stack')

    x0, y0, z0 = stage.position['X'], stage.position['Y'], stage.position['Z']
    z_start = round(z0 - rng / 2, 4)
    z_end   = round(z0 + rng / 2, 4)

    has_light = bool(light.status().get('lights'))
    if has_light:
        light.on(r=255, g=255, b=255, intensity=1.0)

    stage.move_absolute(x0, y0, z_start, feedrate=3000)
    stage.finish_moves()

    i, z = 0, z_start
    while z <= z_end + 1e-6:
        ctx.update_output('status', f'z={z:.3f} mm ({i+1} frames)')
        cam.capture(f'./captures/{prefix}_{i:03d}.tiff')
        i += 1
        z = round(z + step, 4)
        stage.move_absolute(x0, y0, z, feedrate=1000)
        stage.finish_moves()
        time.sleep(0.05)

    stage.move_absolute(x0, y0, z0, feedrate=3000)
    stage.finish_moves()

    if has_light:
        light.off()

    ctx.log(f'Z stack done: {i} frames', level='ok')
    ctx.update_output('status', f'{i} frames captured')
    return {'success': True}

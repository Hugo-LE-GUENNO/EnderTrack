# Python Plugin Tutorial

## Structure

```
plugins/
└── my-plugin/
    └── my-plugin.py
```

## Minimal plugin

```python
NAME        = "My Plugin"
VERSION     = "1.0.0"
DESCRIPTION = "Does something cool"

SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "button", "label": "Run", "action": "run", "style": "primary"},
        ],
        "outputs": [
            {"type": "text", "id": "status", "label": "Status"},
        ]
    }
}

def run(ctx, params):
    ctx.update_output('status', 'Done')
    return {'success': True}
```

Activate it in **Settings -> Plugins**, it appears in the Navigation panel.

---

## Sections

A plugin can inject UI into 4 panels:

| Key          | Location                   |
|--------------|----------------------------|
| `settings`   | Settings panel             |
| `navigation` | Navigation panel           |
| `waypoints`  | Waypoints/Lists panel      |
| `automation` | Automation/Scenario panel  |

Each section accepts `inputs` (controls) and `outputs` (display).

---

## Input types

```python
{"type": "button",   "label": "Run",    "action": "run",  "style": "primary"}
{"type": "slider",   "id": "speed",  "label": "Speed",  "min": 1, "max": 10, "default": 5, "step": 1}
{"type": "input",    "id": "name",   "label": "Name",   "default": "img"}
{"type": "folder",   "id": "outdir", "label": "Output folder", "directory": True}
{"type": "dropdown", "id": "mode",   "label": "Mode",   "options": ["fast", "slow"], "default": "fast"}
```

For `folder`, the selected path is passed to your function via `params`:

```python
def run(ctx, params):
    out = params.get('outdir', './captures')
```

Slider and text values are passed to your function via `params`:

```python
def run(ctx, params):
    speed = float(params.get('speed', 5))
    name  = params.get('name', 'img')
```

---

## Output types

```python
{"type": "text",  "id": "status",  "label": "Status"}
{"type": "table", "id": "results", "label": "Results", "columns": ["X", "Y", "Score"]}
```

Update from Python:

```python
ctx.update_output('status', 'Done')
ctx.update_output('results', [[1.0, 2.0, 42.5], [3.0, 4.0, 38.1]])
```

---

## Context API (`ctx`)

### Stage

```python
stage = ctx.stage
if stage:
    stage.position                             # {'X': 10.0, 'Y': 20.0, 'Z': 5.0}
    stage.limits                               # {'x': (0, 220), 'y': (0, 220), 'z': (0, 250)} or None
    stage.firmware_name                        # 'Marlin' or None

    stage.move_absolute(x, y, z, feedrate=3000)
    stage.move_relative(dx=0, dy=0, dz=1.0, feedrate=1000)
    stage.finish_moves()                       # blocking wait (M400)
    stage.home()                               # G28 + reads real position
    stage.get_position()                       # query M114, returns (x, y, z)
    stage.send_gcode('M300', wait_ok=True)     # raw G-code access
```

### Camera

```python
cam = ctx.cam
if cam:
    cam.capture('./captures/img.tiff')
    cam.capture('./captures/img.png', fmt='png')
```

### Light

```python
light = ctx.light
light.on(r=255, g=200, b=0, intensity=0.8)
light.off()
st = light.status()               # {'lights': [...], 'connected': True}
has_light = bool(st.get('lights'))
```

### Lists (waypoints)

```python
ctx.lists.add(x=10, y=20, z=5, name='Point A')
ctx.lists.clear()
```

### Config

```python
cfg = ctx.config
cfg['position']            # {'x': 10.0, 'y': 20.0, 'z': 5.0}  (last saved state)
cfg['coordinateBounds']    # {'x': {'min': 0, 'max': 220}, 'y': ..., 'z': ...}
cfg['plateauDimensions']   # {'x': 220, 'y': 220, 'z': 250}
cfg['feedrate']            # current XY feedrate (mm/min)
cfg['zSpeed']              # current Z speed (mm/s)
```

For live position prefer `stage.position` — `ctx.config['position']` is the last saved state.

### Logging

```python
ctx.log('Starting scan...')
ctx.log('Done', level='ok')
ctx.log('Warning!', level='warn')
```

---

## Scenario action

Expose your plugin as an action in the scenario builder.  
`label` is the name that appears in the **Plugin** category of the palette.

```python
SCENARIO_ACTIONS = [
    {
        'id': 'run',
        'label': 'My Action',      # name shown in scenario builder palette
        'timeout_ms': 30000,       # max execution time in ms
        'params': [
            {'id': 'speed', 'label': 'Speed', 'type': 'number', 'default': 5, 'min': 1, 'max': 10},
        ]
    }
]
```

The `id` must match the function name in your plugin (`def run`, `def my_action`, etc.).

---

## Full example — Z stack with stage, camera and light

```python
import time

NAME        = "Z Stack"
VERSION     = "1.0.0"
DESCRIPTION = "Capture images at each Z step across a range"

SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "slider", "id": "range", "label": "Range (mm)", "min": 0.1, "max": 5.0, "default": 1.0, "step": 0.1},
            {"type": "slider", "id": "step",  "label": "Step (mm)",  "min": 0.05, "max": 1.0, "default": 0.2, "step": 0.05},
            {"type": "text",   "id": "prefix", "label": "Filename prefix", "default": "stack"},
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
```

---

## AI prompt — generate a plugin

Copy-paste this prompt to any AI to generate a valid EnderTrack Python plugin:

```
You are writing a Python plugin for EnderTrack, a 3D stage controller with image acquisition.

## File location
plugins/<plugin-name>/<plugin-name>.py

## Required top-level variables
NAME        = "..."   # display name
VERSION     = "1.0.0"
DESCRIPTION = "..."

## SECTIONS — inject UI into panels
SECTIONS = {
    "<section>": {          # one of: settings | navigation | automation | waypoints
        "inputs":  [...],   # controls (see types below)
        "outputs": [...]    # display elements (see types below)
    }
}

## Input types
{"type": "button",   "label": "Run",    "action": "run",  "style": "primary"}
{"type": "slider",   "id": "speed",  "label": "Speed",  "min": 1, "max": 10, "default": 5, "step": 1}
{"type": "input",    "id": "name",   "label": "Name",   "default": "img"}
{"type": "folder",   "id": "outdir", "label": "Output folder", "directory": True}
{"type": "dropdown", "id": "mode",   "label": "Mode",   "options": ["fast", "slow"], "default": "fast"}

## Output types
{"type": "text",  "id": "status",  "label": "Status"}
{"type": "table", "id": "results", "label": "Results", "columns": ["X", "Y", "Score"]}

## Functions
Each button "action" maps to a top-level function:
def run(ctx, params):
    # params = dict of slider/text values by id
    ctx.update_output('status', 'Done')
    return {'success': True}

## Context API (ctx)
### Stage
stage = ctx.stage              # None if not connected
stage.position                 # {'X': float, 'Y': float, 'Z': float}
stage.limits                   # {'x': (min, max), 'y': ..., 'z': ...} or None
stage.firmware_name            # 'Marlin' or None
stage.move_absolute(x, y, z, feedrate=3000)
stage.move_relative(dx=0, dy=0, dz=0, feedrate=1000)
stage.finish_moves()           # blocking wait (M400)
stage.home()                   # G28 + reads real position
stage.get_position()           # query M114, returns (x, y, z)
stage.send_gcode('M300', wait_ok=True)  # raw G-code access

### Camera
cam = ctx.cam                  # None if not available
cam.capture('./captures/img.tiff')
cam.capture('./captures/img.png', fmt='png')

### Light
light = ctx.light
light.on(r=255, g=255, b=255, intensity=1.0)
light.off()
light.status()                 # {'lights': [...], 'connected': bool}

### Lists (waypoints)
ctx.lists.add(x, y, z, name='Point A')
ctx.lists.clear()

### Config
cfg = ctx.config
cfg['position']                # {'x': float, 'y': float, 'z': float} (last saved state)
cfg['coordinateBounds']        # {'x': {'min': 0, 'max': 220}, 'y': ..., 'z': ...}
cfg['plateauDimensions']       # {'x': 220, 'y': 220, 'z': 250}
cfg['feedrate']                # XY feedrate (mm/min)
cfg['zSpeed']                  # Z speed (mm/s)

### Logging
ctx.log('message')
ctx.log('ok message', level='ok')
ctx.log('warning',    level='warn')

## SCENARIO_ACTIONS — expose as scenario builder action (optional)
SCENARIO_ACTIONS = [
    {
        'id': 'run',              # must match function name
        'label': 'My Action',    # name shown in scenario builder palette (Plugin category)
        'timeout_ms': 30000,
        'params': [
            {'id': 'speed', 'label': 'Speed', 'type': 'number', 'default': 5, 'min': 1, 'max': 10},
        ]
    }
]

## Rules
- Always check ctx.stage / ctx.cam / ctx.light for None before use
- run() is blocking; use time.sleep() between moves
- Do not use emoji in labels (rendering issues on RPi)
- Return {'success': True} or {'success': False} from every function

Now write a plugin that does: <DESCRIBE YOUR PLUGIN HERE>
```

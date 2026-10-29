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

---

## Sections

A plugin can inject UI into 4 panels: `settings`, `navigation`, `waypoints`, `automation`.

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

All values are passed to your function via `params`:

```python
def run(ctx, params):
    speed  = float(params['speed'])
    name   = params['name']
    outdir = params['outdir']
    mode   = params['mode']
```

---

## Output types

```python
{"type": "text",  "id": "status",  "label": "Status"}
{"type": "table", "id": "results", "label": "Results", "columns": ["X", "Y", "Score"]}
{"type": "graph", "id": "curve",   "label": "Focus curve"}
{"type": "image", "id": "preview", "label": "Preview"}
```

Update from Python:

```python
ctx.update_output('status', 'Done')
ctx.update_output('results', [[1.0, 2.0, 42.5], [3.0, 4.0, 38.1]])
ctx.append_table_row('results', [5.0, 6.0, 39.2])  # add one row
ctx.update_graph('curve', x=1.0, y=42.5)            # add one point
ctx.reset_graph('curve')                             # clear graph
ctx.update_image('preview', numpy_array_hwc)         # numpy (H,W,3) -> JPEG
```

---

## Context API (`ctx`)

### Devices

**Stage**

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

**Camera**

```python
cam = ctx.cam
if cam:
    cam.capture('./captures/img.tiff')
    cam.capture('./captures/img.tiff',
        fmt='tiff',              # 'tiff' | 'png' | 'jpg'
        resolution=[4056, 3040], # capture at full sensor resolution
        exposure=50000,          # µs — overrides live setting for this capture
        gain=1.5,
        color_mode='gray',       # 'gray' | 'rgb' | 'bgr'
        apply_rotation=True,
        save_metadata=True,      # saves a .yaml alongside the image
        metadata={'well': 'A1'},
    )
    # returns {'success': True, 'path': ..., 'width': ..., 'height': ...}
    # stage position is automatically injected in the .yaml if connected
```

**Light**

```python
light = ctx.light
if not light.status().get('lights'):
    return {'success': False}

light.on(r=255, g=200, b=0, intensity=0.8)
light.off()
light.color(r=0, g=255, b=0)
light.intensity(0.5)

# Multiple lights — use id= to target a specific one
light.on(r=255, g=0, b=0, id=1)
light.off(id=2)
```

**Image/stage coordinate helpers**

```python
# Convert a pixel offset from image center to stage delta (mm)
# Accounts for pixel_size, resolution, rotation and flip
dx_mm, dy_mm = ctx.image_to_stage(px_offset_x, px_offset_y)

# Current field of view in mm
fov_x, fov_y = ctx.fov_mm()
```

Example — move stage to center a detected object:

```python
import numpy as np

def center_object(ctx, params):
    cam = ctx.cam
    stage = ctx.stage
    if not cam or not stage:
        return {'success': False}

    cam.capture('/tmp/snap.tiff')
    img = cv2.imread('/tmp/snap.tiff')
    h, w = img.shape[:2]

    obj_px_x, obj_px_y = w // 2 + 50, h // 2 - 30   # replace with real detection
    offset_x = obj_px_x - w // 2
    offset_y = obj_px_y - h // 2

    dx_mm, dy_mm = ctx.image_to_stage(offset_x, offset_y)
    stage.move_relative(dx=dx_mm, dy=dy_mm)
    stage.finish_moves()
    return {'success': True}
```

**Custom devices**

Register hardware drivers (e.g. Arduino pump) — accessible across functions, cleaned up on deactivation:

```python
def on_load(ctx):
    import serial
    ctx.register_device('pump', serial.Serial('/dev/ttyUSB0', 9600))

def run(ctx, params):
    ctx.devices['pump'].write(b'GO\n')
```

### Lists (waypoints)

```python
ctx.lists.add(x=10, y=20, z=5, name='Point A')
ctx.lists.add(x=10, y=20, z=5, name='Point A', list='My List')
ctx.lists.remove(index=2)
ctx.lists.clear()

ctx.lists.new_list('My List', color='#4a90e2', pinned=False)
ctx.lists.rename_list('My List', 'New Name')
ctx.lists.delete_list('My List')

ctx.lists.all              # all groups with positions
ctx.lists.get('My List')   # positions of a specific list
```

### Config

Read-only snapshot of EnderTrack settings.

```python
cfg = ctx.config

# Stage
cfg['position']            # {'x': 10.0, 'y': 20.0, 'z': 5.0}  (last saved state)
cfg['coordinateBounds']    # {'x': {'min': -27, 'max': 193}, 'y': ..., 'z': ...}
cfg['plateauDimensions']   # {'x': 220, 'y': 220, 'z': 250}
cfg['feedrate']            # current XY feedrate (mm/min)
cfg['maxFeedrate']         # firmware max XY feedrate (mm/min)
cfg['maxZSpeed']           # firmware max Z speed (mm/s)
cfg['axisOrientation']     # axis orientation config

# Camera
cfg['camera']['resolution']  # [1280, 720]
cfg['camera']['exposure']    # µs
cfg['camera']['gain']        # analogue gain
cfg['camera']['pixel_size']  # µm/px (at ref resolution)
cfg['camera']['rotation']    # 0 | 90 | 180 | 270
cfg['camera']['flip_h']      # bool
cfg['camera']['flip_v']      # bool
cfg['camera']['color_mode']  # 'gray' | 'rgb' | 'bgr'
cfg['camera']['sensor']      # e.g. 'imx708_wide'

# Hardware
cfg['cameras']             # list of configured cameras
cfg['lights']              # list of configured lights
```

For live position prefer `stage.position` — `cfg['position']` is the last saved state.

### Logging

```python
ctx.log('Starting scan...')
ctx.log('Done',     level='ok')
ctx.log('Warning!', level='warn')
ctx.log('Error!',   level='error')
```

### Event bus

```python
ctx.bus.publish('my:event', {'key': 'value'})
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

## Lifecycle hooks

```python
def on_load(ctx):
    """Called when the plugin is activated."""
    pass

def on_unload(ctx):
    """Called when the plugin is deactivated. Clean up resources here."""
    pass
```

---

## Extra browser-side JS

Load a JS file in the browser when the plugin is activated:

```python
EXTRA_JS = ['plugins/my-plugin/my-extra.js']
```

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

    cam    = ctx.cam

    if not stage:
        ctx.update_output('status', 'Stage not connected')
        return {'success': False}
    if not cam:
        ctx.update_output('status', 'Camera not available')
        return {'success': False}

    rng    = float(params['range'])
    step   = float(params['step'])
    prefix = params['prefix']

    x0, y0, z0 = stage.position['X'], stage.position['Y'], stage.position['Z']
    z_start = round(z0 - rng / 2, 4)
    z_end   = round(z0 + rng / 2, 4)

    has_light = light.status().get('lights')
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
if cam:
    cam.capture(path, fmt='tiff', resolution=None, exposure=None, gain=None,
                color_mode='gray', apply_rotation=True, save_metadata=True,
                metadata=None)
    # returns {'success': True, 'path': ..., 'width': ..., 'height': ...}

### Light
light = ctx.light
light.on(r=255, g=255, b=255, intensity=1.0)
light.off()
light.status()                 # {'lights': [...], 'connected': bool}

### Lists (waypoints)
ctx.lists.add(x, y, z, name='Point A')
ctx.lists.clear()

### Config
cfg = ctx.config               # read-only
cfg['position']                # {'x': float, 'y': float, 'z': float} (last saved state)
cfg['coordinateBounds']        # {'x': {'min': 0, 'max': 220}, 'y': ..., 'z': ...}
cfg['plateauDimensions']       # {'x': 220, 'y': 220, 'z': 250}
cfg['feedrate']                # XY feedrate (mm/min)
cfg['maxFeedrate']             # firmware max XY feedrate (mm/min)
cfg['camera']['resolution']    # [w, h]
cfg['camera']['exposure']      # µs
cfg['camera']['pixel_size']    # µm/px
cfg['lights']                  # list of configured lights

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

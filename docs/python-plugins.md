# Python Plugin Tutorial

Create a Python plugin in 5 minutes — no framework, no boilerplate.

## Requirements (Raspberry Pi)

Some features require system-level libraries and **must be run with `sudo`**:

| Feature | Dependency | Install |
|---|---|---|
| PiCamera capture | `picamera2` | `sudo apt install python3-picamera2` |
| NeoPixel GPIO LEDs | `rpi_ws281x` + `neopixel` | `sudo pip3 install rpi_ws281x adafruit-circuitpython-neopixel` |
| Save to custom folder | — | run server with `sudo` |

```bash
sudo python3 endertrack-server.py
```

---

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

A plugin can inject UI into 4 sections:

| Key          | Location                   |
|--------------|----------------------------|
| `navigation` | Navigation panel (left)    |
| `automation` | Automation/Scenario panel  |
| `waypoints`  | Waypoints/Lists panel      |
| `settings`   | Settings panel (accordion) |

Each section has `inputs` (controls) and `outputs` (display).

---

## Input types

```python
{"type": "button", "label": "Run",   "action": "run",  "style": "primary"}
{"type": "slider", "id": "speed", "label": "Speed", "min": 1, "max": 10, "default": 5, "step": 1}
{"type": "text",   "id": "name",  "label": "Name",  "default": "img"}
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
    pos = stage.position          # {'X': 10.0, 'Y': 20.0, 'Z': 5.0}
    stage.move_absolute(x, y, z, feedrate=3000)
    stage.move_relative(dx=1.0, feedrate=1000)
    stage.finish_moves()          # wait for move to complete
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

## Full example — autofocus with stage, camera and light

```python
import time
import numpy as np

NAME        = "Autofocus"
VERSION     = "1.0.0"
DESCRIPTION = "Linear Z scan, maximizes Laplacian sharpness"

SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "slider", "id": "range", "label": "Range (mm)", "min": 0.5, "max": 5.0, "default": 2.0, "step": 0.5},
            {"type": "slider", "id": "step",  "label": "Step (mm)",  "min": 0.05, "max": 0.5, "default": 0.1, "step": 0.05},
            {"type": "button", "label": "Autofocus", "action": "run", "style": "primary"},
        ],
        "outputs": [
            {"type": "text", "id": "status", "label": "Status"},
        ]
    }
}

SCENARIO_ACTIONS = [
    {
        'id': 'run',
        'label': 'Autofocus',
        'timeout_ms': 60000,
        'params': [
            {'id': 'range', 'label': 'Range (mm)', 'type': 'number', 'default': 2.0, 'min': 0.5, 'max': 5.0},
            {'id': 'step',  'label': 'Step (mm)',  'type': 'number', 'default': 0.1,  'min': 0.05, 'max': 0.5},
        ]
    }
]


def _sharpness(cam):
    picam, _ = cam._get_picam()
    if not picam:
        return 0.0
    arr  = picam.capture_array("main")
    gray = (0.299 * arr[:,:,0] + 0.587 * arr[:,:,1] + 0.114 * arr[:,:,2]).astype('float32')
    lap  = (-4*gray[1:-1,1:-1] + gray[:-2,1:-1] + gray[2:,1:-1]
            + gray[1:-1,:-2] + gray[1:-1,2:])
    return float(lap.var())


def run(ctx, params):
    stage = ctx.stage
    cam   = ctx.cam
    light = ctx.light

    if not stage:
        ctx.update_output('status', 'Stage not connected')
        return {'success': False}
    if not cam:
        ctx.update_output('status', 'Camera not available')
        return {'success': False}

    rng  = float(params.get('range', 2.0))
    step = float(params.get('step',  0.1))

    x0, y0, z0 = stage.position['X'], stage.position['Y'], stage.position['Z']
    z_start = z0 - rng / 2
    z_end   = z0 + rng / 2

    # Light on for the scan
    has_light = bool(light.status().get('lights'))
    if has_light:
        light.on(r=255, g=255, b=255, intensity=1.0)

    ctx.update_output('status', 'Scanning...')
    ctx.log(f'AF scan z=[{z_start:.2f}, {z_end:.2f}] step={step}')

    stage.move_absolute(x0, y0, z_start, feedrate=1000)
    stage.finish_moves()
    time.sleep(0.1)

    best_z, best_score = z_start, 0.0
    z = z_start
    while z <= z_end + 1e-6:
        score = _sharpness(cam)
        if score > best_score:
            best_score, best_z = score, z
        z = round(z + step, 4)
        stage.move_absolute(x0, y0, z, feedrate=1000)
        stage.finish_moves()
        time.sleep(0.05)

    stage.move_absolute(x0, y0, best_z, feedrate=1000)
    stage.finish_moves()

    if has_light:
        light.off()

    ctx.log(f'AF done -> z={best_z:.3f} score={best_score:.1f}', level='ok')
    ctx.update_output('status', f'z={best_z:.3f} mm')
    return {'success': True, 'best_z': best_z}
```

---

## Tips

- `run()` is blocking — the scenario builder waits for it to return
- Use `threading.Event` for a stop button pattern (see `disco` plugin)
- `ctx.light`, `ctx.stage`, `ctx.cam` return `None` if not available — always check
- Plugin files are hot-reloaded on each activation — no server restart needed

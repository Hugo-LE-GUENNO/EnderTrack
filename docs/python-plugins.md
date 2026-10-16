# Python Plugin Tutorial

Create a Python plugin in 5 minutes — no framework, no boilerplate.

## Requirements (Raspberry Pi)

Some plugin features require system-level libraries and **must be run with `sudo`**:

| Feature | Dependency | Install |
|---|---|---|
| PiCamera capture | `picamera2` | `sudo apt install python3-picamera2` |
| NeoPixel GPIO LEDs | `rpi_ws281x` + `neopixel` | `sudo pip3 install rpi_ws281x adafruit-circuitpython-neopixel` |
| Save to custom folder | — | run server with `sudo` |

```bash
# Always use sudo on RPi if using camera, GPIO LEDs or custom save paths
sudo python3 endertrack-server.py
```

On a standard PC (simulation mode), `sudo` is not needed.

---

## Structure

```
plugins/
└── my-plugin/
    └── my-plugin.py       # required
    └── sound.js           # optional — extra JS loaded in browser
```

## Minimal plugin

```python
NAME        = "My Plugin"
VERSION     = "1.0.0"
DESCRIPTION = "Does something cool"

SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "button", "label": "▶ Run", "action": "run", "style": "primary"},
        ],
        "outputs": [
            {"type": "text", "id": "status", "label": "Status"},
        ]
    }
}

def run(ctx, params):
    ctx.update_output('status', '✓ Done')
    return {'success': True}
```

Activate it in **Settings → Plugins**, it appears in the Navigation panel.

---

## Sections

A plugin can inject UI into 4 sections:

| Key          | Location                        |
|--------------|---------------------------------|
| `navigation` | Navigation panel (left)         |
| `automation` | Automation/Scenario panel       |
| `waypoints`  | Waypoints/Lists panel           |
| `settings`   | Settings panel (accordion)      |

Each section has `inputs` (controls) and `outputs` (display).

---

## Input types

```python
{"type": "button", "label": "Run",      "action": "run",   "style": "primary"}
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
{"type": "text",  "id": "status", "label": "Status"}
{"type": "table", "id": "results", "label": "Results",
 "columns": ["X", "Y", "Score"]}
```

Update from Python:

```python
ctx.update_output('status', '✓ Done')
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
cam = ctx.cam                     # picamera_handler module
cam.capture('./captures/img.tiff')
```

### Light

```python
light = ctx.light
light.on(r=255, g=200, b=0, intensity=0.8)
light.off()
light.status()                    # {'lights': [...], 'connected': True}
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

### SSE events (browser)

```python
ctx.bus.publish('plugin:sound', {'melody': 'fanfare'})
```

---

## Scenario action

Expose your plugin as a scenario builder action:

```python
SCENARIO_ACTIONS = [
    {
        'id': 'run',
        'label': '🔬 My Action',
        'icon': '🔬',
        'timeout_ms': 30000,       # max execution time in ms
        'params': [
            {'id': 'speed', 'label': 'Speed', 'type': 'number', 'default': 5, 'min': 1, 'max': 10},
        ]
    }
]
```

The action appears in the scenario builder palette under **Plugin**.

---

## Extra JS (browser-side)

Load a JS file alongside your plugin:

```python
EXTRA_JS = ['/plugins/my-plugin/my-plugin.js']
```

The JS file is served statically and injected into the page when the plugin activates.  
Use it to play sounds, draw on canvas, listen to SSE events, etc.

```javascript
// plugins/my-plugin/my-plugin.js
const es = new EventSource((window.ENDERTRACK_SERVER || 'http://localhost:5000') + '/api/events');
es.onmessage = (e) => {
  const evt = JSON.parse(e.data);
  if (evt.type === 'plugin:sound') { /* play something */ }
};
```

---

## Full example — autofocus + light

```python
import time, numpy as np

NAME    = "Autofocus"
VERSION = "1.0.0"

SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "slider", "id": "range", "label": "Range (mm)", "min": 0.5, "max": 5.0, "default": 2.0, "step": 0.5},
            {"type": "button", "label": "🔍 Focus", "action": "run", "style": "primary"},
        ],
        "outputs": [
            {"type": "text", "id": "status", "label": "Status"},
        ]
    }
}

def run(ctx, params):
    stage = ctx.stage
    light = ctx.light
    rng   = float(params.get('range', 2.0))

    light.on(r=255, g=255, b=255, intensity=1.0)
    ctx.update_output('status', '⏳ Scanning...')

    z0 = stage.position['Z']
    best_z, best_score = z0, 0.0

    for i in range(20):
        z = z0 - rng/2 + i * (rng/19)
        stage.move_absolute(stage.position['X'], stage.position['Y'], z, feedrate=1000)
        stage.finish_moves()
        time.sleep(0.05)
        # score = your sharpness metric here

    stage.move_absolute(stage.position['X'], stage.position['Y'], best_z, feedrate=1000)
    light.off()
    ctx.update_output('status', f'✓ z={best_z:.3f}mm')
    return {'success': True, 'best_z': best_z}
```

---

## Tips

- Keep `run()` blocking — the scenario builder waits for it to return
- Use `threading.Event` for a stop button pattern (see `disco` plugin)
- `ctx.light`, `ctx.stage`, `ctx.cam` return `None` if not available — always check
- Plugin files are hot-reloaded on each activation — no server restart needed

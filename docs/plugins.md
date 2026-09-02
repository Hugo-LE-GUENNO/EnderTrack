# Creating a plugin

Plugins let you extend EnderTrack without modifying the core. A plugin is a folder dropped into `plugins/` — it can add UI elements, new controls, backend scripts, or communicate with external hardware. Once placed in the folder, it appears in Settings → Extensions and can be enabled or disabled at any time.

## Structure

```
plugins/my-plugin/
├── plugin.json    # Manifest
├── bridge.js      # Frontend logic
├── ui.js          # Interface
├── ui.css         # Styles (optional)
└── scripts/       # Python backend (optional)
    └── my-tool.py
```

## plugin.json

```json
{
  "id": "myPlugin",
  "folder": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Short description",
  "icon": "🔌"
}
```

`id` in camelCase → classes `MyPluginBridge` + `MyPluginPluginUI`.

## bridge.js

The bridge handles the plugin logic and communicates with the backend or hardware.

```javascript
class MyPluginBridge {
  activate() { }
  deactivate() { }
  getStatus() { return { connected: true }; }
}
window.MyPluginBridge = MyPluginBridge;
```

## ui.js

The UI class injects interface elements into the app. `init()` is called on activation, `destroy()` on deactivation.

```javascript
class MyPluginPluginUI {
  constructor(manifest, bridge) {
    this.manifest = manifest;
    this.bridge = bridge;
    this._el = null;
  }

  init() {
    this.bridge.activate();
    const zone = document.getElementById('navPluginZone');
    if (!zone) return;
    this._el = document.createElement('div');
    this._el.innerHTML = '<button>My Button</button>';
    zone.appendChild(this._el);
  }

  destroy() {
    this.bridge.deactivate();
    this._el?.remove();
  }
}
window.MyPluginPluginUI = MyPluginPluginUI;
```

## JavaScript API

```javascript
EnderTrack.State.get().pos                        // {x, y, z}
EnderTrack.Movement.moveAbsolute(x, y, z)
EnderTrack.Movement.moveRelative(dx, dy, dz)
EnderTrack.UI.showNotification(message, type)     // 'success', 'error', 'info'
EnderTrack.State.on('state:changed', callback)
EnderTrack.Canvas.requestRender()
```

## Testing

Copy the folder into `plugins/` → Settings → Extensions → Enable.

## Python backend scripts

A plugin can include Python scripts in `scripts/`. They are loaded automatically when the plugin is activated and expose API endpoints.

### Structure

```
plugins/my-plugin/
└── scripts/
    └── camera.py
```

### scripts/camera.py

```python
def capture(params=None):
    return {'success': True, 'image': 'data:image/png;base64,...'}

def status(params=None):
    return {'success': True, 'connected': True}

# Each key = one API endpoint
ACTIONS = {
    '/capture': capture,
    '/status': status,
}
```

### Calling from the frontend

```javascript
// URL: /api/plugins/{pluginId}/{scriptName}/{action}
const resp = await fetch('/api/plugins/myPlugin/camera/capture', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ resolution: '1080p' })
});
const data = await resp.json();
```

### MJPEG streaming

To stream video, export a `stream_generator` function:

```python
def stream_generator():
    while True:
        frame = get_frame()  # JPEG bytes
        yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

ACTIONS = { '/status': status }
```

Accessible via `<img src="/api/plugins/myPlugin/camera/stream">`.

## Server synchronization

### Shared state

Read and write to the server state (`data/state.json`):

```javascript
const SERVER = window.ENDERTRACK_SERVER || 'http://localhost:5000';

// Read
const state = await (await fetch(SERVER + '/api/state')).json();

// Write (partial merge)
await fetch(SERVER + '/api/state/patch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ myPlugin: { config: 'value' } })
});
```

### Real-time events (SSE)

Listen to events from other clients:

```javascript
const es = new EventSource(SERVER + '/api/events');
es.onmessage = (e) => {
  const evt = JSON.parse(e.data);
  // evt.type = 'lists:updated', 'position:moved', etc.
  // evt.data._from = sender clientId
};
```

Publish an event to all clients:

```javascript
fetch(SERVER + '/api/events/publish', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'myPlugin:update', data: { value: 42 } })
});
```

### Activity log

Send a log visible in the server terminal:

```javascript
fetch(SERVER + '/api/log', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'Capture', details: 'image_001.png' })
});
// Terminal: [14:32:05] 192.168.1.15 — Capture (image_001.png)
```

### Available events

| Type | Data | Emitted by |
|------|------|------------|
| `lists:updated` | `{_from}` | Client modifying a list |
| `position:moving` | `{x,y,z,sx,sy,sz,duration}` | Client starting a movement |
| `position:arrived` | `{x,y,z}` | Client whose movement completed |
| `position:moved` | `{x,y,z}` | Server (hardware movement) |
| `position:homed` | `{}` | Server (hardware home) |

## AI prompt

If you want to generate a plugin quickly with an AI assistant, use this prompt:

```
Create an EnderTrack plugin:
- plugin.json (camelCase id, folder = folder name)
- bridge.js (class [Id]Bridge with activate/deactivate, exposed on window)
- ui.js (class [Id]PluginUI with init/destroy, injects into #navPluginZone)
- scripts/my-tool.py (optional, ACTIONS dict with endpoints)

JS API: EnderTrack.State.get().pos, EnderTrack.Movement.moveAbsolute(x,y,z),
EnderTrack.UI.showNotification(msg, type), EnderTrack.Canvas.requestRender()

Python API: ACTIONS dict = {'/endpoint': handler_function}
Frontend call: fetch('/api/plugins/{id}/{script}/{action}')

Server sync:
- Shared state: GET/POST /api/state, POST /api/state/patch
- Real-time: EventSource('/api/events'), POST /api/events/publish
- Server log: POST /api/log {action, details}

The plugin should: [DESCRIPTION]
```

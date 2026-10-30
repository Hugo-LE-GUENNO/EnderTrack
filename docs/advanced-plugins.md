# Advanced Plugin Tutorial

An advanced plugin gives you **full access to EnderTrack** — inject any UI anywhere, create new tabs, open modals, draw on the canvas, react to events, call the server. Everything a Python plugin cannot do.

## Python plugin vs Advanced plugin

| | Python plugin | Advanced plugin |
|---|---|---|
| Language | Python | JavaScript + optional Python |
| UI | Fixed inputs/outputs injected by the engine | Any HTML/CSS anywhere in the app |
| New tab | No | Yes |
| Modal | No | Yes |
| Canvas drawing | No | Yes |
| React to events | No | Yes (position, movement, clicks...) |
| Access full app state | No | Yes |
| Server communication | Built-in via ctx | fetch() to Flask |
| Complexity | Low | Medium |

Use a Python plugin for automation and acquisition logic. Use an advanced plugin when you need custom UI, real-time interaction, or deep integration with the app.

---

## Structure

```
plugins/my-plugin/
├── plugin.json    ← manifest (required)
├── bridge.js      ← logic and server communication
├── ui.js          ← UI injection
├── ui.css         ← styles
└── scripts/       ← optional Python backend
    └── my-tool.py
```

Drop the folder into `plugins/` and enable it from the Plugins tab. No restart needed.  
Or install from the [community repository](https://github.com/Hugo-LE-GUENNO/EnderTrack-plugins-community).

---

## Naming convention

The plugin system derives class names from the plugin `id` (camelCase):

| Folder | id | Bridge class | UI class |
|---|---|---|---|
| `plugins/my-plugin/` | `myPlugin` | `MyPluginBridge` | `MyPluginPluginUI` |
| `plugins/gamepad-simple/` | `gamepadSimple` | `GamepadSimpleBridge` | `GamepadSimplePluginUI` |

The `folder` field in `plugin.json` must match the actual folder name if it differs from the `id`.

---

## plugin.json

```json
{
  "id": "myPlugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "What it does",
  "icon": "",
  "tools": [],
  "widgets": [],
  "navButtons": []
}
```

---

## bridge.js

Handles logic and optional server communication.

```javascript
class MyPluginBridge {
  constructor(pluginId) {
    this.pluginId  = pluginId;
    this.serverUrl = window.ENDERTRACK_SERVER || 'http://localhost:5000';
  }

  async call(tool, endpoint, params = {}) {
    const res = await fetch(`${this.serverUrl}/api/plugins/${this.pluginId}/${tool}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return res.json();
  }
}

window.MyPluginBridge = MyPluginBridge;
```

For a local plugin with no server, put your logic directly in the bridge — no fetch needed.

---

## ui.js

Injects UI on activation, removes everything on deactivation.

```javascript
class MyPluginPluginUI {
  constructor(manifest, bridge) {
    this.manifest = manifest;
    this.bridge   = bridge;
    this._els     = [];
  }

  init()    { this._inject(); }
  destroy() { this._els.forEach(el => el.remove()); this._els = []; }

  _inject() {
    const nav = document.getElementById('navigationTabContent');
    if (!nav) return;
    const btn = document.createElement('button');
    btn.className   = 'enderscope-nav-btn';
    btn.textContent = 'Run';
    btn.onclick     = () => window.MyPluginPlugin?.ui?.run();
    nav.appendChild(btn);
    this._els.push(btn);
  }

  run() { this.bridge.call('my-tool', '/run'); }
}

window.MyPluginPluginUI = MyPluginPluginUI;
```

### Inject a settings accordion

```javascript
_injectSettings() {
  const settings = document.getElementById('settingsTabContent');
  if (!settings) return;
  const el = document.createElement('details');
  el.innerHTML = `
    <summary>${this.manifest.name}</summary>
    <div class="setting-group">
      <button class="enderscope-settings-btn"
        onclick="window.MyPluginPlugin?.ui?.run()">Run</button>
    </div>
  `;
  settings.prepend(el);
  this._els.push(el);
}
```

### Add a new tab

```javascript
_injectTab() {
  // Tab button
  const tabBar = document.getElementById('dynamicTabsContainer');
  const btn = document.createElement('button');
  btn.id        = 'myPluginTab';
  btn.className = 'toggle-btn plugin-tab';
  btn.textContent = 'My Plugin';
  btn.onclick   = () => switchTab('myPlugin');
  tabBar.appendChild(btn);

  // Tab content
  const pane = document.createElement('div');
  pane.id        = 'myPluginTabContent';
  pane.className = 'tab-panel';
  pane.innerHTML = `<div id="myPluginRoot" style="padding:12px;"></div>`;
  document.querySelector('.tab-content').appendChild(pane);

  this._els.push(btn, pane);
}
```

### Open a modal

```javascript
_openModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'enderscope-modal-backdrop';
  backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
  backdrop.innerHTML = `
    <div class="enderscope-modal">
      <div class="enderscope-modal-header">
        <h3>My Plugin</h3>
        <button onclick="this.closest('.enderscope-modal-backdrop').remove()">✕</button>
      </div>
      <div class="enderscope-modal-body">
        <p>Content here</p>
      </div>
      <div class="enderscope-modal-footer">
        <button class="enderscope-btn-secondary"
          onclick="this.closest('.enderscope-modal-backdrop').remove()">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  this._els.push(backdrop);
}
```

### React to events

```javascript
init() {
  this._onPosition = (state) => this._onPositionChanged(state);
  EnderTrack.Events.on('position:changed', this._onPosition);
}

destroy() {
  EnderTrack.Events.off('position:changed', this._onPosition);
  this._els.forEach(el => el.remove());
  this._els = [];
}

_onPositionChanged(state) {
  const { x, y, z } = state.pos;
  document.getElementById('myPluginPos').textContent = `X=${x} Y=${y} Z=${z}`;
}
```

---

## EnderTrack API

### State

| Method | Returns | Description |
|---|---|---|
| `EnderTrack.State.get()` | object | full app state |
| `EnderTrack.State.update({...})` | — | partial state update |
| `EnderTrack.State.set(key, val)` | — | set one property |
| `EnderTrack.State.getProperty(key)` | any | get one property |

### Movement

| Method | Description |
|---|---|
| `EnderTrack.Movement.moveAbsolute(x, y, z)` | animated absolute move |
| `EnderTrack.Movement.moveRelative(dx, dy, dz)` | animated relative move |
| `window.moveDirection('up'\|'down'\|'left'\|'right'\|'zUp'\|'zDown')` | directional step |
| `window.goHome('xy'\|'xyz')` | go to origin |
| `window.emergencyStop()` | stop all movement |

### Canvas

| Method | Description |
|---|---|
| `EnderTrack.Canvas.requestRender()` | force redraw |
| `EnderTrack.Canvas.centerView(x, y)` | center viewport on world coords |
| `EnderTrack.Canvas.exportAsImage(filename)` | export canvas as PNG |
| `EnderTrack.API.call('mapToCanvas', x, y)` | world mm → screen pixels |
| `EnderTrack.API.call('canvasToMap', x, y)` | screen pixels → world mm |
| `EnderTrack.API.call('drawCircle', x, y, r, color, fill)` | draw on canvas |
| `EnderTrack.API.call('drawLine', x1, y1, x2, y2, color, w)` | draw on canvas |
| `EnderTrack.API.call('drawText', x, y, text, color)` | draw text on canvas |

### UI

| Method | Description |
|---|---|
| `EnderTrack.UI.showNotification(msg, type)` | toast — `'info'`, `'success'`, `'warning'`, `'error'` |
| `EnderTrack.UI.showSuccess(msg)` | green toast |
| `EnderTrack.UI.showError(msg)` | red toast |
| `switchTab('navigation'\|'lists'\|'settings'\|'acquisition'\|...)` | switch active tab |
| `EnderTrack.UI.Panels.createPanel(id, config)` | create a floating panel |

### Events

| Method | Description |
|---|---|
| `EnderTrack.Events.on(event, cb)` | subscribe |
| `EnderTrack.Events.off(event, cb)` | unsubscribe |
| `EnderTrack.Events.emit(event, ...args)` | emit |

Available events:

| Event | Payload |
|---|---|
| `position:changed` | `state` |
| `movement:started` | — |
| `movement:completed` | — |
| `movement:emergency_stop` | — |
| `state:changed` | `newState, oldState` |
| `tab:switched` | `{ from, to }` |
| `canvas:clicked` | `{ x, y }` world coords |
| `canvas:rendered` | — |
| `plugin:activated` | `{ id }` |
| `plugin:deactivated` | `{ id }` |
| `plugin:image-acquired` | image data |
| `ui:resize` | `{ width, height }` |

### Lists

| Method | Description |
|---|---|
| `EnderTrack.Lists.manager.getCurrentList()` | `{ positions: [{x,y,z,name}] }` |
| `EnderTrack.Lists.manager.addPosition(x, y, z, name)` | add a position |
| `EnderTrack.Lists.executor.executeList(positions)` | run through list |
| `EnderTrack.Lists.executor.stopExecution()` | stop |
| `EnderTrack.Lists.executor.getExecutionStatus()` | `{ isExecuting, currentIndex, progress }` |

### Math

| Method | Description |
|---|---|
| `EnderTrack.Math.distance2D(x1,y1,x2,y2)` | 2D distance |
| `EnderTrack.Math.distance3D(x1,y1,z1,x2,y2,z2)` | 3D distance |
| `EnderTrack.Math.clamp(val, min, max)` | clamp |
| `EnderTrack.Math.round(val, decimals)` | round |
| `EnderTrack.Math.lerp(start, end, t)` | linear interpolation |

### Coordinates

| Method | Description |
|---|---|
| `EnderTrack.Coordinates.getCoordinateBounds()` | `{ minX, maxX, minY, maxY, minZ, maxZ }` |
| `EnderTrack.Coordinates.getDimensions()` | `{ x, y, z }` |

---

## CSS variables

| Variable | Use |
|---|---|
| `--app-bg` | backgrounds |
| `--container-bg` | panels |
| `--column-bg` | sections |
| `--text-general` | labels |
| `--text-selected` | active text |
| `--coordinates-color` | values (yellow) |
| `--active-element` | active buttons |
| `--radius` / `--radius-small` | border radius |

Reusable classes: `enderscope-nav-btn`, `enderscope-settings-btn`, `enderscope-modal-backdrop`, `enderscope-modal`, `enderscope-modal-header`, `enderscope-modal-body`, `enderscope-modal-footer`, `enderscope-btn-primary`, `enderscope-btn-secondary`.

---

## Python backend (optional)

Each `.py` file in `scripts/` must expose an `ACTIONS` dict:

```python
ACTIONS = {
    'run': { 'method': 'POST', 'handler': run },
}

def run(data):
    return {'success': True, 'result': 'ok'}
```

Called from bridge.js via `POST /api/plugins/<pluginId>/<tool>/<action>`.

---

## AI prompt — generate a plugin

```
You are writing an advanced plugin for EnderTrack, a 3D stage controller with image acquisition.
EnderTrack is a vanilla JS + Python Flask app. No framework. Plugins are loaded dynamically.

## File structure
plugins/<folder>/
├── plugin.json
├── bridge.js
├── ui.js
├── ui.css
└── scripts/my-tool.py   ← optional Python backend

## Naming convention (CRITICAL)
- folder: kebab-case  →  plugins/my-plugin/
- id in plugin.json: camelCase  →  "myPlugin"
- plugin.json must have "folder" field matching the actual folder name
- Bridge class: capitalize(id) + "Bridge"  →  MyPluginBridge
- UI class: capitalize(id) + "PluginUI"  →  MyPluginPluginUI
- Global exposed by PluginManager: window.MyPluginPlugin

## plugin.json
{
  "id": "myPlugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "...",
  "icon": "",
  "tools": [],
  "widgets": [],
  "navButtons": []
}

## bridge.js
class MyPluginBridge {
  constructor(pluginId) {
    this.pluginId  = pluginId;
    this.serverUrl = window.ENDERTRACK_SERVER || 'http://localhost:5000';
  }
  async call(tool, endpoint, params = {}) {
    const res = await fetch(`${this.serverUrl}/api/plugins/${this.pluginId}/${tool}${endpoint}`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(params)
    });
    return res.json();
  }
}
window.MyPluginBridge = MyPluginBridge;

## ui.js
class MyPluginPluginUI {
  constructor(manifest, bridge) { this.manifest = manifest; this.bridge = bridge; this._els = []; }
  init()    { /* inject UI */ }
  destroy() { this._els.forEach(el => el.remove()); this._els = []; }
}
window.MyPluginPluginUI = MyPluginPluginUI;

## UI injection points
- Navigation tab:  document.getElementById('navigationTabContent')
- Settings tab:    document.getElementById('settingsTabContent')
- New tab button:  document.getElementById('dynamicTabsContainer')
- New tab content: document.querySelector('.tab-content')
- Modals:          document.body

## EnderTrack API
EnderTrack.State.get()                          // full state
EnderTrack.State.update({...})                  // partial update
EnderTrack.Movement.moveAbsolute(x, y, z)
EnderTrack.Movement.moveRelative(dx, dy, dz)
window.emergencyStop()
EnderTrack.Canvas.requestRender()
EnderTrack.Canvas.centerView(x, y)
EnderTrack.API.call('mapToCanvas', x, y)        // world → pixels
EnderTrack.API.call('canvasToMap', x, y)        // pixels → world
EnderTrack.API.call('drawCircle', x, y, r, color, fill)
EnderTrack.UI.showNotification(msg, type)       // 'info'|'success'|'warning'|'error'
EnderTrack.UI.showError(msg)
EnderTrack.UI.showSuccess(msg)
switchTab('navigation'|'lists'|'settings'|'acquisition')
EnderTrack.Events.on(event, cb)
EnderTrack.Events.off(event, cb)
// Events: position:changed, movement:started, movement:completed,
//         state:changed, tab:switched, canvas:clicked, plugin:activated
EnderTrack.Lists.manager.getCurrentList()       // { positions: [{x,y,z,name}] }
EnderTrack.Lists.manager.addPosition(x, y, z, name)
EnderTrack.Math.distance2D(x1,y1,x2,y2)
EnderTrack.Math.clamp(val, min, max)
EnderTrack.Coordinates.getCoordinateBounds()    // { minX, maxX, minY, maxY, minZ, maxZ }

## CSS variables
--app-bg, --container-bg, --column-bg
--text-general, --text-selected, --coordinates-color, --active-element
--radius, --radius-small
Reusable classes: enderscope-nav-btn, enderscope-settings-btn,
  enderscope-modal-backdrop, enderscope-modal, enderscope-modal-header,
  enderscope-modal-body, enderscope-modal-footer,
  enderscope-btn-primary, enderscope-btn-secondary

## Python backend (optional)
ACTIONS = {
    'run': { 'method': 'POST', 'handler': run },
}
def run(data):
    return {'success': True}

## Rules
- Vanilla JS only, no framework
- onclick must reference window.MyPluginPlugin?.ui?.method()
- init() injects all UI elements, destroy() removes them all
- Do not modify index.html or registry.js
- No emoji in labels (rendering issues on RPi)

Now write a plugin that does: <DESCRIBE YOUR PLUGIN HERE>
```

---

## Community plugins

[EnderTrack-plugins-community](https://github.com/Hugo-LE-GUENNO/EnderTrack-plugins-community)  
[How to contribute](community-plugins.md)

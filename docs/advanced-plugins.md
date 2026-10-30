# Advanced Plugin Tutorial

Create a full plugin for EnderTrack — inject UI, communicate with the server, access all app APIs.

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

## Install

Drop the folder into `plugins/` and enable it from **Settings → Plugins**, or click **Import** in the Plugins tab.

No restart needed.

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

## Naming convention

The plugin system derives class names from the plugin `id` (camelCase):

| Folder | id | Bridge class | UI class |
|---|---|---|---|
| `plugins/my-plugin/` | `myPlugin` | `MyPluginBridge` | `MyPluginPluginUI` |
| `plugins/gamepad-simple/` | `gamepadSimple` | `GamepadSimpleBridge` | `GamepadSimplePluginUI` |

The `folder` field in `plugin.json` must match the actual folder name if it differs from the `id`.

---

## bridge.js

Handles logic and server communication. Must expose a global class.

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

For a local plugin (no server), just put your logic directly in the bridge — no fetch needed.

---

## ui.js

Injects UI elements on activation, removes them on deactivation.

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
    // inject into navigation tab
    const nav = document.getElementById('navigationTabContent');
    if (!nav) return;
    const btn = document.createElement('button');
    btn.className = 'enderscope-nav-btn';
    btn.textContent = 'Run';
    btn.onclick = () => window.MyPluginPlugin?.ui?.run();
    nav.appendChild(btn);
    this._els.push(btn);
  }

  run() { this.bridge.call('my-tool', '/run'); }
}

window.MyPluginPluginUI = MyPluginPluginUI;
```

### Add a settings accordion

```javascript
_injectSettings() {
  const settings = document.getElementById('settingsTabContent');
  if (!settings) return;
  const details = document.createElement('details');
  details.innerHTML = `
    <summary>${this.manifest.name}</summary>
    <div class="setting-group">
      <button class="enderscope-settings-btn"
        onclick="window.MyPluginPlugin?.ui?.run()">Run</button>
    </div>
  `;
  settings.prepend(details);
  this._els.push(details);
}
```

### Add a tab

```javascript
_injectTab() {
  // Tab button
  const tabBar = document.getElementById('tabBar');
  const tabBtn = document.createElement('button');
  tabBtn.id        = 'myPluginTabBtn';
  tabBtn.className = 'tab-btn';
  tabBtn.textContent = 'My Plugin';
  tabBtn.onclick = () => switchTab('myPlugin');
  tabBar.appendChild(tabBtn);

  // Tab content
  const tabContent = document.getElementById('tabsContent');
  const tabPane = document.createElement('div');
  tabPane.id        = 'myPluginTabContent';
  tabPane.className = 'tab-content';
  tabPane.innerHTML = `<div id="myPluginRoot"></div>`;
  tabContent.appendChild(tabPane);

  this._els.push(tabBtn, tabPane);
}
```

---

## ui.css

Use EnderTrack CSS variables for consistent theming:

| Variable | Value | Use |
|---|---|---|
| `--app-bg` | `#181818` | backgrounds |
| `--container-bg` | `#2c2c2c` | panels |
| `--column-bg` | `#333` | sections |
| `--text-general` | `#888` | labels |
| `--text-selected` | `#fff` | active text |
| `--coordinates-color` | `#ffc107` | values |
| `--active-element` | `#4a5568` | active buttons |
| `--radius` | `8px` | border radius |
| `--radius-small` | `4px` | small radius |

Reusable classes: `enderscope-nav-btn`, `enderscope-settings-btn`, `enderscope-modal-backdrop`, `enderscope-modal`, `enderscope-btn-primary`, `enderscope-btn-secondary`.

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
| `EnderTrack.Canvas.centerView(x, y)` | center viewport |
| `EnderTrack.API.call('mapToCanvas', x, y)` | world → pixels |
| `EnderTrack.API.call('canvasToMap', x, y)` | pixels → world |
| `EnderTrack.API.call('drawCircle', x, y, r, color, fill)` | draw on canvas |
| `EnderTrack.API.call('drawLine', x1, y1, x2, y2, color, w)` | draw on canvas |

### UI

| Method | Description |
|---|---|
| `EnderTrack.UI.showNotification(msg, type)` | toast — `'info'`, `'success'`, `'warning'`, `'error'` |
| `EnderTrack.UI.showSuccess(msg)` | green toast |
| `EnderTrack.UI.showError(msg)` | red toast |
| `switchTab('navigation'\|'lists'\|'settings'\|...)` | switch active tab |

### Events

| Method | Description |
|---|---|
| `EnderTrack.Events.on(event, cb)` | subscribe |
| `EnderTrack.Events.off(event, cb)` | unsubscribe |
| `EnderTrack.Events.emit(event, ...args)` | emit |

Available events: `position:changed`, `movement:started`, `movement:completed`, `movement:emergency_stop`, `state:changed`, `canvas:clicked`, `plugin:activated`, `plugin:deactivated`, `plugin:image-acquired`.

### Lists

| Method | Description |
|---|---|
| `EnderTrack.Lists.manager.getCurrentList()` | `{ positions: [{x,y,z,name}] }` |
| `EnderTrack.Lists.manager.addPosition(x, y, z, name)` | add a position |
| `EnderTrack.Lists.executor.executeList(positions)` | run through list |
| `EnderTrack.Lists.executor.stopExecution()` | stop |

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

## Community plugins

[EnderTrack-plugins-community](https://github.com/Hugo-LE-GUENNO/EnderTrack-plugins-community)  
[How to contribute](community-plugins.md)

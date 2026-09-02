# Creating a plugin

A plugin extends EnderTrack without touching the core. It lives in its own folder inside `plugins/`, appears in Settings → Extensions, and can be enabled or disabled at any time. A plugin can add buttons, panels, new controls, or communicate with external hardware.

## Tutorial: Position Logger

The simplest possible plugin — a button that reads the current position and shows it as a notification. No Python, no CSS, just 3 files.

### 1. Create the folder

```
plugins/position-logger/
├── plugin.json
├── bridge.js
└── ui.js
```

### 2. plugin.json

Declares the plugin identity. `id` must be camelCase — it is used to name the classes.

```json
{
  "id": "positionLogger",
  "folder": "position-logger",
  "name": "Position Logger",
  "version": "1.0.0",
  "description": "Shows current position on demand",
  "icon": "📍"
}
```

### 3. bridge.js

Contains the plugin logic. `activate()` and `deactivate()` are called by the plugin system when the user enables or disables the plugin.

```javascript
class PositionLoggerBridge {
  activate() { }
  deactivate() { }

  logPosition() {
    const pos = EnderTrack.State.get().pos;
    EnderTrack.UI.showNotification(`X:${pos.x} Y:${pos.y} Z:${pos.z}`, 'info');
  }
}
window.PositionLoggerBridge = PositionLoggerBridge;
```

### 4. ui.js

Injects UI elements into the app. `init()` is called on activation, `destroy()` cleans up on deactivation. Elements are injected into `#navPluginZone`, which is the dedicated area for plugin UI in the Navigation tab.

```javascript
class PositionLoggerPluginUI {
  constructor(manifest, bridge) {
    this.bridge = bridge;
    this._el = null;
  }

  init() {
    this.bridge.activate();
    const zone = document.getElementById('navPluginZone');
    if (!zone) return;
    this._el = document.createElement('div');
    this._el.innerHTML = '<button onclick="EnderTrack.Plugins.get(\'positionLogger\').bridge.logPosition()">📍 Log position</button>';
    zone.appendChild(this._el);
  }

  destroy() {
    this.bridge.deactivate();
    this._el?.remove();
  }
}
window.PositionLoggerPluginUI = PositionLoggerPluginUI;
```

### 5. Enable it

Copy the folder into `plugins/` → Settings → Extensions → Enable.

---

## JavaScript API

Lets your plugin read state, trigger movements, show notifications, and react to events. Available anywhere in `bridge.js` and `ui.js`.

```javascript
EnderTrack.State.get().pos                        // {x, y, z} — current position
EnderTrack.Movement.moveAbsolute(x, y, z)         // move to absolute position
EnderTrack.Movement.moveRelative(dx, dy, dz)      // move by relative offset
EnderTrack.UI.showNotification(message, type)     // type: 'success', 'error', 'info'
EnderTrack.State.on('state:changed', callback)    // react to any state change
EnderTrack.Canvas.requestRender()                 // force canvas redraw
```

---

👉 Need Python backend, real-time sync, or multi-client events? See [plugins-advanced.md](plugins-advanced.md).

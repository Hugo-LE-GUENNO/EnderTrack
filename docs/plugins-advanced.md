# Plugins — Advanced

This document covers backend scripts, real-time synchronization, and multi-client events. Make sure you're familiar with the [basics](plugins.md) first.

## Python backend scripts

Lets your plugin expose HTTP endpoints callable from the frontend. Useful when you need to interact with hardware, the filesystem, or any Python library.

Scripts go in `scripts/` inside your plugin folder and are loaded automatically on activation.

### Structure

```
plugins/my-plugin/
└── scripts/
    └── my-tool.py
```

### scripts/my-tool.py

Each key in `ACTIONS` becomes an API endpoint. The handler receives an optional `params` dict from the request body.

```python
def run(params=None):
    return {'success': True, 'result': 'done'}

def status(params=None):
    return {'success': True, 'connected': True}

ACTIONS = {
    '/run': run,
    '/status': status,
}
```

### Calling from the frontend

```javascript
// URL: /api/plugins/{pluginId}/{scriptName}/{action}
const resp = await fetch('/api/plugins/myPlugin/my-tool/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ param: 'value' })
});
const data = await resp.json();
```

---

## Server synchronization

### Shared state

Lets multiple clients (browser tabs, devices on the network) share persistent data stored in `data/state.json`.

```javascript
const SERVER = window.ENDERTRACK_SERVER || 'http://localhost:5000';

// Read
const state = await (await fetch(SERVER + '/api/state')).json();

// Write (partial merge — only the keys you provide are updated)
await fetch(SERVER + '/api/state/patch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ myPlugin: { config: 'value' } })
});
```

### Real-time events (SSE)

Lets your plugin react to events from other clients or broadcast its own. Useful for multi-device setups where one client controls the stage and another monitors it.

Listen to events:

```javascript
const es = new EventSource(SERVER + '/api/events');
es.onmessage = (e) => {
  const evt = JSON.parse(e.data);
  // evt.type, evt.data, evt.data._from (sender clientId)
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

Sends a line to the server terminal. Useful for debugging or tracing plugin activity.

```javascript
fetch(SERVER + '/api/log', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'Run', details: 'step_001' })
});
// Terminal: [14:32:05] 192.168.1.15 — Run (step_001)
```

### Available events

| Type | Data | Emitted by |
|------|------|------------|
| `lists:updated` | `{_from}` | Client modifying a list |
| `position:moving` | `{x,y,z,sx,sy,sz,duration}` | Client starting a movement |
| `position:arrived` | `{x,y,z}` | Client whose movement completed |
| `position:moved` | `{x,y,z}` | Server (hardware movement) |
| `position:homed` | `{}` | Server (hardware home) |

### Storage reference

| Data | Where | Why |
|------|-------|-----|
| Position, lists | `data/state.json` (server) | Shared across devices |
| Theme, UI preferences | `localStorage` (browser) | Per-device |
| Images, heavy files | `data/` (server) | Accessible by all clients |

---

## AI prompt

Use this prompt to generate a plugin quickly with an AI assistant:

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

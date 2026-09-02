# Creating a module (specialized edition)

A module adds a tab, a panel, or server routes to EnderTrack. Unlike a plugin, it modifies the core — it is a new edition of EnderTrack, distributed as its own branch.

## Getting started

Fork from `basic` and create a new branch:

```bash
git clone -b basic https://github.com/Hugo-LE-GUENNO/EnderTrack.git endertrack-myedition
cd endertrack-myedition
git checkout -b my-edition
```

## Adding a tab

In `index.html`, add a tab button and its content panel:

```html
<button class="tab-btn" id="myModuleTab" onclick="switchTab('myModule')">
    🔬 My Module
</button>

<div class="tab-panel" id="myModuleTabContent">
    <!-- Interface -->
</div>
```

## Creating the JS module

`modules/my-module.js` — follows the same activate/deactivate pattern as plugins:

```javascript
class MyModule {
  constructor() { this.isActive = false; }
  activate() { this.isActive = true; this.createUI(); }
  deactivate() { this.isActive = false; }
  createUI() {
    const el = document.getElementById('myModuleTabContent');
    if (el) el.innerHTML = '<div>My interface</div>';
  }
}
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.MyModule = new MyModule();
```

Load it in `index.html`:

```html
<script src="modules/my-module.js"></script>
```

Activate it in `main.js` inside `switchTab`:

```javascript
} else if (tabId === 'myModule' && window.EnderTrack?.MyModule) {
    window.EnderTrack.MyModule.activate();
}
```

## Adding a server route

`server/my_module.py`:

```python
def register_routes(app):
    from flask import request, jsonify

    @app.route('/api/my-module/data', methods=['GET'])
    def _data():
        return jsonify({'success': True, 'data': []})
```

In `endertrack-server.py`:

```python
from server import my_module
my_module.register_routes(app)
```

## Extension points

| Area | File |
|------|------|
| Tab | `index.html` (tab-btn + tab-panel) |
| JS module | `modules/` |
| Canvas renderer | `modules/canvas/renderers/` |
| Server route | `server/` + `endertrack-server.py` |

## Publishing

```bash
git push origin my-edition
```

Open a PR or Issue to add it to the editions table.

## Server sync

A module can use the same APIs as plugins for multi-client sync. See [plugins-advanced.md](plugins-advanced.md) for the full reference (shared state, SSE events, activity log).

## AI prompt

```
Create an EnderTrack module from the basic branch
(https://github.com/Hugo-LE-GUENNO/EnderTrack/tree/basic).

Add: modules/my-module.js (activate/deactivate/createUI),
tab in index.html, case in switchTab() in main.js.
If backend: server/my_module.py with register_routes(app).

API: EnderTrack.State, EnderTrack.Movement, EnderTrack.Canvas, EnderTrack.UI

Server sync:
- Shared state: GET/POST /api/state, POST /api/state/patch
- Real-time: EventSource('/api/events'), POST /api/events/publish
- Server log: POST /api/log {action, details}

The module should: [DESCRIPTION]
```

# Créer un plugin

## Structure

```
plugins/mon-plugin/
├── plugin.json    # Manifeste
├── bridge.js      # Logique frontend
├── ui.js          # Interface
├── ui.css         # Styles (optionnel)
└── scripts/       # Backend Python (optionnel)
    └── mon-outil.py
```

## plugin.json

```json
{
  "id": "monPlugin",
  "folder": "mon-plugin",
  "name": "Mon Plugin",
  "version": "1.0.0",
  "description": "Description courte",
  "icon": "🔌"
}
```

`id` en camelCase → classes `MonPluginBridge` + `MonPluginPluginUI`.

## bridge.js

```javascript
class MonPluginBridge {
  activate() { }
  deactivate() { }
  getStatus() { return { connected: true }; }
}
window.MonPluginBridge = MonPluginBridge;
```

## ui.js

```javascript
class MonPluginPluginUI {
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
    this._el.innerHTML = '<button>Mon Bouton</button>';
    zone.appendChild(this._el);
  }

  destroy() {
    this.bridge.deactivate();
    this._el?.remove();
  }
}
window.MonPluginPluginUI = MonPluginPluginUI;
```

## API

```javascript
EnderTrack.State.get().pos                        // {x, y, z}
EnderTrack.Movement.moveAbsolute(x, y, z)
EnderTrack.Movement.moveRelative(dx, dy, dz)
EnderTrack.UI.showNotification(message, type)     // 'success', 'error', 'info'
EnderTrack.State.on('state:changed', callback)
EnderTrack.Canvas.requestRender()
```

## Tester

Copier le dossier dans `plugins/` → Réglages → Extensions → Activer.

## Scripts Python (backend)

Un plugin peut inclure des scripts Python dans `scripts/`. Ils sont chargés automatiquement à l'activation du plugin et exposent des endpoints API.

### Structure

```
plugins/mon-plugin/
└── scripts/
    └── camera.py
```

### scripts/camera.py

```python
import time

def capture(params=None):
    # Logique de capture
    return {'success': True, 'image': 'data:image/png;base64,...'}

def status(params=None):
    return {'success': True, 'connected': True}

# Chaque clé = un endpoint API
ACTIONS = {
    '/capture': capture,
    '/status': status,
}
```

### Appel depuis le frontend

```javascript
// URL : /api/plugins/{pluginId}/{scriptName}/{action}
const resp = await fetch('/api/plugins/monPlugin/camera/capture', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ resolution: '1080p' })
});
const data = await resp.json();
```

### Streaming MJPEG

Pour du streaming vidéo, exporter une fonction `stream_generator` :

```python
def stream_generator():
    while True:
        frame = get_frame()  # bytes JPEG
        yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

ACTIONS = { '/status': status }
```

Accessible via `<img src="/api/plugins/monPlugin/camera/stream">`.

## Prompt IA

```
Crée un plugin EnderTrack :
- plugin.json (id camelCase, folder = nom dossier)
- bridge.js (classe [Id]Bridge avec activate/deactivate, sur window)
- ui.js (classe [Id]PluginUI avec init/destroy, injecte dans #navPluginZone)
- scripts/mon-outil.py (optionnel, dict ACTIONS avec endpoints)

API JS : EnderTrack.State.get().pos, EnderTrack.Movement.moveAbsolute(x,y,z),
EnderTrack.UI.showNotification(msg, type), EnderTrack.Canvas.requestRender()

API Python : dict ACTIONS = {'/endpoint': handler_function}
Appel frontend : fetch('/api/plugins/{id}/{script}/{action}')

Sync serveur :
- État partagé : GET/POST /api/state, POST /api/state/patch
- Temps réel : EventSource('/api/events'), POST /api/events/publish
- Log terminal : POST /api/log {action, details}

Le plugin doit : [DESCRIPTION]
```


## Synchronisation serveur

### État partagé

Lire et écrire dans l'état serveur (`data/state.json`) :

```javascript
const SERVER = window.ENDERTRACK_SERVER || 'http://localhost:5000';

// Lire
const state = await (await fetch(SERVER + '/api/state')).json();

// Écrire (merge partiel)
await fetch(SERVER + '/api/state/patch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ monPlugin: { config: 'valeur' } })
});
```

### Événements temps réel (SSE)

Écouter les événements des autres clients :

```javascript
const es = new EventSource(SERVER + '/api/events');
es.onmessage = (e) => {
  const evt = JSON.parse(e.data);
  // evt.type = 'lists:updated', 'position:moved', etc.
  // evt.data._from = clientId de l'émetteur
};
```

Publier un événement à tous les clients :

```javascript
fetch(SERVER + '/api/events/publish', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'monPlugin:update', data: { value: 42 } })
});
```

### Log d'activité

Envoyer un log visible dans le terminal serveur :

```javascript
fetch(SERVER + '/api/log', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'Capture', details: 'image_001.png' })
});
// Terminal: [14:32:05] 192.168.1.15 — Capture (image_001.png)
```

### Événements disponibles

| Type | Données | Émis par |
|------|---------|----------|
| `lists:updated` | `{_from}` | Client qui modifie une liste |
| `position:moving` | `{x,y,z,sx,sy,sz,duration}` | Client qui lance un mouvement |
| `position:arrived` | `{x,y,z}` | Client dont le mouvement est terminé |
| `position:moved` | `{x,y,z}` | Serveur (mouvement hardware) |
| `position:homed` | `{}` | Serveur (home hardware) |

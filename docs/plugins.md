# Créer un plugin

## Structure

```
plugins/mon-plugin/
├── plugin.json    # Manifeste
├── bridge.js      # Logique
├── ui.js          # Interface
└── ui.css         # Styles (optionnel)
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

## Prompt IA

```
Crée un plugin EnderTrack :
- plugin.json (id camelCase, folder = nom dossier)
- bridge.js (classe [Id]Bridge avec activate/deactivate, sur window)
- ui.js (classe [Id]PluginUI avec init/destroy, injecte dans #navPluginZone)

API : EnderTrack.State.get().pos, EnderTrack.Movement.moveAbsolute(x,y,z),
EnderTrack.UI.showNotification(msg, type), EnderTrack.Canvas.requestRender()

Le plugin doit : [DESCRIPTION]
```

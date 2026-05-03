# Créer un module (version spécialisée)

Un module ajoute un onglet, un panneau ou des routes serveur. C'est une nouvelle version d'EnderTrack.

## Démarrer

```bash
git clone -b basic https://github.com/Hugo-LE-GUENNO/EnderTrack.git endertrack-maversion
cd endertrack-maversion
git checkout -b ma-version
```

## Ajouter un onglet

Dans `index.html` :
```html
<button class="tab-btn" id="monModuleTab" onclick="switchTab('monModule')">
    🔬 Mon Module
</button>

<div class="tab-panel" id="monModuleTabContent">
    <!-- Interface -->
</div>
```

## Créer le module JS

`modules/mon-module.js` :
```javascript
class MonModule {
  constructor() { this.isActive = false; }
  activate() { this.isActive = true; this.createUI(); }
  deactivate() { this.isActive = false; }
  createUI() {
    const el = document.getElementById('monModuleTabContent');
    if (el) el.innerHTML = '<div>Mon interface</div>';
  }
}
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.MonModule = new MonModule();
```

Charger dans `index.html` :
```html
<script src="modules/mon-module.js"></script>
```

Activer dans `main.js` (dans `switchTab`) :
```javascript
} else if (tabId === 'monModule' && window.EnderTrack?.MonModule) {
    window.EnderTrack.MonModule.activate();
}
```

## Ajouter une route serveur

`server/mon_module.py` :
```python
def register_routes(app):
    from flask import request, jsonify

    @app.route('/api/mon-module/data', methods=['GET'])
    def _data():
        return jsonify({'success': True, 'data': []})
```

Dans `endertrack-server.py` :
```python
from server import mon_module
mon_module.register_routes(app)
```

## Points d'extension

| Zone | Fichier |
|------|---------|
| Onglet | `index.html` (tab-btn + tab-panel) |
| Module JS | `modules/` |
| Renderer canvas | `modules/canvas/renderers/` |
| Route serveur | `server/` + `endertrack-server.py` |

## Publier

```bash
git push origin ma-version
```

Ouvrir une PR ou Issue pour l'ajouter à la table des versions.

## Prompt IA

```
Crée un module EnderTrack depuis la branche basic
(https://github.com/Hugo-LE-GUENNO/EnderTrack/tree/basic).

Ajouter : modules/mon-module.js (activate/deactivate/createUI),
onglet dans index.html, cas dans switchTab() de main.js.
Si backend : server/mon_module.py avec register_routes(app).

API : EnderTrack.State, EnderTrack.Movement, EnderTrack.Canvas, EnderTrack.UI

Le module doit : [DESCRIPTION]
```

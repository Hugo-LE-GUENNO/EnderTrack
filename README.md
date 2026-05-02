# EnderTrack

<p align="center">
  <img src="assets/icons/endertrack-logo_header.svg" alt="EnderTrack" height="64">
</p>

<p align="center">
  <strong>Contrôleur de position 3D pour platines XYZ motorisées.</strong><br>
  Simulateur intégré ou pilotage réel via G-code (USB série). Interface web légère avec serveur Python.
</p>

---

## Versions

| Branche | Description | Commande |
|---------|-------------|----------|
| [`basic`](../../tree/basic) | v1.0 — navigation, listes de positions, connexion série | `git clone -b basic https://github.com/Hugo-LE-GUENNO/EnderTrack.git` |
| [`plugins`](../../tree/plugins) | Plugins additionnels compatibles | `git clone -b plugins https://github.com/Hugo-LE-GUENNO/EnderTrack.git` |

## Démarrage rapide

```bash
git clone -b basic https://github.com/Hugo-LE-GUENNO/EnderTrack.git
cd EnderTrack
python3 endertrack-server.py
```

Ouvrir http://localhost:5000 — c'est tout. Zéro installation, les dépendances sont incluses.

## Fonctionnalités

- **Visualisation XY + Z** — temps réel si connecté, simulateur sinon
- **Navigation** — pas à pas (flèches clavier) ou positionnement absolu (clic sur canvas)
- **Listes de positions** — sauvegarde, chargement, automatisation simple
- **Plugins** — système extensible, déposer un dossier dans `plugins/`

## Plugins

| Plugin | Description |
|--------|-------------|
| 🎮 Contrôleur Externe | Mapping personnalisable clavier + gamepad |
| 🔩 Extruder | Contrôle moteur extrudeur |
| 🌡️ TempoBed | Contrôle température plateau chauffant |

Pour installer un plugin : copiez son dossier dans `plugins/` puis activez-le dans Réglages → Extensions.

## Accès réseau

```bash
python3 endertrack-server.py                # local uniquement (défaut)
python3 endertrack-server.py --lan           # accès réseau local
python3 endertrack-server.py --port 8080     # port personnalisé
python3 endertrack-server.py --lan --port 3000
```

Avec `--lan`, ouvrir l'adresse affichée depuis n'importe quel appareil du même réseau (tablette, téléphone, autre PC).

## Raspberry Pi

```bash
git clone -b basic https://github.com/Hugo-LE-GUENNO/EnderTrack.git
cd EnderTrack
python3 endertrack-server.py --lan
```

Ouvrir `http://<IP_DU_PI>:5000` depuis n'importe quel appareil du réseau (`hostname -I` pour trouver l'IP).

### Démarrage automatique au boot

```bash
sudo tee /etc/systemd/system/endertrack.service << EOF
[Unit]
Description=EnderTrack Server
After=network.target

[Service]
ExecStart=/usr/bin/python3 $(pwd)/endertrack-server.py --lan
WorkingDirectory=$(pwd)
User=$USER
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable endertrack
sudo systemctl start endertrack
```

## Créer un plugin

Un plugin = un dossier dans `plugins/` avec 4 fichiers :

```
plugins/mon-plugin/
├── plugin.json    # Manifeste
├── bridge.js      # Logique métier
├── ui.js          # Interface
└── ui.css         # Styles (optionnel)
```

### plugin.json

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

> **Important** : `id` en camelCase. Le plugin manager cherche les classes `MonPluginBridge` et `MonPluginPluginUI` (première lettre de l'id en majuscule).

### bridge.js — Logique

```javascript
class MonPluginBridge {
  activate() {
    // Appelé quand le plugin est activé
  }

  deactivate() {
    // Appelé quand le plugin est désactivé
  }

  getStatus() {
    return { connected: true };
  }
}

window.MonPluginBridge = MonPluginBridge;
```

### ui.js — Interface

```javascript
class MonPluginPluginUI {
  constructor(manifest, bridge) {
    this.manifest = manifest;
    this.bridge = bridge;
    this._el = null;
  }

  init() {
    this.bridge.activate();
    // Injecter l'UI dans le panneau plugins
    const zone = document.getElementById('navPluginZone');
    if (!zone) return;
    this._el = document.createElement('div');
    this._el.innerHTML = '<button onclick="alert(\'Hello\')">Mon Bouton</button>';
    zone.appendChild(this._el);
  }

  destroy() {
    this.bridge.deactivate();
    this._el?.remove();
  }
}

window.MonPluginPluginUI = MonPluginPluginUI;
```

### API disponible

```javascript
// Position
EnderTrack.State.get().pos              // {x, y, z}

// Mouvement
EnderTrack.Movement.moveAbsolute(x, y, z)
EnderTrack.Movement.moveRelative(dx, dy, dz)

// Notifications
EnderTrack.UI.showNotification('Message', 'success')

// Events
EnderTrack.State.on('state:changed', (newState, oldState) => { })

// Canvas
EnderTrack.Canvas.requestRender()
```

Voir `plugins/random-button/` pour un exemple complet.

<details>
<summary>📋 Prompt IA — Générer un plugin</summary>

Copier-coller ce prompt dans un agent IA (ChatGPT, Claude, etc.) :

```
Crée un plugin EnderTrack avec les fichiers suivants :
- plugin.json (manifeste avec id en camelCase, folder = nom du dossier)
- bridge.js (classe [Id]Bridge avec activate/deactivate/getStatus, exposée sur window)
- ui.js (classe [Id]PluginUI avec init/destroy, injecte l'UI dans document.getElementById('navPluginZone'))
- ui.css (styles optionnels)

Convention de nommage : si id = "monPlugin", les classes sont MonPluginBridge et MonPluginPluginUI.

API disponible :
- EnderTrack.State.get().pos → {x, y, z} position actuelle
- EnderTrack.Movement.moveAbsolute(x, y, z) / moveRelative(dx, dy, dz)
- EnderTrack.UI.showNotification(message, type) — type: 'success', 'error', 'info'
- EnderTrack.State.on('state:changed', (newState, oldState) => {})
- EnderTrack.Canvas.requestRender()

Le plugin doit : [DÉCRIRE CE QUE LE PLUGIN DOIT FAIRE]
```

</details>

## Créer un module (nouvelle version)

Un module va plus loin qu'un plugin : il ajoute un onglet, un panneau, ou modifie le comportement du core. Créer un module = créer une nouvelle version d'EnderTrack.

### Étapes

1. **Forker la branche `basic`**
```bash
git clone -b basic https://github.com/Hugo-LE-GUENNO/EnderTrack.git endertrack-maversion
cd endertrack-maversion
```

2. **Ajouter un onglet** dans `index.html`
```html
<!-- Bouton onglet -->
<button class="tab-btn" id="monModuleTab" onclick="switchTab('monModule')">
    🔬 Mon Module
</button>

<!-- Contenu onglet -->
<div class="tab-panel" id="monModuleTabContent">
    <!-- Interface du module -->
</div>
```

3. **Créer le module** dans `modules/mon-module.js`
```javascript
class MonModule {
  constructor() { this.isActive = false; }

  activate() {
    this.isActive = true;
    this.createUI();
  }

  deactivate() { this.isActive = false; }

  createUI() {
    const container = document.getElementById('monModuleTabContent');
    if (!container) return;
    container.innerHTML = '<div>Mon interface</div>';
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.MonModule = new MonModule();
```

4. **Charger le module** dans `index.html`
```html
<script src="modules/mon-module.js"></script>
```

5. **Activer sur le bon onglet** dans `main.js` (dans `switchTab`)
```javascript
} else if (tabId === 'monModule' && window.EnderTrack?.MonModule) {
    window.EnderTrack.MonModule.activate();
}
```

### Points d'extension

| Zone | Comment |
|------|---------|
| **Onglet gauche** | Ajouter `tab-btn` + `tab-panel` dans `index.html` |
| **Panneau droit** | Ajouter un `div` dans `.right-panel` de `index.html` |
| **Canvas overlay** | Ajouter un renderer dans `modules/canvas/renderers/` |
| **Routes serveur** | Ajouter un module Python dans `server/` |
| **Panneau Z** | Étendre `modules/canvas/z-interactions.js` |

### Publier comme nouvelle version

Créer une nouvelle branche sur le repo :
```bash
git checkout -b ma-version
git push origin ma-version
```

Puis ajouter la branche dans le tableau des versions du README principal.

<details>
<summary>📋 Prompt IA — Générer un module</summary>

Copier-coller ce prompt dans un agent IA :

```
Crée un module EnderTrack à partir de la version basic (https://github.com/Hugo-LE-GUENNO/EnderTrack/tree/basic).

Structure du projet :
- index.html : interface principale avec onglets (tab-btn + tab-panel), panneau gauche (400px), canvas central, panneau droit (250px)
- main.js : bootstrap, switchTab() gère l'activation/désactivation des modules
- modules/ : un fichier JS par module, exposé sur window.EnderTrack.[NomModule]
- server/ : modules Python Flask (basic_functions, stage_connection, plugin_router)
- endertrack-server.py : point d'entrée serveur, assemble les modules server/

Pour ajouter un module :
1. Créer modules/mon-module.js avec classe ayant activate()/deactivate()/createUI()
2. Ajouter un onglet dans index.html (tab-btn + tab-panel)
3. Charger le script dans index.html
4. Ajouter le cas dans switchTab() de main.js
5. Si backend nécessaire : créer server/mon_module.py avec register_routes(app) et l'importer dans endertrack-server.py

API disponible :
- EnderTrack.State.get() → état complet (pos, zoom, plateauDimensions, etc.)
- EnderTrack.State.update(changes) → met à jour l'état
- EnderTrack.State.on('state:changed', callback) → écouter les changements
- EnderTrack.Movement.moveAbsolute(x, y, z) / moveRelative(dx, dy, dz)
- EnderTrack.Canvas.requestRender() → forcer un rendu
- EnderTrack.UI.showNotification(message, type)
- EnderTrack.Navigation.setSensitivity(axis, value)

Le module doit : [DÉCRIRE CE QUE LE MODULE DOIT FAIRE]
```

</details>

## Liens

- [enderscope.py](https://github.com/mutterer/enderscopy) ([publication](https://dx.doi.org/10.1016/j.softx.2025.102210))
- [EnderScope](https://github.com/Pickering-Lab/EnderScope) ([publication](http://doi.org/10.1098/rsta.2023.0214))
- [diy.microscopie.org](https://diy.microscopie.org/explore.html)

## Licence

GPLv3 — Hugo Le Guenno, 2025

*Né au CNRS suite à l'école thématique MIFOBIO 2025, porté par l'EnderTeam.*

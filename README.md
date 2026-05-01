# EnderTrack Plugins

Plugins compatibles avec toutes les versions d'EnderTrack.

## Installation

Copiez le dossier d'un plugin dans le `plugins/` de votre EnderTrack, puis activez-le dans Réglages → Extensions.

## Plugins disponibles

| Plugin | Description |
|--------|-------------|
| 🎮 Contrôleur Externe | Mapping personnalisable clavier + gamepad, profils, actions remappables |
| 🔩 Extruder | Contrôle moteur extrudeur — avance/recul avec vitesse réglable |
| 🌡️ TempoBed | Température plateau chauffant — on/off, consigne, monitoring temps réel |

## Créer un plugin

```
mon-plugin/
├── plugin.json    # Manifeste (obligatoire)
├── bridge.js      # Logique (obligatoire)
├── ui.js          # Interface (obligatoire)
└── ui.css         # Styles (optionnel)
```

## Licence

GPLv3

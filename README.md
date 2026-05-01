# EnderTrack Plugins

Plugins compatibles avec toutes les versions d'EnderTrack (basic, imagerie, etc.).

## Installation

Copiez le dossier d'un plugin dans le `plugins/` de votre EnderTrack, puis activez-le dans Réglages → Extensions.

## Plugins disponibles

| Plugin | Description | Catégorie |
|--------|-------------|-----------|
| 🎲 random-button | Bouton position aléatoire (exemple/démo) | Démo |
| 🎬 scenario-builder | Builder visuel de scénarios : boucles, conditions, macros | Automatisation |
| 🐍 python-notebook | Mini-Jupyter intégré avec CodeMirror | Développement |
| 🕹️ controller-v2 (PiloteMoi) | Contrôle directionnel clavier + gamepad | Navigation |
| 🎮 pilote-moi-plus | Mapping personnalisable clavier + gamepad | Navigation |
| 🔩 extruder | Contrôle moteur extrudeur | Matériel |
| 🌡️ tempo-bed | Température plateau chauffant | Matériel |
| 📋 lists-plus | Patterns, exécution séquentielle avancée | Listes |

## Créer un plugin

```
mon-plugin/
├── plugin.json    # Manifeste (obligatoire)
├── bridge.js      # Logique (obligatoire)
├── ui.js          # Interface (obligatoire)
└── ui.css         # Styles (optionnel)
```

Voir `random-button/` pour un exemple minimal.

## Licence

GPLv3

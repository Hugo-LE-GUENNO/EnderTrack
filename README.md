# EnderTrack

**Contrôleur de position 3D pour imprimantes 3D et microscopes.**

Interface web + serveur Python Flask. Simulateur intégré, connexion USB série (G-code), listes de positions, automatisation et système de plugins.

---

## Versions

| Branche | Description | Télécharger |
|---------|-------------|-------------|
| [`basic`](../../tree/basic) | Version minimale — simulateur, navigation, listes, connexion série | `git clone -b basic` |
| `imagerie` | *(à venir)* — Scenario Builder, Python Notebook, acquisition multi-dimensionnelle | `git clone -b imagerie` |
| [`plugins`](../../tree/plugins) | Collection de plugins compatibles toutes versions | `git clone -b plugins` |

## Démarrage rapide

```bash
# Télécharger la version basic
git clone -b basic https://github.com/Hugo-LE-GUENNO/endertrack.git
cd endertrack

# Lancer
python3 endertrack-server.py
```

Ouvrir http://localhost:5000 — c'est tout. Zéro installation, les dépendances sont incluses.

## Ajouter des plugins

```bash
# Depuis la branche plugins, copier un plugin dans votre EnderTrack
git clone -b plugins https://github.com/Hugo-LE-GUENNO/endertrack.git endertrack-plugins
cp -r endertrack-plugins/plugins/scenario-builder/ mon-endertrack/plugins/
```

Puis activer dans Réglages → Extensions.

## Plugins disponibles

| Plugin | Description |
|--------|-------------|
| 🎬 Scenario Builder | Builder visuel : boucles, conditions, macros, variables, code Python |
| 🐍 Python Notebook | Mini-Jupyter intégré avec CodeMirror et kernel persistant |
| 🕹️ PiloteMoi | Contrôle directionnel clavier + gamepad |
| 🎮 PiloteMoi+ | Mapping personnalisable clavier + gamepad |
| 🔩 Extruder | Contrôle moteur extrudeur |
| 🌡️ TempoBed | Température plateau chauffant |
| 📋 Lists+ | Patterns avancés, exécution séquentielle |
| 🎲 Random Button | Exemple/démo de plugin |

## Fonctionnalités

- **Canvas XY + Z** — visualisation temps réel avec zoom/pan
- **Simulateur** — fonctionne sans matériel
- **Connexion USB** — compatible tout stage G-code (Ender-3, etc.)
- **Listes de positions** — clic sur canvas, sauvegarde JSON, automatisation
- **Navigation clavier** — flèches avec détection diagonale
- **Système de plugins** — déposer un dossier dans `plugins/`, auto-découvert

## Liens

- [enderscope.py](https://github.com/mutterer/enderscopy) ([publication](https://dx.doi.org/10.1016/j.softx.2025.102210))
- [EnderScope](https://github.com/Pickering-Lab/EnderScope) ([publication](http://doi.org/10.1098/rsta.2023.0214))
- [diy.microscopie.org](https://diy.microscopie.org/explore.html)

## Licence

GPLv3 — Hugo Le Guenno, 2025

*Né au CNRS suite à l'école thématique MIFOBIO 2025, porté par l'EnderTeam.*

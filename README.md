# EnderTrack

<p align="center">
  <img src="assets/icons/endertrack-logo_header.svg" alt="EnderTrack" height="64">
</p>

<p align="center">
  <strong>Contrôleur et simulateur de position 3D pour stages XYZ motorisés.</strong><br>
  Interface web + serveur Python Flask. Simulateur intégré, connexion USB série (G-code) et système de plugins.
</p>

---

## Versions

| Branche | Description | Commande |
|---------|-------------|----------|
| [`basic`](../../tree/basic) | Version minimale — simulateur, navigation, listes, connexion série | `git clone -b basic https://github.com/Hugo-LE-GUENNO/EnderTrack.git` |
| [`plugins`](../../tree/plugins) | Plugins additionnels compatibles | `git clone -b plugins https://github.com/Hugo-LE-GUENNO/EnderTrack.git` |

## Démarrage rapide

```bash
git clone -b basic https://github.com/Hugo-LE-GUENNO/EnderTrack.git
cd EnderTrack
python3 endertrack-server.py
```

Ouvrir http://localhost:5000 — c'est tout. Zéro installation, les dépendances sont incluses.

## Fonctionnalités

- **Canvas XY + Z** — visualisation temps réel avec zoom/pan
- **Simulateur** — fonctionne sans matériel
- **Connexion USB** — compatible tout stage G-code (Ender-3, stages microscope, etc.)
- **Listes de positions** — clic sur canvas, sauvegarde JSON, automatisation
- **Navigation clavier** — flèches avec détection diagonale
- **Système de plugins** — déposer un dossier dans `plugins/`, auto-découvert

## Plugins

| Plugin | Description |
|--------|-------------|
| 🎮 Contrôleur Externe | Mapping personnalisable clavier + gamepad |
| 🔩 Extruder | Contrôle moteur extrudeur |
| 🌡️ TempoBed | Contrôle température plateau chauffant |

Pour installer un plugin : copiez son dossier dans `plugins/` puis activez-le dans Réglages → Extensions.

## Connecter un stage

Dans Réglages → Support XYZ — Connexion :
1. Sélectionner le port (`/dev/ttyUSB0`, `COM3`, etc.)
2. Cliquer "Connecter"
3. Le nom du device est auto-détecté via M115

## Liens

- [enderscope.py](https://github.com/mutterer/enderscopy) ([publication](https://dx.doi.org/10.1016/j.softx.2025.102210))
- [EnderScope](https://github.com/Pickering-Lab/EnderScope) ([publication](http://doi.org/10.1098/rsta.2023.0214))
- [diy.microscopie.org](https://diy.microscopie.org/explore.html)

## Licence

GPLv3 — Hugo Le Guenno, 2025

*Né au CNRS suite à l'école thématique MIFOBIO 2025, porté par l'EnderTeam.*

# EnderTrack

<p align="center">
  <img src="assets/icons/endertrack-logo_header.svg" alt="EnderTrack" height="64">
</p>

<p align="center">
  <strong>Contrôleur de position 3D pour platines XYZ motorisées.</strong><br>
  Interface web + serveur Python. Simulateur intégré ou pilotage réel via G-code.
</p>

---

## Installation

```bash
git clone -b basic https://github.com/Hugo-LE-GUENNO/EnderTrack.git
cd EnderTrack
python3 endertrack-server.py
```

Ouvrir http://localhost:5000 — zéro installation, dépendances incluses.

Mettre à jour : `git pull` · Historique : [tags](../../tags)

Accès tablette/téléphone : `python3 endertrack-server.py --lan` · 👉 **[Réseau, hotspot, RPi](docs/network.md)**

## Éditions

Chaque édition est une **branche** avec ses propres modules.

| Édition | Modules | Version |
|---------|---------|---------|
| [`basic`](../../tree/basic) | Navigation, listes, tactile, responsive | v2.1.0 |
| *imagerie* | *basic + caméra, Z-stack, time-lapse* | *à venir* |

Pour une autre édition : `git clone -b <edition> https://github.com/Hugo-LE-GUENNO/EnderTrack.git`

## Plugins

Compatibles avec toutes les éditions.

| Plugin | Dossier | Description | Installation |
|--------|---------|-------------|-------------|
| 🎮 Contrôleur Externe | `external-controller` | Mapping clavier + gamepad | `cp -r /tmp/et-plugins/plugins/external-controller plugins/` |
| 🔩 Extruder | `extruder` | Contrôle moteur extrudeur | `cp -r /tmp/et-plugins/plugins/extruder plugins/` |
| 🌡️ TempoBed | `tempo-bed` | Température plateau chauffant | `cp -r /tmp/et-plugins/plugins/tempo-bed plugins/` |

**Via l'interface** : Réglages → Extensions → Catalogue (installe en un clic).

**Manuellement** :
```bash
git clone -b plugins https://github.com/Hugo-LE-GUENNO/EnderTrack.git /tmp/et-plugins
cp -r /tmp/et-plugins/plugins/<dossier> plugins/
```

👉 **[Créer un plugin](docs/plugins.md)** · Catalogue : branche [`plugins`](../../tree/plugins)

## Contribuer

| Contribution | Comment |
|-------------|---------|
| 🔌 Plugin | Fork → branche `plugins` → PR |
| 🔬 Édition spécialisée | Fork → branche depuis `basic` → PR |
| 🐛 Bug / idée | [Issue](../../issues) |

👉 **[CONTRIBUTING.md](CONTRIBUTING.md)** · **[Créer un module](docs/modules.md)**

## Liens

- [enderscope.py](https://github.com/mutterer/enderscopy) ([publi](https://dx.doi.org/10.1016/j.softx.2025.102210))
- [EnderScope](https://github.com/Pickering-Lab/EnderScope) ([publi](http://doi.org/10.1098/rsta.2023.0214))
- [diy.microscopie.org](https://diy.microscopie.org/explore.html)

## Licence

GPLv3 — Hugo Le Guenno, 2025

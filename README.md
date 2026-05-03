# EnderTrack

<p align="center">
  <img src="assets/icons/endertrack-logo_header.svg" alt="EnderTrack" height="64">
</p>

<p align="center">
  <strong>Contrôleur de position 3D pour platines XYZ motorisées.</strong><br>
  Interface web + serveur Python. Simulateur intégré ou pilotage réel via G-code.
</p>

---

## Éditions

Chaque édition est une **branche** avec ses propres modules. Choisir une fois, puis suivre ses mises à jour.

| Édition | Modules | Version |
|---------|---------|---------|
| [`basic`](../../tree/basic) | Navigation, listes, tactile, responsive | v2.1.0 |
| *imagerie* | *basic + caméra, Z-stack, time-lapse* | *à venir* |

```bash
git clone -b basic https://github.com/Hugo-LE-GUENNO/EnderTrack.git
cd EnderTrack
python3 endertrack-server.py
```

Ouvrir http://localhost:5000 — zéro installation, dépendances incluses.

Mettre à jour : `git pull` · Historique : [tags](../../tags)

## Réseau

```bash
python3 endertrack-server.py --lan    # accès depuis tablette/téléphone
```

👉 **[Hotspot WiFi, 4G/5G, Raspberry Pi](docs/network.md)**

## Plugins

Compatibles avec toutes les éditions. Installer : copier dans `plugins/` → Réglages → Extensions.

| Plugin | Description |
|--------|-------------|
| 🎮 Contrôleur Externe | Mapping clavier + gamepad |
| 🔩 Extruder | Contrôle moteur extrudeur |
| 🌡️ TempoBed | Température plateau chauffant |

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

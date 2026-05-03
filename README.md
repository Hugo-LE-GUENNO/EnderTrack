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

| Édition | Modules | Dernière version |
|---------|---------|-----------------|
| [`basic`](../../tree/basic) | Navigation, listes, plugins | v2.1 |
| *imagerie* | *basic + caméra, Z-stack, time-lapse* | *à venir* |

```bash
git clone -b basic https://github.com/Hugo-LE-GUENNO/EnderTrack.git
```

### Mises à jour

Les **versions** (v1.0, v2.0, v2.1...) sont les mises à jour d'une édition. Voir les [tags](../../tags).

```bash
git pull    # mettre à jour vers la dernière version de son édition
```

### Plugins

Compatibles avec toutes les éditions. Voir la branche [`plugins`](../../tree/plugins).

## Démarrage

```bash
git clone -b basic https://github.com/Hugo-LE-GUENNO/EnderTrack.git
cd EnderTrack
python3 endertrack-server.py
```

Ouvrir http://localhost:5000 — zéro installation, dépendances incluses.

## Fonctionnalités

- **Visualisation XY + Z** — temps réel ou simulateur
- **Navigation** — flèches, clic sur canvas, positionnement absolu
- **Listes de positions** — sauvegarde, parcours, automatisation
- **Tactile** — tablette et smartphone (pan, zoom, tap)
- **Responsive** — du grand écran au smartphone portrait
- **Plugins** — système extensible

## Réseau

```bash
python3 endertrack-server.py --lan    # accès depuis tablette/téléphone
```

👉 **[Hotspot WiFi, 4G/5G, Raspberry Pi](docs/network.md)**

## Plugins

| Plugin | Description |
|--------|-------------|
| 🎮 Contrôleur Externe | Mapping clavier + gamepad |
| 🔩 Extruder | Contrôle moteur extrudeur |
| 🌡️ TempoBed | Température plateau chauffant |

Installer : copier dans `plugins/` → Réglages → Extensions.

👉 **[Créer un plugin](docs/plugins.md)**

## Contribuer

| Contribution | Comment |
|-------------|---------|
| 🔌 Plugin | Fork → branche `plugins` → PR |
| 🔬 Version spécialisée | Fork → branche depuis `basic` → PR |
| 🐛 Bug / idée | [Issue](../../issues) |

👉 **[Guide de contribution](CONTRIBUTING.md)** · **[Créer un module](docs/modules.md)**

## Liens

- [enderscope.py](https://github.com/mutterer/enderscopy) ([publi](https://dx.doi.org/10.1016/j.softx.2025.102210))
- [EnderScope](https://github.com/Pickering-Lab/EnderScope) ([publi](http://doi.org/10.1098/rsta.2023.0214))
- [diy.microscopie.org](https://diy.microscopie.org/explore.html)

## Licence

GPLv3 — Hugo Le Guenno, 2025

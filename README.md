# EnderTrack

<p align="center">
  <img src="assets/icons/endertrack-logo_header.svg" alt="EnderTrack" height="64">
</p>

<p align="center">
  <strong>Contrôleur de position 3D pour platines XYZ motorisées.</strong><br>
  Interface web + serveur Python. Simulateur intégré ou pilotage réel via G-code.
</p>

---

## Versions

| Branche | Description | Commande |
|---------|-------------|----------|
| [`basic`](../../tree/basic) | v2.1 — navigation, listes, tactile, responsive, plugins | `git clone -b basic https://github.com/Hugo-LE-GUENNO/EnderTrack.git` |
| [`plugins`](../../tree/plugins) | Plugins additionnels | `git clone -b plugins https://github.com/Hugo-LE-GUENNO/EnderTrack.git` |

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

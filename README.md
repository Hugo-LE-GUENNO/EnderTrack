# EnderTrack — Basic

Contrôleur de position 3D pour platines XYZ motorisées. Simulateur intégré ou pilotage réel via G-code (USB série).

## Démarrage

```bash
python3 endertrack-server.py
```

Ouvrir http://localhost:5000 — c'est tout. Les dépendances sont incluses dans `vendor/`.

## Fonctionnalités

- **Canvas XY + Z** — visualisation temps réel avec zoom/pan
- **Simulateur intégré** — fonctionne sans matériel
- **Connexion USB** — compatible tout équipement G-code (Ender-3, platines microscope, etc.)
- **Listes de positions** — clic sur canvas, sauvegarde JSON, automatisation
- **Navigation clavier** — flèches avec détection diagonale
- **Système de plugins** — déposer un dossier dans `plugins/`, auto-découvert

## Onglets

| Onglet | Description |
|--------|-------------|
| **Réglages** | Connexion, espace de travail, calques, navigation, stockage, extensions |
| **Navigation** | Flèches directionnelles, sensibilité, positionnement absolu, home |
| **Positions** | Listes, scénarios, clic sur canvas |

## Plugins

Voir la branche [`plugins`](../../tree/plugins) pour les plugins disponibles. Copiez un dossier plugin dans `plugins/` et activez-le dans Réglages → Extensions.

## Liens

- [enderscope.py](https://github.com/mutterer/enderscopy) ([publication](https://dx.doi.org/10.1016/j.softx.2025.102210))
- [EnderScope](https://github.com/Pickering-Lab/EnderScope) ([publication](http://doi.org/10.1098/rsta.2023.0214))
- [diy.microscopie.org](https://diy.microscopie.org/explore.html)

## Licence

GPLv3 — Hugo Le Guenno, 2025

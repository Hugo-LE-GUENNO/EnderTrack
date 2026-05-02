# EnderTrack — Basic

Contrôleur de position 3D pour platines XYZ motorisées. Simulateur intégré ou pilotage réel via G-code (USB série).

## Démarrage

```bash
python3 endertrack-server.py
```

Ouvrir http://localhost:5000 — c'est tout. Les dépendances sont incluses dans `vendor/`.

## Fonctionnalités

- **Visualisation XY + Z** — temps réel si connecté, simulateur sinon
- **Navigation** — pas à pas (flèches clavier) ou positionnement absolu (clic sur canvas)
- **Listes de positions** — sauvegarde, chargement, automatisation simple
- **Plugins** — système extensible, déposer un dossier dans `plugins/`

## Onglets

| Onglet | Description |
|--------|-------------|
| **Réglages** | Connexion, espace de travail, calques, navigation, stockage, extensions |
| **Navigation** | Flèches directionnelles, sensibilité, positionnement absolu, home |
| **Positions** | Listes, scénarios, clic sur canvas |

## Accès réseau

Par défaut le serveur écoute sur `localhost:5000` (accès local uniquement).

```bash
# Accès depuis le réseau local (tablette, téléphone, autre PC)
python3 endertrack-server.py --lan

# Port personnalisé
python3 endertrack-server.py --port 8080

# Les deux
python3 endertrack-server.py --lan --port 3000
```

Avec `--lan`, le serveur affiche l'adresse à utiliser depuis les autres appareils :
```
🌐 Écoute sur http://0.0.0.0:5000
🌐 Accès LAN: http://192.168.1.8:5000
```

Ouvrir cette adresse depuis n'importe quel navigateur sur le même réseau.

## Installation sur Raspberry Pi

```bash
# 1. Cloner
git clone -b basic https://github.com/Hugo-LE-GUENNO/EnderTrack.git
cd EnderTrack

# 2. Lancer (accès réseau pour piloter depuis un autre appareil)
python3 endertrack-server.py --lan
```

Ouvrir `http://<IP_DU_PI>:5000` depuis un navigateur sur le même réseau.

Pour trouver l'IP du Pi : `hostname -I`

### Démarrage automatique au boot (optionnel)

```bash
# Créer un service systemd
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

# Activer
sudo systemctl enable endertrack
sudo systemctl start endertrack

# Vérifier
sudo systemctl status endertrack
```

Le serveur démarre automatiquement à chaque boot du Pi. La platine USB est détectée dans Réglages → Platine XYZ.

## Plugins

Voir la branche [`plugins`](../../tree/plugins) pour les plugins disponibles. Copiez un dossier plugin dans `plugins/` et activez-le dans Réglages → Extensions.

## Liens

- [enderscope.py](https://github.com/mutterer/enderscopy) ([publication](https://dx.doi.org/10.1016/j.softx.2025.102210))
- [EnderScope](https://github.com/Pickering-Lab/EnderScope) ([publication](http://doi.org/10.1098/rsta.2023.0214))
- [diy.microscopie.org](https://diy.microscopie.org/explore.html)

## Licence

GPLv3 — Hugo Le Guenno, 2025

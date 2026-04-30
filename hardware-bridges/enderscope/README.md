# 🔬 Enderscope Hardware Bridge

Pont entre EnderTrack (interface web) et le matériel Enderscope via un serveur Flask.

## Structure

```
enderscope/
├── enderscope-server.py      # Serveur Flask (API REST)
├── enderscope-basic.py       # Librairie hardware simplifiée (Stage, SerialUtils)
├── enderscope-connection.js  # Client JS (côté navigateur)
├── enderscope.py             # Librairie complète (communauté, notebooks Jupyter)
├── vendor/                   # Dépendances embarquées (mode offline)
├── tools/                    # Scripts utilitaires
│   ├── serial-terminal.py    # Terminal série interactif
│   ├── test-baudrates.py     # Test de baudrates
│   └── test-serial.py        # Test de connexion série
├── requirements.txt
├── install-vendor.sh         # Préparer le mode offline
└── README.md
```

## Démarrage rapide

```bash
# Installer les dépendances
pip install -r requirements.txt

# Lancer le serveur
python enderscope-server.py
```

Le serveur écoute sur `http://localhost:5000`.

## 🏜️ Mode offline (désert)

Avant de partir sans internet :

```bash
./install-vendor.sh
```

Les dépendances sont téléchargées dans `vendor/` et le serveur les charge automatiquement.

## API

| Endpoint | Méthode | Description |
|---|---|---|
| `/api/ports` | GET | Liste les ports série |
| `/api/connect` | POST | Connexion (`{port, baudRate}`) |
| `/api/disconnect` | POST | Déconnexion |
| `/api/position` | GET | Position actuelle |
| `/api/move/absolute` | POST | Mouvement absolu (`{x, y, z}`) |
| `/api/move/relative` | POST | Mouvement relatif (`{dx, dy, dz}`) |
| `/api/home` | POST | Homing |
| `/api/gcode` | POST | G-code brut (`{command}`) |
| `/api/emergency_stop` | POST | Arrêt d'urgence (M112) |
| `/api/beep` | POST | Bip (M300) |
| `/api/status` | GET | État du serveur |

## Fichiers

- **enderscope-basic.py** — Utilisé par le serveur. Minimal, juste pyserial. Fire-and-forget.
- **enderscope.py** — Librairie complète pour notebooks Jupyter (mode virtual, plotter 3D, widgets). Non utilisée par le serveur.

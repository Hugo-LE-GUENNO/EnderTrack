# Hardware Bridges — Enderscope

Connexion série vers platines XYZ compatibles G-code.

## Fichiers

- `enderscope-basic.py` — Classe `Stage` simplifiée (pyserial uniquement)
- `enderscope-connection.js` — Pont JavaScript pour le frontend

## Utilisation

La connexion se fait via le serveur `endertrack-server.py` à la racine du projet.
Le frontend communique avec le serveur via les routes `/api/connect`, `/api/move/*`, `/api/gcode`, etc.

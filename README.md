# EnderTrack

3D position controller for 3D printers and microscopes.

Web interface + Python Flask server. Built-in simulator, USB serial connection (G-code), position lists, automation, and a plugin system.

![EnderTrack Screenshot](assets/icons/endertrack-logo_header.svg)

## Quick Start

```bash
python3 endertrack-server.py
```

Open http://localhost:5000 — that's it. All dependencies are bundled in `vendor/`.

## Features

- **XY + Z canvas** — real-time visualization with zoom/pan
- **Simulator** — works without hardware
- **USB serial** — connects to any G-code compatible stage (Ender-3, etc.)
- **Position lists** — click-to-add, save/load JSON, automation
- **Keyboard navigation** — arrow keys with diagonal detection
- **Plugin system** — drop a folder in `plugins/`, auto-discovered

## Tabs

| Tab | Description |
|-----|-------------|
| **Réglages** | Connection, workspace, layers, navigation, storage, extensions |
| **Navigation** | Arrow pad, sensitivity, absolute go-to, home |
| **Positions** | Lists, scenarios, click-on-canvas |

## Connect Hardware

In Réglages → Support XYZ — Connexion:
1. Select port (`/dev/ttyUSB0`)
2. Click "Connecter"
3. Device name auto-detected via M115

## Plugins

Drop a plugin folder in `plugins/` with a `plugin.json`:

```json
{
  "id": "myPlugin",
  "folder": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Does something",
  "icon": "🔌"
}
```

Activate in Réglages → Extensions. See `plugins/random-button/` for an example.

## Links

- [enderscope.py](https://github.com/mutterer/enderscopy) ([paper](https://dx.doi.org/10.1016/j.softx.2025.102210))
- [EnderScope](https://github.com/Pickering-Lab/EnderScope) ([paper](http://doi.org/10.1098/rsta.2023.0214))
- [diy.microscopie.org](https://diy.microscopie.org/explore.html)

## License

GPLv3 — Hugo Le Guenno, 2025

*Born at CNRS from MIFOBIO 2025, carried by the EnderTeam.*

# EnderTrack — basic v2.4.1

3D position controller for motorized XYZ stages. Built-in simulator or real control via G-code (USB serial).

## Getting started

```bash
git clone -b basic https://github.com/Hugo-LE-GUENNO/EnderTrack.git
cd EnderTrack
python3 endertrack-server.py
```

Open http://localhost:5000 — zero setup, dependencies included in `vendor/`.

## Features

- XYZ stage navigation — step-by-step (arrow keys) or absolute positioning (click on canvas)
- Position lists — save, load, drag & drop, duplicate, `P` shortcut
- Built-in simulator — works without hardware
- Touch & responsive — tablet and smartphone ready
- Plugins — drop a folder into `plugins/` and enable in Settings → Extensions

## Network access

```bash
python3 endertrack-server.py --lan
# → displays the address to open from any device on the same network
```

👉 [Network, hotspot, RPi setup](https://github.com/Hugo-LE-GUENNO/EnderTrack/blob/main/docs/network.md)

## More

👉 [Full documentation, editions, plugins](https://github.com/Hugo-LE-GUENNO/EnderTrack)

## License

GPLv3 — Hugo Le Guenno, 2025

# EnderTrack — imaging v1.2.4

3D position controller for motorized XYZ stages, with image acquisition. Built-in simulator or real control via G-code (USB serial).

## Getting started

```bash
git clone -b imaging https://github.com/Hugo-LE-GUENNO/EnderTrack.git
cd EnderTrack
python3 endertrack-server.py
```

Open http://localhost:5000 — zero setup, dependencies included in `vendor/`.

## Features

Everything in `basic`, plus:

- Image acquisition — camera control, lighting, triggered capture
- Image gallery — browse and manage captured images
- Acquisition scenarios — automate capture sequences across positions

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

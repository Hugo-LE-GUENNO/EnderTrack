# EnderTrack — imaging v1.3.1

<p align="center">
  <img src="assets/icons/endertrack-logo_header.svg" alt="EnderTrack" height="64">
</p>

<p align="center">
  <strong>3D position controller for motorized XYZ stages, with image acquisition.</strong><br>
  Web interface + Python server. Built-in simulator or real control via G-code.
</p>

---

## Getting started

```bash
git clone -b imaging https://github.com/Hugo-LE-GUENNO/EnderTrack.git
cd EnderTrack
python3 endertrack-server.py
```

Open http://localhost:5000 — zero setup, dependencies included in `vendor/`.

Update: `git pull`

## Features

Everything in [`basic`](../../tree/basic), plus:

- **Camera control** — live view, exposure, gain, white balance
- **Image acquisition** — triggered capture, save to server or browser download
- **Lighting** — LED control per channel
- **Image gallery** — browse and manage captured images
- **Histogram** — real-time RGB or grayscale histogram with LUT and contrast stretch
- **Scenario builder** — automate acquisition sequences across position lists, with loops, waits, autofocus and capture actions
- **Fast Explore** — draw a region on the canvas → auto-generate a grid of positions → run a full acquisition scenario (move + wait + capture) with configurable sweep pattern

## Network access

```bash
python3 endertrack-server.py --lan
# → displays the address to open from any device on the same network
```

👉 [Network, hotspot, RPi setup](docs/network.md)

## Changelog

### v1.3.1
- Fast Explore: creates a dedicated scenario in the scenario builder (move → wait → capture), with configurable sweep patterns (snake, spiral-in, spiral-out, reverse, random, row by row)
- Fast Explore: optional capture per position, auto-computed wait delay from exposure time
- Live renderer: fixed RGB→grayscale conversion (per-channel stretch, no luminance override)
- Histogram: fixed LUT rendering for RGB mode, fixed redraw on empty data
- Capture button: browser download + parallel server save, flash notification, right-click menu for filename prefix and server path
- Scenario builder: fixed `_updateRunUI` missing method

### v1.3.0
- Scenario builder — major update: tree-based scenario editor, loop types, action registry, variable manager

## More

👉 [Full documentation, editions, plugins](https://github.com/Hugo-LE-GUENNO/EnderTrack)

## License

GPLv3 — Hugo Le Guenno, 2025

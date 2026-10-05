# EnderTrack — imaging v1.3.3

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

### v1.3.3
- Navigation: G28/G92 from G-code console now correctly updates simulator position (new `position:gcode` SSE event, bypasses `_isLocalMove`)
- Navigation: `_remoteArrive` now calls `Canvas.render()` directly to bypass the `isMoving` guard in `state:changed`
- Camera: mosaic tiles correctly rendered in RGB mode — cache invalidated on LUT/RGB switch
- Plugin: new **Gamepad Simple** plugin — D-pad XY, L1/R1 Z, face buttons for capture/home/scenario/add position, Options → G28 XY homing
- Stage: G-code console logs all commands and responses (`[GCODE]`, `[RESP]`, `[POS]`)
- Stage: M400 sent before M114 after G28/G92 to ensure homing is complete before reading position

### v1.3.2
- Performance: removed M114 position polling after every move — dead-reckoning only, M114 only on initial connect
- Performance: canvas render loop decoupled from state events during animation — direct `render()` call from movement RAF
- Performance: track recording and mosaic tiles disabled by default, opt-in toggles in Settings
- Stage settings: movement animation now synced to real hardware duration (server returns actual M400 time)
- Camera: mosaic tile appears instantly on canvas (added to tile array only after image decode)
- Camera: connection status text colored green/red matching XYZ Stage style
- Camera: double-click on any viewport → fullscreen
- Camera: "No device" label replaced by real device label from `enumerateDevices()`
- Settings: removed all emoji icons from section headers and Home button
- Track/history points hidden on canvas when "Record track" is unchecked
- Tiles: `navigatorMode` controlled by tiles toggle
- Fixed `_trackingEnabled` key mismatch between localStorage and state.js

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

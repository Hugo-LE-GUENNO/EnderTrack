# EnderTrack

<p align="center">
  <img src="assets/icons/endertrack-logo_header.svg" alt="EnderTrack" height="64">
</p>

<p align="center">
  <strong>3D position controller for motorized XYZ stages.</strong><br>
  Web interface + Python server. Built-in simulator or real control via G-code.
</p>

---

## Installation

```bash
git clone -b imagerie https://github.com/Hugo-LE-GUENNO/EnderTrack.git
cd EnderTrack
python3 endertrack-server.py
```

Open http://localhost:5000 — zero setup, dependencies included.

Update: `git pull`

Network access: `python3 endertrack-server.py --lan` · 👉 **[Network, hotspot, RPi](docs/network.md)**

## Editions

Each edition is a **branch** with its own feature set.

| Edition | Features | Version |
|---------|---------|---------|
| [`basic`](../../tree/basic) | XYZ stage navigation, position lists | v2.4.1 |
| [`imagerie`](../../tree/imagerie) | basic + image acquisition, camera control, lighting, image gallery | v1.2.4 |
| [`plotter`](../../tree/plotter) | basic + pen plotter (image → XY path) | v1.0.0 |

For another edition: `git clone -b <edition> https://github.com/Hugo-LE-GUENNO/EnderTrack.git`

## Plugins

Compatible with all editions.

Install (replace `<plugin>` with a name from the table below):
```bash
git clone -b plugins https://github.com/Hugo-LE-GUENNO/EnderTrack.git /tmp/et-plugins
cp -r /tmp/et-plugins/plugins/<plugin> plugins/
```

Or via the UI: Settings → Extensions → Catalogue.

| Plugin | `<plugin>` | Description |
|--------|-----------|-------------|
| 🎮 External Controller | `external-controller` | Keyboard + gamepad mapping |
| 🔩 Extruder | `extruder` | Extruder motor control |
| 🌡️ TempoBed | `tempo-bed` | Heated bed temperature |

👉 Catalogue: [`plugins`](../../tree/plugins) branch

## Extending

| | |
|-|-|
| 🔌 Create a plugin | Add buttons, controls or hardware support — [plugins.md](docs/plugins.md) |
| ⚙️ Advanced plugin | Python backend, real-time sync, multi-client — [plugins-advanced.md](docs/plugins-advanced.md) |
| 🔬 Create an edition | Fork `basic` and add a new tab or module — [modules.md](docs/modules.md) |
| 📖 API reference | All available functions for plugins — [api.md](docs/api.md) |
| 🤖 AI prompt | Generate a plugin with any AI assistant — [plugin-prompt.txt](docs/plugin-prompt.txt) |

## Contributing

Found a bug or have an idea? Open an [issue](../../issues).
Want to contribute code? Fork the repo and open a PR.

## About

EnderTrack started as a control interface for [EnderScope](https://github.com/Pickering-Lab/EnderScope) ([paper](http://doi.org/10.1098/rsta.2023.0214)), a DIY microscope built from an Ender 3D printer. It uses [enderscope.py](https://github.com/mutterer/enderscopy) ([paper](https://dx.doi.org/10.1016/j.softx.2025.102210)) to communicate with the motorized stage via G-code.

In practice, EnderTrack drives any G-code-compatible XYZ stage — 3D printers, microscope stages, CNC machines, or any USB serial device.

Project initiated at CNRS following the [MIFOBIO](https://mifobio.fr) 2025 microscopy school. More resources at [diy.microscopie.org](https://diy.microscopie.org/explore.html).

### Acknowledgements

- [EnderScope](https://github.com/Pickering-Lab/EnderScope) — Pickering Lab (original project)
- Jérôme, Erwan and Aliénor — EnderTeam
- Wassim Jaziri — logo design
- CNRS / RTmfm ("PPP" Working Group)

## License

GPLv3 — Hugo Le Guenno, 2025

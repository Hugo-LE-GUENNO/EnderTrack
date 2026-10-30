# EnderTrack

<p align="center">
  <img src="assets/icons/endertrack-logo_header.svg" alt="EnderTrack" height="64">
</p>

<p align="center">
  <strong>3D position controller for motorized XYZ stages.</strong><br>
  Web interface + Python server. Built-in simulator or real control via G-code.
</p>

---

## Editions

| Edition | Features |
|---------|----------|
| [**imaging**](https://github.com/Hugo-LE-GUENNO/EnderTrack/tree/imaging) ← recommended | Stage control + camera, lighting, plugins, scenario builder |
| [basic](https://github.com/Hugo-LE-GUENNO/EnderTrack/tree/basic) | Stage control only — lightweight |

## Getting started

See the [imaging edition](https://github.com/Hugo-LE-GUENNO/EnderTrack/blob/imaging/README.md).

## About

EnderTrack started as a control interface for [EnderScope](https://github.com/Pickering-Lab/EnderScope) ([paper](http://doi.org/10.1098/rsta.2023.0214)), a DIY microscope built from an Ender 3D printer. It uses [enderscope.py](https://github.com/mutterer/enderscopy) ([paper](https://dx.doi.org/10.1016/j.softx.2025.102210)) to communicate with the motorized stage via G-code.

In practice, EnderTrack drives any G-code-compatible XYZ stage — 3D printers, microscope stages, CNC machines, or any USB serial device.

Project initiated at CNRS following the [MIFOBIO](https://mifobio.fr) 2025 microscopy school. More resources at [diy.microscopie.org](https://diy.microscopie.org/explore.html).

## License

GPLv3 — Hugo Le Guenno, 2025

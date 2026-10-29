# EnderTrack — imaging v1.3.5

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

### Network access

```bash
python3 endertrack-server.py --lan
# → displays the address to open from any device on the same network
```

👉 [Network, hotspot, RPi setup](docs/network.md)

## Raspberry Pi setup

On a **Raspberry Pi with PiCamera**, install system dependencies once:

```bash
# Camera (Picamera2)
sudo apt install -y python3-picamera2

# NeoPixel LEDs on GPIO
sudo pip3 install rpi_ws281x adafruit-circuitpython-neopixel
```

> ⚠️ **Run with `sudo`** on Raspberry Pi if you use:
> - **GPIO NeoPixel LEDs** — requires root for hardware PWM
> - **Saving images to a specific folder** — may require root depending on permissions
>
> ```bash
> sudo python3 endertrack-server.py
> ```

Open http://localhost:5000 from any browser on the same network — zero setup, dependencies included in `vendor/`.

## Extensions

### JS plugins

Drop a folder into `plugins/` and enable it from the Plugins tab. No restart needed.

👉 [Create a JS plugin](docs/advanced-plugins.md)  
👉 [Community plugins](https://github.com/Hugo-LE-GUENNO/EnderTrack-plugins-community)

### Python plugins

Run Python code server-side — access stage, camera, LEDs, lists and the event bus from a `.py` file.

👉 [Python plugin tutorial](docs/python-plugins.md)  
👉 [Community plugins](https://github.com/Hugo-LE-GUENNO/EnderTrack-plugins-community)

## More

👉 [Full documentation, editions](https://github.com/Hugo-LE-GUENNO/EnderTrack)  
👉 [Changelog](docs/changelog.md)

## License

GPLv3 — Hugo Le Guenno, 2025

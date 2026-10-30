# Raspberry Pi setup

## Camera (Picamera2)

```bash
sudo apt install -y python3-picamera2
```

## NeoPixel LEDs (GPIO)

```bash
sudo pip3 install rpi_ws281x adafruit-circuitpython-neopixel
```

> ⚠️ NeoPixel LEDs require root for hardware PWM. Always run with `sudo` on RPi.

## Running the server

```bash
sudo python3 endertrack-server.py
```

Use `sudo` if you use GPIO NeoPixel LEDs or save images to a restricted folder.

## NumPy / SciPy compatibility

> ⚠️ Do **not** upgrade NumPy with `pip` on Raspberry Pi.

Picamera2 depends on the system NumPy (1.19.x) compiled against its C extensions.
Upgrading NumPy via pip breaks picamera2 with:

```
ValueError: numpy.dtype size changed, may indicate binary incompatibility.
```

If you need SciPy, install a version compatible with NumPy 1.19.x (≤ 1.6.x) — or implement the needed functions with NumPy directly.

## Network

See [Network, hotspot, RPi setup](network.md).

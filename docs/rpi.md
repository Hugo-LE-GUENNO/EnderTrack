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

## Network

See [Network, hotspot, RPi setup](network.md).

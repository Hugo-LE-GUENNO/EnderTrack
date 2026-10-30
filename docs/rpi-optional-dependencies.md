# Raspberry Pi setup

## Camera (Picamera2)

```bash
sudo apt install -y python3-picamera2
```

## NeoPixel LEDs (GPIO)

```bash
sudo pip3 install rpi_ws281x adafruit-circuitpython-neopixel
```

## Running the server

```bash
sudo python3 endertrack-server.py
```

NeoPixel LEDs require root for hardware PWM.

## NumPy

Do not upgrade NumPy with `pip` — picamera2 requires the system version (1.19.x).

## Network

See [Network, hotspot, RPi setup](network.md).

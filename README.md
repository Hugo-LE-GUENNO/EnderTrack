# EnderTrack — v1.2.4

3D position controller for motorized XYZ stages. Built-in simulator or real control via G-code (USB serial).

## Getting started

```bash
python3 endertrack-server.py
```

Open http://localhost:5000 — that's it. Dependencies are included in `vendor/`.

## Features

- **XY + Z visualization** — real-time when connected, simulator otherwise
- **Navigation** — step-by-step (arrow keys) or absolute positioning (click on canvas)
- **Position lists** — save, load, simple automation, drag & drop, duplicate
- **Touch** — works on tablet and smartphone (pan, zoom, tap)
- **Responsive** — adapts from large screen to portrait smartphone
- **Plugins** — extensible system, drop a folder into `plugins/`

## Tabs

| Tab | Description |
|-----|-------------|
| **Settings** | Connection, workspace, layers, navigation, storage, extensions |
| **Navigation** | Directional arrows, sensitivity, absolute positioning, home |
| **Positions** | Lists, scenarios, click on canvas, drag & drop, duplicate, `P` shortcut |

## 📡 Network access

### Local use (default)

```bash
python3 endertrack-server.py
# → http://localhost:5000
```

The server is only accessible from the machine running it.

### Access from another device (tablet, phone, other PC)

```bash
python3 endertrack-server.py --lan
```

The server displays the address to use:
```
🌐 Listening on http://0.0.0.0:5000
🌐 LAN access: http://192.168.1.42:5000
```

Open this address from any browser **on the same network**.

### 📶 Which network to use?

#### ✅ Home / lab WiFi
Everything works. The PC and smartphone/tablet are on the same network.

#### ⚠️ Eduroam / enterprise WiFi
**Problem**: these networks often isolate devices from each other (client isolation). Two devices on eduroam cannot see each other.

**Solutions**:
1. **Hotspot from the PC** (recommended, see below)
2. Ask IT for a dedicated network or an exception
3. Use a portable WiFi router (TP-Link, GL.iNet...)

#### 📱 WiFi hotspot from the PC (the universal solution)

The PC running EnderTrack creates its own WiFi network. The smartphone/tablet connects to it.

**Linux (GNOME):**
1. Settings → WiFi → ⋮ (menu) → **Turn On Wi-Fi Hotspot**
2. Note the network name and password
3. Connect the smartphone to this network
4. Run `python3 endertrack-server.py --lan`
5. Open the displayed address on the smartphone

**Linux (terminal):**
```bash
# Create a hotspot
nmcli device wifi hotspot ifname wlan0 ssid EnderTrack password endertrack123

# Find the hotspot IP
ip addr show | grep "10.42"
# → typically 10.42.0.1

# Run EnderTrack
python3 endertrack-server.py --lan
# → http://10.42.0.1:5000
```

**Windows 10/11:**
1. Settings → Network → **Mobile hotspot** → Enable
2. Connect the smartphone to the hotspot
3. Run `python3 endertrack-server.py --lan`
4. Open the displayed address

**macOS:**
1. System Preferences → Sharing → **Internet Sharing**
2. Share from: Ethernet/Thunderbolt → To: WiFi
3. Configure WiFi name and password
4. Connect the smartphone, run with `--lan`

#### 📱 Mobile hotspot from smartphone (4G/5G)

The smartphone shares its mobile connection, the PC connects to it.

1. **Smartphone**: Settings → Hotspot → Enable WiFi hotspot
2. **PC**: Connect to the smartphone's WiFi
3. Run `python3 endertrack-server.py --lan`
4. **Smartphone**: open the displayed address in the browser

> 💡 The address is usually `http://192.168.43.x:5000` (Android) or `http://172.20.10.x:5000` (iPhone)

#### 🔌 USB (Raspberry Pi)

If the Pi is connected via USB to the PC, you can use the USB network:
```bash
# On the Pi
python3 endertrack-server.py --lan
# → http://<PI_IP>:5000
```

### Server options

```bash
python3 endertrack-server.py --port 8080        # custom port
python3 endertrack-server.py --lan               # network access
python3 endertrack-server.py --lan --port 3000   # both
```

## Raspberry Pi installation

```bash
# 1. Clone
git clone -b imagerie https://github.com/Hugo-LE-GUENNO/EnderTrack.git
cd EnderTrack

# 2. Run (network access to control from another device)
python3 endertrack-server.py --lan
```

Open `http://<PI_IP>:5000` from a browser on the same network.

To find the Pi's IP: `hostname -I`

### Auto-start on boot (optional)

```bash
sudo tee /etc/systemd/system/endertrack.service << EOF
[Unit]
Description=EnderTrack Server
After=network.target

[Service]
ExecStart=/usr/bin/python3 $(pwd)/endertrack-server.py --lan
WorkingDirectory=$(pwd)
User=$USER
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable endertrack
sudo systemctl start endertrack
sudo systemctl status endertrack
```

The server starts automatically on every boot. The USB stage is detected in Settings → XYZ Stage.

## Plugins

See the [`plugins`](../../tree/plugins) branch for available plugins. Copy a plugin folder into `plugins/` and enable it in Settings → Extensions.

## Links

- [enderscope.py](https://github.com/mutterer/enderscopy) ([paper](https://dx.doi.org/10.1016/j.softx.2025.102210))
- [EnderScope](https://github.com/Pickering-Lab/EnderScope) ([paper](http://doi.org/10.1098/rsta.2023.0214))
- [diy.microscopie.org](https://diy.microscopie.org/explore.html)

## License

GPLv3 — Hugo Le Guenno, 2025

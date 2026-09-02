# Network access

## Local (default)

```bash
python3 endertrack-server.py
# → http://localhost:5000
```

## Local network

```bash
python3 endertrack-server.py --lan
# → displays the address to open from another device
```

## WiFi hotspot from a PC

The WiFi card switches to Access Point mode — it broadcasts a local WiFi network.

**Linux (GNOME)**: Settings → WiFi → ⋮ → *Turn On Wi-Fi Hotspot*

**Linux (terminal)**:
```bash
nmcli device wifi hotspot ifname wlan0 ssid EnderTrack password endertrack123
python3 endertrack-server.py --lan
# → http://10.42.0.1:5000
```

**Windows**: Settings → Network → *Mobile hotspot* → Enable

**macOS**: System Preferences → Sharing → *Internet Sharing* (Ethernet → WiFi)

## WiFi hotspot from a Raspberry Pi

```bash
sudo nmcli device wifi hotspot ifname wlan0 ssid EnderTrack password endertrack123
python3 endertrack-server.py --lan
# → http://10.42.0.1:5000
```

Persistent hotspot on boot:
```bash
sudo nmcli connection modify Hotspot connection.autoconnect yes
```

## Hotspot + internet

The WiFi card cannot be a hotspot and a client at the same time. To have both:

- **Ethernet + WiFi hotspot** — Ethernet cable for internet, WiFi as hotspot
- **USB tethering + WiFi hotspot** — smartphone connected via USB shares its 4G, PC WiFi as hotspot

## 4G/5G sharing (without PC hotspot)

1. **Smartphone**: Settings → Hotspot → Enable
2. **PC**: Connect to the smartphone's WiFi
3. `python3 endertrack-server.py --lan`
4. **Smartphone**: open the displayed address

## Raspberry Pi — auto-start on boot

```bash
git clone -b basic https://github.com/Hugo-LE-GUENNO/EnderTrack.git
cd EnderTrack

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
```

## Options

```bash
python3 endertrack-server.py --port 8080
python3 endertrack-server.py --lan --port 3000
```

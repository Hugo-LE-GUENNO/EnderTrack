# Accès réseau

## Local (défaut)

```bash
python3 endertrack-server.py
# → http://localhost:5000
```

## Réseau local

```bash
python3 endertrack-server.py --lan
# → affiche l'adresse à ouvrir depuis un autre appareil
```

## Hotspot WiFi depuis un PC

La carte WiFi passe en mode Access Point — elle émet un réseau WiFi local.

**Linux (GNOME)** : Paramètres → WiFi → ⋮ → *Activer le point d'accès Wi-Fi*

**Linux (terminal)** :
```bash
nmcli device wifi hotspot ifname wlan0 ssid EnderTrack password endertrack123
python3 endertrack-server.py --lan
# → http://10.42.0.1:5000
```

**Windows** : Paramètres → Réseau → *Point d'accès sans fil mobile* → Activer

**macOS** : Préférences Système → Partage → *Partage Internet* (Ethernet → WiFi)

## Hotspot WiFi depuis un Raspberry Pi

```bash
sudo nmcli device wifi hotspot ifname wlan0 ssid EnderTrack password endertrack123
python3 endertrack-server.py --lan
# → http://10.42.0.1:5000
```

Hotspot persistant au boot :
```bash
sudo nmcli connection modify Hotspot connection.autoconnect yes
```

## Hotspot + internet

La carte WiFi ne peut pas être hotspot ET client en même temps. Pour avoir les deux :

- **Ethernet + WiFi hotspot** — câble Ethernet pour internet, WiFi en hotspot
- **Tethering USB + WiFi hotspot** — smartphone branché en USB partage sa 4G, WiFi du PC en hotspot

## Partage 4G/5G (sans hotspot PC)

1. **Smartphone** : Paramètres → Partage de connexion → Activer
2. **PC** : Se connecter au WiFi du smartphone
3. `python3 endertrack-server.py --lan`
4. **Smartphone** : ouvrir l'adresse affichée

## Raspberry Pi — démarrage automatique

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

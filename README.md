# EnderTrack — Édition Imagerie v1.2.3

> Basé sur [`basic` v2.4.0](/tree/basic). Ajoute caméra, éclairage, acquisition et scénarios avancés.

Contrôleur de position 3D pour platines XYZ motorisées. Simulateur intégré ou pilotage réel via G-code (USB série).

## Démarrage

```bash
python3 endertrack-server.py
```

Ouvrir http://localhost:5000 — c'est tout. Les dépendances sont incluses dans `vendor/`.

## Fonctionnalités

- **Visualisation XY + Z** — temps réel si connecté, simulateur sinon
- **Navigation** — pas à pas ou mode continu (hold-to-move)
- **Listes de positions** — sauvegarde, chargement, automatisation
- **Tactile** — fonctionne sur tablette et smartphone (pan, zoom, tap)
- **Responsive** — s'adapte du grand écran au smartphone portrait
- **Plugins** — système extensible, déposer un dossier dans `plugins/`
- **Galerie & Stack Viewer** — navigation multi-dimensionnelle (C/Z/T), 8-bit et 16-bit TIFF
- **Contraste par canal** — LUT et min/max indépendants par canal, persistés dans le TIFF
- **Mode Composite** — superposition additive de tous les canaux avec leurs LUT respectives
- **Histogramme temps réel** — données brutes de chaque slice, barres min/max interactives
- **Live Renderer** — pipeline séparé pour le flux caméra (contraste/LUT temps réel)
- **Picamera2** — flux live, capture, autofocus 3 phases, configuration complète
- **NeoPixel (EnderPiLight)** — contrôle LED RGB via GPIO, intégré au scénario
- **Mosaïque** — capture automatique à chaque position, overlay sur canvas
- **Fast Explore** — sélection de zone → grille → exploration automatique
- **Autofocus** — 3 phases (grossier/fin/précis), mode rapide et complet
- **Scénario Builder** — arbre d'actions, multipos, timelapse, z-stack, lumière

## Installation sur Raspberry Pi (Édition Imagerie)

### 1. Prérequis système

```bash
# Mettre à jour
sudo apt update && sudo apt upgrade -y

# Python 3 + pip
sudo apt install -y python3 python3-pip git

# Picamera2 (caméra RPi)
sudo apt install -y python3-picamera2

# NeoPixel (LEDs) — nécessite sudo pour GPIO
sudo pip3 install adafruit-circuitpython-neopixel

# OpenCV (optionnel, améliore l'autofocus)
sudo apt install -y python3-opencv

# Pillow + NumPy (traitement d'image)
sudo pip3 install Pillow numpy
```

### 2. Cloner le dépôt

```bash
git clone -b imagerie https://github.com/Hugo-LE-GUENNO/EnderTrack.git
cd EnderTrack
```

### 3. Lancer

```bash
# Avec sudo (nécessaire pour NeoPixel + Picamera2)
sudo python3 endertrack-server.py --lan
```

Ouvrir `http://<IP_DU_PI>:5000` depuis un navigateur sur le même réseau.

### 4. Hotspot WiFi (accès sans réseau externe)

Le RPi crée son propre réseau WiFi. Les téléphones/tablettes s'y connectent directement.

```bash
# Installer les dépendances (une seule fois, avec internet)
sudo apt install -y dnsmasq

# Configurer l'IP du hotspot
sudo ip link set wlan0 down
sudo ip addr flush dev wlan0
sudo ip addr add 10.42.0.1/24 dev wlan0
sudo ip link set wlan0 up

# Créer la config AP (réseau ouvert)
sudo tee /tmp/ap.conf << EOF
ctrl_interface=/var/run/wpa_supplicant
ap_scan=2

network={
    ssid="EnderTrack"
    mode=2
    key_mgmt=NONE
    frequency=2437
}
EOF

# Lancer le hotspot
sudo wpa_supplicant -B -i wlan0 -c /tmp/ap.conf

# Lancer le serveur DHCP
sudo dnsmasq --interface=wlan0 --bind-interfaces \
    --dhcp-range=10.42.0.10,10.42.0.50,24h --no-daemon &

# Lancer EnderTrack
sudo python3 endertrack-server.py --lan
```

**Connexion** : WiFi `EnderTrack` (ouvert) → `http://10.42.0.1:5000`

> 💡 Pour un réseau protégé, remplacer `key_mgmt=NONE` par `key_mgmt=WPA-PSK` et ajouter `psk="votre_mot_de_passe"`

### 5. Script de démarrage complet

Créer `~/Desktop/start-endertrack.sh` :

```bash
#!/bin/bash
ENDERTRACK_DIR="$HOME/EnderTrack"
IP="10.42.0.1"

echo "🔬 EnderTrack Imagerie — Démarrage"

# Hotspot WiFi
sudo killall wpa_supplicant dnsmasq 2>/dev/null
sudo ip link set wlan0 down
sudo ip addr flush dev wlan0
sudo ip addr add ${IP}/24 dev wlan0
sudo ip link set wlan0 up

sudo tee /tmp/ap.conf > /dev/null << EOF
ctrl_interface=/var/run/wpa_supplicant
ap_scan=2
network={
    ssid="EnderTrack"
    mode=2
    key_mgmt=NONE
    frequency=2437
}
EOF

sudo wpa_supplicant -B -i wlan0 -c /tmp/ap.conf
sudo dnsmasq --interface=wlan0 --bind-interfaces \
    --dhcp-range=10.42.0.10,10.42.0.50,24h --no-daemon &
sleep 2

# Ethernet (optionnel, pour connexion PC)
sudo ip addr add 192.168.10.2/24 dev eth0 2>/dev/null
sudo ip link set eth0 up 2>/dev/null

# Lancer EnderTrack
cd "$ENDERTRACK_DIR"
sudo python3 endertrack-server.py --lan &

echo ""
echo "═══════════════════════════════════════"
echo "  ✅ EnderTrack prêt !"
echo ""
echo "  📱 WiFi : EnderTrack (ouvert)"
echo "  🌐 URL  : http://${IP}:5000"
echo "  💻 USB  : http://192.168.10.2:5000"
echo "═══════════════════════════════════════"

wait
```

```bash
chmod +x ~/Desktop/start-endertrack.sh
```

### 6. Câblage matériel

```
Raspberry Pi GPIO :
├── GPIO 18 (pin 12) → NeoPixel DIN (data)
├── GND              → NeoPixel GND + Ender GND
├── 5V               → NeoPixel VCC
├── USB              → Ender-3 (série /dev/ttyUSB0)
└── CSI              → Picamera2 (nappe caméra)
```

## 📡 Accès réseau

### Utilisation locale (par défaut)

```bash
python3 endertrack-server.py
# → http://localhost:5000
```

### Accès depuis un autre appareil

```bash
python3 endertrack-server.py --lan
```

### Options serveur

```bash
python3 endertrack-server.py --port 8080        # port personnalisé
python3 endertrack-server.py --lan               # accès réseau
python3 endertrack-server.py --lan --port 3000   # les deux
```

## Plugins

Voir la branche [`plugins`](../../tree/plugins) pour les plugins disponibles. Copiez un dossier plugin dans `plugins/` et activez-le dans Réglages → Extensions.

## Liens

- [enderscope.py](https://github.com/mutterer/enderscopy) ([publication](https://dx.doi.org/10.1016/j.softx.2025.102210))
- [EnderScope](https://github.com/Pickering-Lab/EnderScope) ([publication](http://doi.org/10.1098/rsta.2023.0214))
- [diy.microscopie.org](https://diy.microscopie.org/explore.html)

## Licence

GPLv3 — Hugo Le Guenno, 2025

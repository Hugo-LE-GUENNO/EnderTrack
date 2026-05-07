# EnderTrack — v3.0.0

Contrôleur de position 3D pour platines XYZ motorisées. Simulateur intégré ou pilotage réel via G-code (USB série).

## Démarrage

```bash
python3 endertrack-server.py
```

Ouvrir http://localhost:5000 — c'est tout. Les dépendances sont incluses dans `vendor/`.

## Fonctionnalités

- **Visualisation XY + Z** — temps réel si connecté, simulateur sinon
- **Navigation** — pas à pas (flèches clavier) ou positionnement absolu (clic sur canvas)
- **Listes de positions** — sauvegarde, chargement, automatisation simple
- **Tactile** — fonctionne sur tablette et smartphone (pan, zoom, tap)
- **Responsive** — s'adapte du grand écran au smartphone portrait
- **Plugins** — système extensible, déposer un dossier dans `plugins/`

## Onglets

| Onglet | Description |
|--------|-------------|
| **Réglages** | Connexion, espace de travail, calques, navigation, stockage, extensions |
| **Navigation** | Flèches directionnelles, sensibilité, positionnement absolu, home |
| **Positions** | Listes, scénarios, clic sur canvas |

## 📡 Accès réseau

### Utilisation locale (par défaut)

```bash
python3 endertrack-server.py
# → http://localhost:5000
```

Le serveur n'est accessible que depuis la machine qui le lance.

### Accès depuis un autre appareil (tablette, téléphone, autre PC)

```bash
python3 endertrack-server.py --lan
```

Le serveur affiche l'adresse à utiliser :
```
🌐 Écoute sur http://0.0.0.0:5000
🌐 Accès LAN: http://192.168.1.42:5000
```

Ouvrir cette adresse depuis n'importe quel navigateur **sur le même réseau**.

### 📶 Quel réseau utiliser ?

#### ✅ WiFi maison / labo
Tout fonctionne. Le PC et le smartphone/tablette sont sur le même réseau.

#### ⚠️ Eduroam / WiFi entreprise
**Problème** : ces réseaux isolent souvent les appareils entre eux (isolation client). Deux appareils sur eduroam ne peuvent pas se voir.

**Solutions** :
1. **Hotspot depuis le PC** (recommandé, voir ci-dessous)
2. Demander au service IT un réseau dédié ou une exception
3. Utiliser un petit routeur WiFi portable (TP-Link, GL.iNet...)

#### 📱 Hotspot WiFi depuis le PC (la solution universelle)

Le PC qui fait tourner EnderTrack crée son propre réseau WiFi. Le smartphone/tablette s'y connecte.

**Linux (GNOME) :**
1. Paramètres → WiFi → ⋮ (menu) → **Activer le point d'accès Wi-Fi**
2. Noter le nom du réseau et le mot de passe
3. Connecter le smartphone à ce réseau
4. Lancer `python3 endertrack-server.py --lan`
5. Ouvrir l'adresse affichée sur le smartphone

**Linux (terminal) :**
```bash
# Créer un hotspot
nmcli device wifi hotspot ifname wlan0 ssid EnderTrack password endertrack123

# Trouver l'IP du hotspot
ip addr show | grep "10.42"
# → typiquement 10.42.0.1

# Lancer EnderTrack
python3 endertrack-server.py --lan
# → http://10.42.0.1:5000
```

**Windows 10/11 :**
1. Paramètres → Réseau → **Point d'accès sans fil mobile** → Activer
2. Connecter le smartphone au hotspot
3. Lancer `python3 endertrack-server.py --lan`
4. Ouvrir l'adresse affichée

**macOS :**
1. Préférences Système → Partage → **Partage Internet**
2. Partager depuis : Ethernet/Thunderbolt → vers : WiFi
3. Configurer le nom et mot de passe WiFi
4. Connecter le smartphone, lancer avec `--lan`

#### 📱 Partage de connexion depuis le smartphone (4G/5G)

Le smartphone partage sa connexion mobile, le PC s'y connecte.

1. **Smartphone** : Paramètres → Partage de connexion → Activer le point d'accès WiFi
2. **PC** : Se connecter au WiFi du smartphone
3. Lancer `python3 endertrack-server.py --lan`
4. **Smartphone** : ouvrir l'adresse affichée dans le navigateur

> 💡 L'adresse est souvent `http://192.168.43.x:5000` (Android) ou `http://172.20.10.x:5000` (iPhone)

#### 🔌 USB (Raspberry Pi)

Si le Pi est branché en USB au PC, on peut utiliser le réseau USB :
```bash
# Sur le Pi
python3 endertrack-server.py --lan
# → http://<IP_PI>:5000
```

### Options serveur

```bash
python3 endertrack-server.py --port 8080        # port personnalisé
python3 endertrack-server.py --lan               # accès réseau
python3 endertrack-server.py --lan --port 3000   # les deux
```

## Installation sur Raspberry Pi

```bash
# 1. Cloner
git clone -b basic https://github.com/Hugo-LE-GUENNO/EnderTrack.git
cd EnderTrack

# 2. Lancer (accès réseau pour piloter depuis un autre appareil)
python3 endertrack-server.py --lan
```

Ouvrir `http://<IP_DU_PI>:5000` depuis un navigateur sur le même réseau.

Pour trouver l'IP du Pi : `hostname -I`

### Démarrage automatique au boot (optionnel)

```bash
# Créer un service systemd
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

# Activer
sudo systemctl enable endertrack
sudo systemctl start endertrack

# Vérifier
sudo systemctl status endertrack
```

Le serveur démarre automatiquement à chaque boot du Pi. La platine USB est détectée dans Réglages → Platine XYZ.

## Plugins

Voir la branche [`plugins`](../../tree/plugins) pour les plugins disponibles. Copiez un dossier plugin dans `plugins/` et activez-le dans Réglages → Extensions.

## Liens

- [enderscope.py](https://github.com/mutterer/enderscopy) ([publication](https://dx.doi.org/10.1016/j.softx.2025.102210))
- [EnderScope](https://github.com/Pickering-Lab/EnderScope) ([publication](http://doi.org/10.1098/rsta.2023.0214))
- [diy.microscopie.org](https://diy.microscopie.org/explore.html)

## Licence

GPLv3 — Hugo Le Guenno, 2025

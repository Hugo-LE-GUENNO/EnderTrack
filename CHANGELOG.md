# Changelog

## v1.2.1 — Per-Channel Display, Playback & Persistence

### Nouveautés
- **Lecture timelapse** — bouton ▶ sur le slider T, clic droit pour régler les FPS (1-60)
- **Persistence serveur complète** — LUT/contraste/histogramme sauvés pour live, galerie et stacks
- **Métadonnées enrichies** — Z step/total, T step/total, pixel XY, profondeur (tableau)
- **Per-channel settings** — réécriture complète, chaque canal C a sa propre LUT/contraste

### Corrections
- Fix: LUT stable en slide rapide entre canaux (debounce 150ms + _switching flag)
- Fix: Z/T stacks gardent leur LUT après navigation et refresh
- Fix: histogramme figé pendant la lecture (pas de jitter)
- Fix: barres min/max stables (dataMin/dataMax non recalculés en Z/T)
- Fix: métadonnées correctes pour chaque type d'image (pas de contamination TIFF→PNG)
- Fix: pas de debounce pour fichiers < 200 Mo

### Persistence
- `.live_settings.json` — LUT, contraste, mode auto du live
- `.gallery_settings.json` — settings par image PNG/JPG
- `.stack_settings.json` — settings par canal pour tous les TIFF

## v1.1.0 — Live Renderer & Gallery

- LiveRenderer séparé du GalleryRenderer
- Galerie avec navigation clavier, recherche, stack viewer multi-dimensionnel
- Histogramme 16-bit depuis les données brutes
- Métadonnées OME/ImageJ (dimensions, pixel size, bit depth)

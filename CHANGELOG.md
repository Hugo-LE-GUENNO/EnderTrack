# Changelog

## v1.2.0 — Stack Viewer & Per-Channel Display

### Nouveautés
- **Mode Composite** — superposition additive de tous les canaux, chacun avec sa propre LUT et son propre contraste (checkbox "Comp" à côté du slider C)
- **Contraste par canal** — min/max et LUT sauvegardés indépendamment pour chaque canal C
- **Persistence serveur** — les settings par canal (LUT, min/max, composite) sont sauvegardés dans `.stack_settings.json` et restaurés à la réouverture
- **Debounce intelligent** — navigation instantanée pour les petits fichiers, différée pour les gros (>50 Mo: 150ms, >500 Mo: 500ms)
- **Histogramme par slice** — les données de l'histogramme se mettent à jour à chaque slice, les barres min/max restent synchronisées

### Corrections
- Fix: le contraste ne reset plus en naviguant Z/T (seulement sur changement de canal)
- Fix: l'histogramme ne disparaît plus lors de la navigation rapide
- Fix: les LUT ne se mélangent plus entre canaux lors du slide rapide (debounce + loadId anti-race-condition)
- Fix: pas de clignotement en mode composite (skip render intermédiaire)
- Fix: artefacts "petits carrés" lors du passage 16-bit → 8-bit RGB (reset _keepContrast sur changement de fichier)
- Fix: `fileSize` ajouté à `/api/stack/info` pour le debounce côté client

### API
- `GET /api/stack/settings?file=...` — charge les settings d'affichage par canal
- `POST /api/stack/settings` — sauvegarde les settings (channels, composite)

## v1.1.0 — Live Renderer & Gallery

- LiveRenderer séparé du GalleryRenderer
- Galerie avec navigation clavier, recherche, stack viewer multi-dimensionnel
- Histogramme 16-bit depuis les données brutes
- Métadonnées OME/ImageJ (dimensions, pixel size, bit depth)

// assets/config/paths.js - Configuration centralisée des chemins d'assets

// Server URL: auto-detect based on current host (works for localhost AND remote access)
window.ENDERTRACK_SERVER = `http://${window.location.hostname || 'localhost'}:5000`;

window.AssetPaths = {
  // Icônes SVG
  icons: {
    favicon: 'assets/icons/endertrack-logo_favicon.svg',
    logo: 'assets/icons/endertrack-logo_header.svg',
    emergencyStop: 'assets/icons/emergency-stop-button.svg',
    endertrackLogo: 'assets/icons/endertrack-logo.svg',
    headerLogo: 'assets/icons/endertrack-header-logo.svg',
    exampleTemplate: 'assets/icons/exemple-template.svg',
    compassXY: 'assets/icons/compass-xy.svg',
    compassZ: 'assets/icons/compass-z.svg',
    canvasCompass: 'assets/icons/canvas-compass.svg',
    canvasCompassZ: 'assets/icons/canvas-compass-z.svg',
    resetViewXY: 'assets/icons/reset-view-xy.svg',
    resetViewZ: 'assets/icons/reset-view-z.svg'
  },
  
  // Styles CSS
  styles: {
    main: 'frontend/assets/endertrack.css',
    axisConfig: 'frontend/assets/styles/axis-config.css',
    coordinateConfig: 'frontend/assets/styles/coordinate-config.css',
    templateModal: 'frontend/assets/styles/template-modal.css',
    strategicPositions: 'frontend/assets/styles/strategic-positions.css'
  },
  
  // Scripts
  scripts: {
    initTheme: 'frontend/scripts/init-enderscope-theme.js',
    externalController: 'frontend/scripts/external-controller.js',
    initDisplay: 'frontend/scripts/init-display.js'
  },
  
  // Fonction utilitaire pour obtenir un chemin complet
  get: function(category, name) {
    return this[category] && this[category][name] ? this[category][name] : null;
  },
  
  // Fonction pour mettre à jour un chemin
  set: function(category, name, path) {
    if (!this[category]) this[category] = {};
    this[category][name] = path;
  }
};

// Fonction globale pour accès facile
window.getAssetPath = function(category, name) {
  return window.AssetPaths.get(category, name);
};
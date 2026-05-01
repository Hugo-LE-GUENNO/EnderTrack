// plugins/registry.js — Dynamic plugin registry
// Built-in plugins are declared here as defaults
// User-added plugins (via "Charger un plugin") are persisted in localStorage

(function() {
  // Built-in plugins (always available)
  const builtins = {
    'controllers': {
      "id": "controllers",
      "name": "Contrôleurs Universels",
      "version": "1.0.0",
      "description": "Gamepad, MIDI, Clavier — mapping universel pour piloter EnderTrack",
      "icon": "🎮",
      "tools": [
        { "id": "gamepad", "name": "Gamepad", "icon": "🎮", "type": "input" },
        { "id": "midi", "name": "MIDI", "icon": "🎹", "type": "input" }
      ],
      "widgets": [],
      "navButtons": []
    },
    'history': {
      "id": "history",
      "name": "Historique",
      "version": "1.0.0",
      "description": "Historique des positions, graphiques XYZ, navigation temporelle, tracks",
      "icon": "📜",
      "tools": [],
      "widgets": [],
      "navButtons": []
    },
    'canvasTools': {
      "id": "canvasTools",
      "name": "Canvas Tools",
      "folder": "canvas-tools",
      "version": "1.0.0",
      "description": "Mini-preview XY/Z, boussoles",
      "icon": "🧭",
      "tools": [],
      "widgets": [],
      "navButtons": []
    },
    'overlayPlus': {
      "id": "overlayPlus",
      "name": "Overlay+",
      "folder": "overlay-plus",
      "version": "1.0.0",
      "description": "Templates labo, dessin de formes, import/export",
      "icon": "🎨",
      "tools": [],
      "widgets": [],
      "navButtons": []
    },
    'overStretch': {
      "id": "overStretch",
      "name": "OverStretch",
      "folder": "over-stretch",
      "version": "1.0.0",
      "description": "Calibrer une photo du plateau en sélectionnant les 4 coins",
      "icon": "📐",
      "tools": [],
      "widgets": [],
      "navButtons": []
    },
    'listsPlus': {
      "id": "listsPlus",
      "name": "Lists+",
      "folder": "lists-plus",
      "version": "1.0.0",
      "description": "Patterns, exécution séquentielle, import/export avancé",
      "icon": "📋",
      "tools": [],
      "widgets": [],
      "navButtons": []
    },
    'scenarioPlus': {
      "id": "scenarioPlus",
      "name": "Scenario+",
      "folder": "scenario-plus",
      "version": "1.0.0",
      "description": "Scénarios avancés : builder visuel, conditions, variables",
      "icon": "🎬",
      "tools": [],
      "widgets": [],
      "navButtons": []
    },
    'scenarioBuilder': {
      "id": "scenarioBuilder",
      "name": "Scenario Builder",
      "folder": "scenario-builder",
      "version": "2.0.0",
      "description": "Builder v2 : boucles, conditions, macros collapse, import/export",
      "icon": "🎬",
      "tools": [],
      "widgets": [],
      "navButtons": []
    },
    'piloteMoi': {
      "id": "piloteMoi",
      "name": "PiloteMoi",
      "folder": "controller-v2",
      "version": "1.0.0",
      "description": "Contrôle directionnel clavier + gamepad — step & continu",
      "icon": "🕹️",
      "tools": [],
      "widgets": [],
      "navButtons": []
    },
    'piloteMoiPlus': {
      "id": "piloteMoiPlus",
      "name": "PiloteMoi+",
      "folder": "pilote-moi-plus",
      "version": "1.0.0",
      "description": "Contrôle directionnel avancé — mapping personnalisable, profils, actions gamepad",
      "icon": "🎮",
      "tools": [],
      "widgets": [],
      "navButtons": []
    },
    'extruder': {
      "id": "extruder",
      "name": "Extruder",
      "folder": "extruder",
      "version": "1.0.0",
      "description": "Contrôle moteur extrudeur — avance/recul avec vitesse réglable",
      "icon": "🔩",
      "tools": [],
      "widgets": [],
      "navButtons": []
    },
    'tempoBed': {
      "id": "tempoBed",
      "name": "TempoBed",
      "folder": "tempo-bed",
      "version": "1.0.0",
      "description": "Contrôle température plateau chauffant — on/off, consigne, monitoring",
      "icon": "🌡️",
      "tools": [],
      "widgets": [],
      "navButtons": []
    },
    'enderStage': {
      "id": "enderStage",
      "name": "EnderStage",
      "folder": "enderstage",
      "version": "1.0.0",
      "description": "Auto-détection imprimante via M115 ou sélection manuelle",
      "icon": "🖨️",
      "tools": [],
      "widgets": [],
      "navButtons": []
    },
    'pythonNotebook': {
      "id": "pythonNotebook",
      "name": "Python Notebook",
      "folder": "python-notebook",
      "version": "1.0.0",
      "description": "Mini-Jupyter intégré — exécution Python cellule par cellule avec CodeMirror",
      "icon": "🐍",
      "tools": [],
      "widgets": [],
      "navButtons": []
    }
  };

  // Merge: builtins + user-added from localStorage
  window.EnderTrackPluginRegistry = Object.assign({}, builtins);
  try {
    const saved = JSON.parse(localStorage.getItem('endertrack-plugins-user') || '{}');
    Object.assign(window.EnderTrackPluginRegistry, saved);
  } catch(e) {}

  // Save only user-added plugins (not builtins)
  window.EnderTrackPluginRegistry._builtinIds = Object.keys(builtins);

  window.EnderTrackPluginRegistry._save = function() {
    const data = {};
    for (const [k, v] of Object.entries(window.EnderTrackPluginRegistry)) {
      if (k.startsWith('_') || window.EnderTrackPluginRegistry._builtinIds.includes(k)) continue;
      data[k] = v;
    }
    localStorage.setItem('endertrack-plugins-user', JSON.stringify(data));
  };

  window.EnderTrackPluginRegistry._register = function(manifest) {
    if (!manifest || !manifest.id) return false;
    window.EnderTrackPluginRegistry[manifest.id] = manifest;
    window.EnderTrackPluginRegistry._save();
    return true;
  };

  window.EnderTrackPluginRegistry._unregister = function(pluginId) {
    if (window.EnderTrackPluginRegistry._builtinIds.includes(pluginId)) return;
    delete window.EnderTrackPluginRegistry[pluginId];
    window.EnderTrackPluginRegistry._save();
  };
})();

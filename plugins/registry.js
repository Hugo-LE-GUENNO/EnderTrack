// plugins/registry.js — Plugin registry
(function() {
  const builtins = {
    'externalController': {
      "id": "externalController",
      "name": "Contrôleur Externe",
      "folder": "external-controller",
      "version": "1.0.0",
      "description": "Mapping personnalisable clavier + gamepad",
      "icon": "🎮",
      "tools": [], "widgets": [], "navButtons": []
    },
    'extruder': {
      "id": "extruder",
      "name": "Extruder",
      "folder": "extruder",
      "version": "1.0.0",
      "description": "Contrôle moteur extrudeur — avance/recul avec vitesse réglable",
      "icon": "🔩",
      "tools": [], "widgets": [], "navButtons": []
    },
    'tempoBed': {
      "id": "tempoBed",
      "name": "TempoBed",
      "folder": "tempo-bed",
      "version": "1.0.0",
      "description": "Contrôle température plateau chauffant — on/off, consigne, monitoring",
      "icon": "🌡️",
      "tools": [], "widgets": [], "navButtons": []
    }
  };

  window.EnderTrackPluginRegistry = Object.assign({}, builtins);
  try {
    const saved = JSON.parse(localStorage.getItem('endertrack-plugins-user') || '{}');
    Object.assign(window.EnderTrackPluginRegistry, saved);
  } catch(e) {}

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

// plugins/registry.js — Dynamic plugin registry
// No built-in plugins in minimal version
// Users can add plugins via the Extensions tab

(function() {
  const builtins = {};

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

// plugins/lists-plus/ui.js
class ListsPlusPluginUI {
  constructor(manifest, bridge) {
    this.manifest = manifest;
    this.bridge = bridge;
    this._coreListManager = null;
  }

  init() {
    // Save reference to core ListManager before it gets overwritten
    this._coreListManager = window.EnderTrack?.Lists;
    this.bridge.activate();
  }

  destroy() {
    this.bridge.deactivate();

    // Restore core ListManager
    if (this._coreListManager) {
      window.EnderTrack.Lists = this._coreListManager;
      // Reload data from localStorage (bridge already converted back to core format)
      this._coreListManager.groups = [];
      this._coreListManager.load();
      if (this._coreListManager.groups.length === 0) this._coreListManager.addGroup('Liste 1');
    }

    // Re-render if lists tab is active
    const container = document.getElementById('listsTabContent');
    if (container) {
      container.innerHTML = '';
      window.EnderTrack?.Lists?.renderUI?.();
    }
  }
}

window.ListsPlusPluginUI = ListsPlusPluginUI;

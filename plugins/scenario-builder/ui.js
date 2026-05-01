// plugins/scenario-builder/ui.js
class ScenarioBuilderPluginUI {
  constructor(manifest, bridge) {
    this.manifest = manifest;
    this.bridge = bridge;
  }

  async init() {
    const result = await this.bridge.activate();
    if (!result.success && result.reason === 'core_executing') {
      console.warn('[ScenarioBuilder] Deferred: core executing');
    }
  }

  destroy() {
    this.bridge.deactivate();
    const container = document.getElementById('acquisitionTabContent');
    if (container) container.innerHTML = '';
    window.EnderTrack?.Scenario?.renderUI?.();
  }
}

window.ScenarioBuilderPluginUI = ScenarioBuilderPluginUI;

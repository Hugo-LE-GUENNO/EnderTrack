// plugins/scenario-builder/bridge.js
class ScenarioBuilderBridge {
  constructor() {
    this._loaded = false;
    this._coreRef = null;
    this._scripts = [
      // Utils first
      'plugins/scenario-builder/src/utils/tree-utils.js',
      'plugins/scenario-builder/src/utils/condition-evaluator.js',
      // Nodes (registries)
      'plugins/scenario-builder/src/nodes/loop-types.js',
      'plugins/scenario-builder/src/nodes/action-registry.js',
      'plugins/scenario-builder/src/nodes/condition-types.js',
      // Core
      'plugins/scenario-builder/src/core/macro-registry.js',
      'plugins/scenario-builder/src/core/script-registry.js',
      'plugins/scenario-builder/src/core/scenario-manager.js',
      'plugins/scenario-builder/src/core/scenario-executor.js',
      'plugins/scenario-builder/src/core/scenario-module.js',
      // UI
      'plugins/scenario-builder/src/ui/variable-manager.js',
      'plugins/scenario-builder/src/ui/code-generator.js',
      'plugins/scenario-builder/src/ui/python-generator.js',
      // Builder
      'plugins/scenario-builder/src/builder/scenario-builder.js',
    ];
  }

  async activate() {
    const core = window.EnderTrack?.Scenario;
    if (core?.isExecuting) {
      console.warn('[ScenarioBuilder] Core is executing, deferring');
      return { success: false, reason: 'core_executing' };
    }

    this._coreRef = core;

    this._loadCSS('plugins/scenario-builder/src/scenario-builder.css');

    if (!this._loaded) {
      for (const src of this._scripts) await this._loadScript(src);
      this._loaded = true;
    }

    if (window.EnderTrack?.Scenario?.init) {
      await window.EnderTrack.Scenario.init();
    }

    return { success: true };
  }

  deactivate() {
    window.EnderTrack?.Scenario?.stopExecution?.();
    window.EnderTrack?.Scenario?.deactivate?.();
    if (this._coreRef) {
      window.EnderTrack.Scenario = this._coreRef;
      this._coreRef = null;
    }
  }

  getStatus() { return { connected: this._loaded }; }

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed: ${src}`));
      document.head.appendChild(s);
    });
  }

  _loadCSS(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}

window.ScenarioBuilderBridge = ScenarioBuilderBridge;

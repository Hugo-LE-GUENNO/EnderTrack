// plugins/python-notebook/ui.js

class PythonNotebookPluginUI {
  constructor(manifest, bridge) {
    this.manifest = manifest;
    this.bridge = bridge;
  }

  init() {
    this.bridge.activate();
  }

  destroy() {
    this.bridge.deactivate();
  }
}

window.PythonNotebookPluginUI = PythonNotebookPluginUI;

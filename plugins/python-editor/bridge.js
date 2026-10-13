// plugins/python-editor/bridge.js
window.PythonEditorBridge = class PythonEditorBridge {
  constructor() {
    this._base = (window.ENDERTRACK_SERVER || 'http://localhost:5000') + '/api/plugins/pythonEditor/runner';
  }

  async run(script) {
    const r = await fetch(this._base + '/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script })
    });
    return r.json();
  }

  async context() {
    const r = await fetch(this._base + '/context', { method: 'POST' });
    return r.json();
  }

  async reset() {
    await fetch(this._base + '/reset', { method: 'POST' });
  }
};

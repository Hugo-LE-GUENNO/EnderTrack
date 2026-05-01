// plugins/python-notebook/bridge.js
class PythonNotebookBridge {
  constructor() {
    this._loaded = false;
    this._baseUrl = null;
  }

  async activate() {
    this._baseUrl = window.EnderTrack?.Enderscope?.serverUrl || 'http://127.0.0.1:5000';
    this._loadCSS('plugins/python-notebook/notebook.css');
    if (!this._loaded) {
      await this._loadScript('plugins/python-notebook/notebook.js');
      this._loaded = true;
    }
    window.EnderTrack?.PythonNotebook?.init?.(this._baseUrl);
    return { success: true };
  }

  deactivate() {
    window.EnderTrack?.PythonNotebook?.destroy?.();
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

window.PythonNotebookBridge = PythonNotebookBridge;

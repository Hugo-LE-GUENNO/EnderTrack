// plugins/lists-plus/bridge.js
class ListsPlusBridge {
  constructor() {
    this._loaded = false;
    this._coreData = null; // backup of core localStorage data
    this._scripts = [
      'plugins/lists-plus/src/list-manager.js',
      'plugins/lists-plus/src/lists-overlay-manager.js',
      'plugins/lists-plus/src/pattern-generator.js',
      'plugins/lists-plus/src/lists-ui-templates.js',
      'plugins/lists-plus/src/list-io.js',
      'plugins/lists-plus/src/list-executor.js',
      'plugins/lists-plus/src/lists.js',
    ];
  }

  async activate() {
    // Backup core localStorage and convert to advanced format
    const raw = localStorage.getItem('endertrack_lists');
    this._coreData = raw;

    try {
      const parsed = JSON.parse(raw || '{}');
      if (parsed.groups) {
        // Core format → Advanced format: array of [id, listObj] pairs for Map
        const entries = parsed.groups.map(g => [
          String(g.id),
          { id: String(g.id), name: g.name, positions: g.positions || [], color: g.color || '#4a90e2', created: new Date().toISOString(), lockPreview: false }
        ]);
        localStorage.setItem('endertrack_lists', JSON.stringify(entries));
      }
    } catch (e) { /* keep as-is */ }

    if (!this._loaded) {
      this._loadCSS('plugins/lists-plus/src/lists.css');
      for (const src of this._scripts) await this._loadScript(src);
      this._loaded = true;
    }

    // Init advanced module (overwrites EnderTrack.Lists)
    if (window.EnderTrack?.Lists?.init) {
      await window.EnderTrack.Lists.init();
    }

    return { success: true };
  }

  deactivate() {
    // Convert advanced data back to core format
    try {
      const adv = window.EnderTrack?.Lists?.manager;
      if (adv?.getAllLists) {
        const lists = adv.getAllLists();
        const coreData = {
          groups: lists.map((l, i) => ({
            id: i + 1, name: l.name, positions: l.positions || [],
            visible: true, color: l.color || '#4a90e2'
          })),
          activeGroupId: 1,
          _nextGroupId: lists.length + 1
        };
        localStorage.setItem('endertrack_lists', JSON.stringify(coreData));
      }
    } catch (e) {
      // Restore original core data if conversion fails
      if (this._coreData) localStorage.setItem('endertrack_lists', this._coreData);
    }

    window.EnderTrack?.Lists?.deactivate?.();
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

window.ListsPlusBridge = ListsPlusBridge;

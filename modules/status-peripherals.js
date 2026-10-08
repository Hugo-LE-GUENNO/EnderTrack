// modules/status-peripherals.js — Dynamic peripheral status in widget

window.EnderTrack = window.EnderTrack || {};

window.EnderTrack.StatusPeripherals = {
  _devices: new Map(),

  /**
   * Add or update a peripheral in the status widget.
   * @param {string} id - Unique device id
   * @param {object} opts - { name, icon, state: 'connected'|'disconnected'|'warning', detail }
   */
  set(id, opts) {
    this._devices.set(id, { ...opts, id });
    this._render();
  },

  /**
   * Remove a peripheral from the status widget.
   */
  remove(id) {
    this._devices.delete(id);
    this._render();
  },

  _render() {
    const container = document.getElementById('statusPeripherals');
    if (!container) return;

    if (this._devices.size === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = Array.from(this._devices.values()).map(d => {
      const colors = {
        connected: 'var(--success)',
        disconnected: 'var(--danger)',
        warning: 'var(--coordinates-color)'
      };
      const color = colors[d.state] || colors.warning;
      const blink = d.state === 'disconnected' ? 'animation:statusBlink 1s ease-in-out infinite;' : '';
      return `<div style="display:flex; align-items:center; gap:6px;">
        <div style="width:6px; height:6px; border-radius:50%; background:${color}; box-shadow:0 0 4px ${color}; flex-shrink:0; ${blink}"></div>
        <span style="font-size:10px; color:var(--text-general);">${d.icon || ''} ${d.name}${d.detail ? ' — ' + d.detail : ''}</span>
      </div>`;
    }).join('');
  }
};

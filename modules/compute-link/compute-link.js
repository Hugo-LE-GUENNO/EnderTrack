// modules/compute-link/compute-link.js — Remote compute server bridge

class ComputeLink {
  constructor() {
    this.serverUrl = '';
    this.connected = false;
    this.handlers = new Map(); // command handlers registered by other modules
    this._history = [];
  }

  // === CONNECTION ===

  async connect(url) {
    this.serverUrl = url.replace(/\/$/, '');
    try {
      const res = await fetch(`${this.serverUrl}/status`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        this.connected = true;
        this._log('info', `Connected to ${this.serverUrl}`);
        this._updateStatus();
        return true;
      }
    } catch (e) {
      this._log('error', `Connection failed: ${e.message}`);
    }
    this.connected = false;
    this._updateStatus();
    return false;
  }

  disconnect() {
    this.connected = false;
    this.serverUrl = '';
    this._log('info', 'Disconnected');
    window.EnderTrack?.StatusPeripherals?.remove('compute');
  }

  // === SEND / RECEIVE ===

  async send(endpoint, payload = {}, timeout = 30000) {
    if (!this.connected) return { success: false, error: 'Not connected' };
    try {
      const res = await fetch(`${this.serverUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeout)
      });
      const data = await res.json();
      this._history.push({ type: 'send', endpoint, payload, response: data, time: Date.now() });
      // Auto-dispatch commands from response
      if (data.commands) await this._dispatch(data.commands);
      return data;
    } catch (e) {
      this._log('error', `Send failed: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  // Send image + metadata to server
  async sendImage(imageBase64, metadata = {}, endpoint = '/process') {
    return await this.send(endpoint, { image: imageBase64, metadata, position: window.EnderTrack?.State?.get?.()?.pos });
  }

  // === COMMAND DISPATCH ===
  // Server responses can contain commands to execute locally

  registerHandler(command, fn) {
    this.handlers.set(command, fn);
  }

  unregisterHandler(command) {
    this.handlers.delete(command);
  }

  async _dispatch(commands) {
    if (!Array.isArray(commands)) commands = [commands];
    for (const cmd of commands) {
      const handler = this.handlers.get(cmd.type || cmd.command);
      if (handler) {
        try {
          await handler(cmd.params || cmd.data || cmd);
        } catch (e) {
          this._log('error', `Handler "${cmd.type}" error: ${e.message}`);
        }
      } else {
        // Built-in commands
        await this._builtinDispatch(cmd);
      }
    }
  }

  async _builtinDispatch(cmd) {
    const type = cmd.type || cmd.command;
    const p = cmd.params || cmd.data || {};
    switch (type) {
      case 'move_absolute':
        await window.EnderTrack?.Movement?.moveAbsolute(p.x, p.y, p.z);
        break;
      case 'move_relative':
        await window.EnderTrack?.Movement?.moveRelative(p.dx || 0, p.dy || 0, p.dz || 0);
        break;
      case 'capture':
        await window.EnderTrack?.Camera?.capture(p);
        break;
      case 'light_on':
        await window.EnderTrack?.Light?.on(p.channel, p.intensity);
        break;
      case 'light_off':
        await window.EnderTrack?.Light?.off(p.channel);
        break;
      case 'log':
        window.EnderTrack?.Scenario?.addLog?.(p.message || String(p), p.level || 'info');
        break;
      case 'alert':
        window.EnderTrack?.UI?.showNotification?.(p.message || String(p), p.level || 'info');
        break;
      default:
        this._log('warning', `Unknown command: ${type}`);
    }
  }

  // === SCENARIO ACTION ===

  _registerScenarioAction() {
    if (!window.EnderTrack?.ActionRegistry) return;
    window.EnderTrack.ActionRegistry.register({
      id: 'compute_send',
      label: '🖥️ Compute',
      icon: '🖥️',
      category: 'compute',
      params: [
        { id: 'label', label: 'Label', type: 'text', default: 'Send to server' },
        { id: 'endpoint', label: 'Endpoint', type: 'text', default: '/process' },
        { id: 'sendImage', label: 'Envoyer image', type: 'checkbox', default: true },
        { id: 'timeout', label: 'Timeout (s)', type: 'number', default: 30, min: 1 },
        { id: 'showInLog', label: 'Log', type: 'checkbox', default: true }
      ],
      execute: async (params, context) => {
        const link = window.EnderTrack.ComputeLink;
        if (!link.connected) {
          if (params.showInLog) window.EnderTrack?.Scenario?.addLog?.('🖥️ ❌ Not connected', 'error');
          return { success: false, error: 'Not connected' };
        }
        let payload = { variables: context?.variables || {} };
        if (params.sendImage) {
          const frame = await window.EnderTrack?.Camera?.getFrame();
          if (frame?.frame) payload.image = frame.frame;
        }
        const result = await link.send(params.endpoint, payload, (params.timeout || 30) * 1000);
        if (params.showInLog && window.EnderTrack?.Scenario?.addLog) {
          const msg = result.success !== false ? `🖥️ ${result.message || 'OK'}` : `🖥️ ❌ ${result.error}`;
          window.EnderTrack.Scenario.addLog(msg, result.success !== false ? 'info' : 'error');
        }
        return result;
      }
    });
  }

  _updateStatus() {
    const sp = window.EnderTrack?.StatusPeripherals;
    if (!sp) return;
    if (this.connected) {
      sp.set('compute', { name: 'Compute', icon: '🖥️', state: 'connected', detail: this.serverUrl.replace('http://', '') });
    } else if (this.serverUrl) {
      sp.set('compute', { name: 'Compute', icon: '🖥️', state: 'disconnected', detail: 'offline' });
    } else {
      sp.remove('compute');
    }
  }

  // === UTILS ===

  _log(level, msg) {
    this._history.push({ type: 'log', level, msg, time: Date.now() });
    if (this._history.length > 100) this._history.shift();
  }

  getHistory() { return [...this._history]; }

  getStatus() {
    return { connected: this.connected, serverUrl: this.serverUrl, handlers: Array.from(this.handlers.keys()) };
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ComputeLink = new ComputeLink();

// Register built-in move/capture handlers
window.EnderTrack.ComputeLink.registerHandler('move_absolute', async (p) => {
  await window.EnderTrack?.Movement?.moveAbsolute(p.x, p.y, p.z);
});
window.EnderTrack.ComputeLink.registerHandler('move_relative', async (p) => {
  await window.EnderTrack?.Movement?.moveRelative(p.dx || 0, p.dy || 0, p.dz || 0);
});

// Register scenario action after ActionRegistry is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => EnderTrack.ComputeLink._registerScenarioAction());
} else {
  setTimeout(() => EnderTrack.ComputeLink._registerScenarioAction(), 0);
}

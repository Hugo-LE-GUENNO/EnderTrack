// scenario-executor.js — Run a scenario step by step

class ScenarioExecutor {
  constructor() {
    this.running = false;
    this.paused = false;
    this._aborted = false;
    this._stepIdx = 0;
    this._onLog = null;   // fn(msg, level)
    this._onStep = null;  // fn(idx)
    this._onDone = null;  // fn()
  }

  async run(scenario) {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this._aborted = false;
    this._stepIdx = 0;
    this._log(`▶ Démarrage : ${scenario.name}`, 'info');

    for (let i = 0; i < scenario.steps.length; i++) {
      if (this._aborted) break;
      while (this.paused && !this._aborted) await this._sleep(200);
      if (this._aborted) break;

      this._stepIdx = i;
      this._onStep?.(i);
      const step = scenario.steps[i];
      try {
        await this._runStep(step);
      } catch (e) {
        this._log(`❌ Erreur étape ${i}: ${e.message}`, 'error');
        break;
      }
    }

    this.running = false;
    this._onStep?.(-1);
    if (!this._aborted) this._log('✅ Terminé', 'info');
    this._onDone?.();
  }

  pause()  { this.paused = true;  this._log('⏸ Pause', 'info'); }
  resume() { this.paused = false; this._log('▶ Reprise', 'info'); }
  abort()  { this._aborted = true; this.paused = false; this.running = false; this._log('⏹ Arrêté', 'warn'); }

  async _runStep(step) {
    // Built-in actions
    if (step.type === 'move') {
      this._log(`→ Move (${step.x ?? 0}, ${step.y ?? 0}, ${step.z ?? 0})`, 'info');
      await this._apiPost('/api/move', { x: step.x ?? 0, y: step.y ?? 0, z: step.z ?? 0, relative: !!step.relative });
    } else if (step.type === 'capture') {
      this._log('📷 Capture', 'info');
      await this._apiPost('/api/camera/capture', {});
    } else if (step.type === 'wait') {
      this._log(`⏱ Attente ${step.duration}s`, 'info');
      await this._sleep((step.duration || 1) * 1000);
    } else if (step.type === 'log') {
      this._log(step.message || '', 'info');
    } else {
      // Plugin-registered step types
      const handler = window.EnderTrack?.ScenarioStepHandlers?.[step.type];
      if (handler) await handler(step, this);
      else this._log(`⚠ Type inconnu: ${step.type}`, 'warn');
    }
  }

  _log(msg, level = 'info') { this._onLog?.(msg, level); }
  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async _apiPost(path, body) {
    const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
    const res = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }
}

// Plugin step handler registry
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ScenarioStepHandlers = window.EnderTrack.ScenarioStepHandlers || {};
window.EnderTrack.ScenarioExecutor = new ScenarioExecutor();

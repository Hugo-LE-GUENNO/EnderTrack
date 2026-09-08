// plugins/automate-microscopie/index.js
// Ajoute un onglet "Microscopie" dans le ScenarioBuilder
// avec des blocs : scan XY, Z-stack, timelapse

(function () {

  // Step types contributed by this plugin
  const stepDefs = [
    {
      type: 'xy_scan',
      icon: '🗺️',
      label: 'Scan XY',
      defaults: () => ({ type: 'xy_scan', listId: null, captureAtEach: true }),
      summary: (s) => `Scan XY — liste: ${s.listId || '?'}`,
      fields: (s) => {
        const lists = window.EnderTrack?.Lists?.manager?.getAllLists?.() || [];
        const opts = lists.map(l => `<option value="${l.id}" ${s.listId === l.id ? 'selected' : ''}>${l.name} (${l.positions?.length || 0} pos)</option>`).join('');
        return `
          <label>Liste de positions
            <select name="listId" style="flex:1; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:11px;">
              <option value="">— choisir —</option>${opts}
            </select>
          </label>
          <label><input type="checkbox" name="captureAtEach" ${s.captureAtEach ? 'checked' : ''}> Capturer à chaque position</label>`;
      },
      onSave: (step, editor) => {
        step.listId = editor.querySelector('[name="listId"]')?.value || null;
      }
    },
    {
      type: 'z_stack',
      icon: '📚',
      label: 'Z-Stack',
      defaults: () => ({ type: 'z_stack', zStart: -0.5, zEnd: 0.5, zStep: 0.1 }),
      summary: (s) => `Z-Stack ${s.zStart}→${s.zEnd} / ${s.zStep}mm`,
      fields: (s) => `
        <label>Z début (mm) <input type="number" step="0.01" name="zStart" value="${s.zStart ?? -0.5}"></label>
        <label>Z fin (mm)   <input type="number" step="0.01" name="zEnd"   value="${s.zEnd   ?? 0.5}"></label>
        <label>Pas (mm)     <input type="number" step="0.01" min="0.001" name="zStep" value="${s.zStep ?? 0.1}"></label>`,
    },
    {
      type: 'timelapse',
      icon: '⏰',
      label: 'Timelapse',
      defaults: () => ({ type: 'timelapse', count: 10, interval: 5 }),
      summary: (s) => `${s.count}× toutes les ${s.interval}s`,
      fields: (s) => `
        <label>Nombre d'images <input type="number" min="1" name="count"    value="${s.count    ?? 10}"></label>
        <label>Intervalle (s)  <input type="number" min="0" name="interval" value="${s.interval ?? 5}"></label>`,
    },
  ];

  // Register step handlers (executor)
  const handlers = {
    xy_scan: async (step, exec) => {
      const list = window.EnderTrack?.Lists?.manager?.getList?.(step.listId);
      if (!list?.positions?.length) { exec._log('⚠ Scan XY: liste vide ou introuvable', 'warn'); return; }
      for (const pos of list.positions) {
        if (exec._aborted) break;
        exec._log(`→ XY (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`, 'info');
        await exec._apiPost('/api/move', { x: pos.x, y: pos.y, z: pos.z ?? 0, relative: false });
        if (step.captureAtEach) await exec._apiPost('/api/camera/capture', {});
      }
    },
    z_stack: async (step, exec) => {
      const start = step.zStart ?? -0.5, end = step.zEnd ?? 0.5, stepZ = Math.abs(step.zStep ?? 0.1);
      const n = Math.round(Math.abs(end - start) / stepZ) + 1;
      exec._log(`📚 Z-Stack: ${n} plans`, 'info');
      for (let i = 0; i < n; i++) {
        if (exec._aborted) break;
        const z = start + i * stepZ * Math.sign(end - start);
        await exec._apiPost('/api/move', { x: 0, y: 0, z, relative: false });
        await exec._apiPost('/api/camera/capture', {});
      }
    },
    timelapse: async (step, exec) => {
      const count = step.count ?? 10, interval = (step.interval ?? 5) * 1000;
      exec._log(`⏰ Timelapse: ${count} images`, 'info');
      for (let i = 0; i < count; i++) {
        if (exec._aborted) break;
        await exec._apiPost('/api/camera/capture', {});
        if (i < count - 1) await exec._sleep(interval);
      }
    },
  };

  // Register everything once DOM is ready
  const register = () => {
    window.EnderTrack = window.EnderTrack || {};
    window.EnderTrack.ScenarioStepDefs = window.EnderTrack.ScenarioStepDefs || [];
    window.EnderTrack.ScenarioStepHandlers = window.EnderTrack.ScenarioStepHandlers || {};

    for (const def of stepDefs) {
      if (!window.EnderTrack.ScenarioStepDefs.find(d => d.type === def.type))
        window.EnderTrack.ScenarioStepDefs.push(def);
    }
    Object.assign(window.EnderTrack.ScenarioStepHandlers, handlers);

    // Register tab in builder
    window.EnderTrack.ScenarioBuilder?.registerTab({
      id: 'microscopie',
      label: '🔬 Microscopie',
      render: (scenario) => `
        <div style="padding:4px 0; font-size:11px; color:var(--text-general);">
          <p style="color:#888; margin-bottom:12px;">Blocs disponibles — cliquez pour ajouter à la séquence :</p>
          ${stepDefs.map(d => `
            <div style="display:flex; align-items:center; gap:10px; padding:8px 10px; margin-bottom:4px; background:var(--app-bg); border-radius:5px;">
              <span style="font-size:18px;">${d.icon}</span>
              <div style="flex:1;">
                <div style="font-weight:600; color:var(--text-selected);">${d.label}</div>
                <div style="font-size:10px; color:#666;">${d.summary(d.defaults())}</div>
              </div>
              <button onclick="EnderTrack.ScenarioBuilder._addStep('${d.type}')" class="sb-add-btn">+ Ajouter</button>
            </div>`).join('')}
        </div>`
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', register);
  else setTimeout(register, 0);
})();

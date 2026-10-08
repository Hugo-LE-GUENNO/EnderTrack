// modules/ui/strategic-positions.js - Gestion des positions stratégiques

class StrategicPositions {
  constructor() {
    this.customPositions = [];
    this.limits = {
      xMin: null, xMax: null, xShow: true,
      yMin: null, yMax: null, yShow: true,
      zMin: null, zMax: null, zShow: true
    };
    this.factors = { 
      x: { fine: 1, coarse: 10 }, 
      y: { fine: 1, coarse: 10 }, 
      z: { fine: 1, coarse: 10 } 
    };
    this.nextId = 1;
  }

  init() {
    this.setupEventListeners();
    this.loadSettings();
    
    // Appliquer automatiquement les limites du plateau au démarrage
    setTimeout(() => {
      const state = window.EnderTrack?.State?.get();
      const xLimitMin = document.getElementById('xLimitMin');
      
      if (state?.coordinateBounds && xLimitMin) {
        const bounds = state.coordinateBounds;
        
        // Mettre à jour directement les limites internes
        this.limits.xMin = bounds.x.min;
        this.limits.xMax = bounds.x.max;
        this.limits.yMin = bounds.y.min;
        this.limits.yMax = bounds.y.max;
        this.limits.zMin = bounds.z.min;
        this.limits.zMax = bounds.z.max;
        
        // Mettre à jour les inputs HTML
        document.getElementById('xLimitMin').value = bounds.x.min;
        document.getElementById('xLimitMax').value = bounds.x.max;
        document.getElementById('yLimitMin').value = bounds.y.min;
        document.getElementById('yLimitMax').value = bounds.y.max;
        document.getElementById('zLimitMin').value = bounds.z.min;
        document.getElementById('zLimitMax').value = bounds.z.max;
        
        // Sauvegarder
        this.saveSettings();
        
        // Forcer le rendu
        this.requestCanvasRender();
        if (window.EnderTrack?.ZVisualization?.render) {
          window.EnderTrack.ZVisualization.render();
        }
      }
    }, 500);
    
    this.renderPositionsList();
    return true;
  }

  renderPositionsList() {
    const container = document.getElementById('customPositionsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    this.customPositions.forEach((pos, index) => {
      if (!pos) return;
      
      const item = document.createElement('div');
      item.className = 'custom-position-item';
      const useEmoji = pos.useEmoji !== false;
      const includeZ = pos.includeZ !== false;
      
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <label style="flex: 1;">Label</label>
          <button onclick="deleteCustomPosition(${index})" style="background: none; border: none; color: #ef4444; font-size: 16px; cursor: pointer; padding: 0; line-height: 1;" title="Supprimer">✕</button>
        </div>
        <input type="text" value="${pos.label || ''}" onchange="updateCustomPositionField(${index}, 'label', this.value)" placeholder="Position ${index + 1}" style="width: 100%; margin-bottom: 8px;">
        
        <label style="margin-bottom: 4px; display: block;">${includeZ ? 'X / Y / Z (mm)' : 'X / Y (mm)'}</label>
        <div style="display: grid; grid-template-columns: ${includeZ ? '1fr 1fr 1fr' : '1fr 1fr'} 40px; gap: 4px; margin-bottom: 8px;">
          <input type="number" value="${pos.x || 0}" onchange="updateCustomPositionField(${index}, 'x', this.value)" step="0.1" placeholder="X" style="width: 100%;">
          <input type="number" value="${pos.y || 0}" onchange="updateCustomPositionField(${index}, 'y', this.value)" step="0.1" placeholder="Y" style="width: 100%;">
          ${includeZ ? `<input type="number" value="${pos.z || 0}" onchange="updateCustomPositionField(${index}, 'z', this.value)" step="0.1" placeholder="Z" style="width: 100%;">` : ''}
          <button onclick="setCurrentAsCustomPosition(${index})" class="btn" style="padding: 4px; font-size: 16px;" title="Capturer position actuelle">🚩</button>
        </div>
        
        <label style="margin-bottom: 4px; display: block;">Type de marqueur</label>
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <label style="flex: 1; display: flex; align-items: center; gap: 6px; padding: 8px; background: ${!useEmoji ? 'var(--active-element)' : 'var(--container-bg)'}; border: 1px solid #444; border-radius: 4px; cursor: pointer;">
            <input type="radio" name="markerType${index}" ${!useEmoji ? 'checked' : ''} onchange="updateCustomPositionField(${index}, 'useEmoji', false); EnderTrack.StrategicPositions.renderPositionsList();" style="margin: 0;">
            <button onclick="openColorPicker(${index})" style="background: ${pos.color || '#ff6b6b'}; border: 2px solid #fff; width: 24px; height: 24px; border-radius: 4px; cursor: pointer;" title="Choisir couleur"></button>
            <span style="font-size: 11px; color: var(--text-general);">Drapeau</span>
          </label>
          <label style="flex: 1; display: flex; align-items: center; gap: 6px; padding: 8px; background: ${useEmoji ? 'var(--active-element)' : 'var(--container-bg)'}; border: 1px solid #444; border-radius: 4px; cursor: pointer;">
            <input type="radio" name="markerType${index}" ${useEmoji ? 'checked' : ''} onchange="updateCustomPositionField(${index}, 'useEmoji', true); EnderTrack.StrategicPositions.renderPositionsList();" style="margin: 0;">
            <button onclick="event.preventDefault(); openEmojiPicker(${index});" style="background: none; border: none; padding: 0; font-size: 16px; cursor: pointer;" title="Changer emoji">${pos.emoji || '🏁'}</button>
            <span style="font-size: 11px; color: var(--text-general);">Emoji</span>
          </label>
        </div>
        
        <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-general);">
          <input type="checkbox" ${pos.show !== false ? 'checked' : ''} onchange="updateCustomPositionField(${index}, 'show', this.checked)"> Afficher sur canvas
        </label>
      `;
      container.appendChild(item);
    });
    
    const addBtnContainer = document.createElement('div');
    addBtnContainer.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;';
    
    const addBtnXY = document.createElement('button');
    addBtnXY.onclick = () => this.addCustomPosition(false);
    addBtnXY.className = 'btn';
    addBtnXY.style.cssText = 'padding: 10px; font-size: 13px; background: var(--active-element); color: var(--text-selected);';
    addBtnXY.innerHTML = '➕ Add XY';
    
    const addBtnXYZ = document.createElement('button');
    addBtnXYZ.onclick = () => this.addCustomPosition(true);
    addBtnXYZ.className = 'btn';
    addBtnXYZ.style.cssText = 'padding: 10px; font-size: 13px; background: var(--active-element); color: var(--text-selected);';
    addBtnXYZ.innerHTML = '➕ Add XYZ';
    
    addBtnContainer.appendChild(addBtnXY);
    addBtnContainer.appendChild(addBtnXYZ);
    container.appendChild(addBtnContainer);
  }

  setupEventListeners() {
    // Limites de sécurité Min/Max
    ['x', 'y', 'z'].forEach(axis => {
      const limitMinInput = document.getElementById(`${axis}LimitMin`);
      const limitMaxInput = document.getElementById(`${axis}LimitMax`);
      const showCheck = document.getElementById(`show${axis.toUpperCase()}Limit`);
      
      if (limitMinInput) {
        limitMinInput.addEventListener('input', () => {
          this.limits[axis + 'Min'] = parseFloat(limitMinInput.value);
          this.saveSettings();
          this.requestCanvasRender();
          if (axis === 'z' && window.EnderTrack?.ZVisualization?.render) {
            window.EnderTrack.ZVisualization.render();
          }
        });
      }
      if (limitMaxInput) {
        limitMaxInput.addEventListener('input', () => {
          this.limits[axis + 'Max'] = parseFloat(limitMaxInput.value);
          this.saveSettings();
          this.requestCanvasRender();
          if (axis === 'z' && window.EnderTrack?.ZVisualization?.render) {
            window.EnderTrack.ZVisualization.render();
          }
        });
      }
      if (showCheck) {
        showCheck.addEventListener('change', () => this.toggleLimitDisplay(axis));
      }
    });

    // Facteurs de sensibilité
    ['x', 'y', 'z'].forEach(axis => {
      const fineInput = document.getElementById(`${axis}FineFactor`);
      const coarseInput = document.getElementById(`${axis}CoarseFactor`);
      
      if (fineInput) {
        fineInput.addEventListener('input', () => this.updateFactor(axis, 'fine'));
      }
      if (coarseInput) {
        coarseInput.addEventListener('input', () => this.updateFactor(axis, 'coarse'));
      }
    });

    // Positions HOME
    ['homeXY_X', 'homeXY_Y', 'homeXYZ_X', 'homeXYZ_Y', 'homeXYZ_Z'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', () => this.updateHomePosition());
      }
    });
  }

  updateLimitMinMax(axis) {
    const minInput = document.getElementById(`${axis}LimitMin`);
    const maxInput = document.getElementById(`${axis}LimitMax`);
    if (minInput && maxInput) {
      const minVal = parseFloat(minInput.value);
      const maxVal = parseFloat(maxInput.value);
      
      // Validation: min ne peut pas être supérieur à max ET max ne peut pas être inférieur à min
      if (!isNaN(minVal) && !isNaN(maxVal) && minVal > maxVal) {
        alert(`Erreur: ${axis.toUpperCase()}min (${minVal}) ne peut pas être supérieur à ${axis.toUpperCase()}max (${maxVal})`);
        // Restaurer la valeur précédente ou ajuster
        if (event.target === minInput) {
          minInput.value = maxVal;
        } else {
          maxInput.value = minVal;
        }
        return;
      }
      
      // Permettre 0 comme valeur valide
      this.limits[axis + 'Min'] = isNaN(minVal) ? null : minVal;
      this.limits[axis + 'Max'] = isNaN(maxVal) ? null : maxVal;
      
      this.saveSettings();
      this.requestCanvasRender();
    }
  }

  toggleLimitDisplay(axis) {
    const checkbox = document.getElementById(`show${axis.toUpperCase()}Limit`);
    if (checkbox) {
      this.limits[axis + 'Show'] = checkbox.checked;
      this.saveSettings();
      this.requestCanvasRender();
      if (axis === 'z' && window.EnderTrack?.ZVisualization?.render) {
        window.EnderTrack.ZVisualization.render();
      }
    }
  }

  updateFactor(axis, type) {
    const input = document.getElementById(`${axis}${type.charAt(0).toUpperCase() + type.slice(1)}Factor`);
    if (input) {
      this.factors[axis][type] = parseFloat(input.value) || (type === 'fine' ? 1 : 10);
      this.saveSettings();
    }
  }

  updateHomePosition() {
    const homeXY = {
      x: parseFloat(document.getElementById('homeXY_X')?.value) || 0,
      y: parseFloat(document.getElementById('homeXY_Y')?.value) || 0
    };
    
    const homeXYZ = {
      x: parseFloat(document.getElementById('homeXYZ_X')?.value) || 0,
      y: parseFloat(document.getElementById('homeXYZ_Y')?.value) || 0,
      z: parseFloat(document.getElementById('homeXYZ_Z')?.value) || 0
    };

    EnderTrack.State.update({
      homePositions: { xy: homeXY, xyz: homeXYZ }
    });
    
    this.saveSettings();
  }

  deleteCustomPosition(index) {
    if (!this.customPositions[index]) return;
    this.removeCustomPositionButton(index);
    this.customPositions.splice(index, 1);
    this.renderPositionsList();
    this.saveSettings();
    this.requestCanvasRender();
    EnderTrack.UI?.showSuccess?.('Position supprimée');
  }

  addCustomPosition(includeZ = true) {
    const state = EnderTrack.State.get();
    const pos = state.pos;
    
    const newPosition = {
      id: this.nextId++,
      label: `Position ${this.customPositions.length + 1}`,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      color: '#ff6b6b',
      emoji: '🏁',
      useEmoji: true,
      includeZ: includeZ,
      show: true
    };
    
    this.customPositions.push(newPosition);
    this.renderPositionsList();
    this.addCustomPositionButton(this.customPositions.length - 1, newPosition.label, newPosition.x, newPosition.y, newPosition.z);
    this.saveSettings();
  }

  updateCustomPositionField(index, field, value) {
    if (!this.customPositions[index]) return;
    
    if (field === 'x' || field === 'y' || field === 'z') {
      value = parseFloat(value) || 0;
    }
    
    this.customPositions[index][field] = value;
    
    if (field === 'x' || field === 'y' || field === 'z' || field === 'label' || field === 'emoji' || field === 'color' || field === 'useEmoji') {
      this.addCustomPositionButton(index,
        this.customPositions[index].label,
        this.customPositions[index].x,
        this.customPositions[index].y,
        this.customPositions[index].z
      );
    }
    
    this.saveSettings();
    this.requestCanvasRender();
  }

  setCurrentAsCustomPosition(index) {
    const state = EnderTrack.State.get();
    const pos = state.pos;
    
    if (!this.customPositions[index]) {
      console.warn('Position index not found:', index);
      return;
    }
    
    this.customPositions[index].x = parseFloat(pos.x.toFixed(3));
    this.customPositions[index].y = parseFloat(pos.y.toFixed(3));
    this.customPositions[index].z = parseFloat(pos.z.toFixed(3));
    
    this.renderPositionsList();
    this.addCustomPositionButton(index,
      this.customPositions[index].label,
      this.customPositions[index].x,
      this.customPositions[index].y,
      this.customPositions[index].z
    );
    this.saveSettings();
    this.requestCanvasRender();
    
    EnderTrack.UI?.showSuccess?.(`Position "${this.customPositions[index].label}" définie: X=${pos.x.toFixed(1)}, Y=${pos.y.toFixed(1)}, Z=${pos.z.toFixed(1)}`);
  }

  addCustomPositionButton(index, label, x, y, z) {
    const homeActions = document.querySelector('.home-actions-grid');
    if (!homeActions) return;

    this.removeCustomPositionButton(index);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'home-actions';
    buttonContainer.id = `customPositionContainer${index}`;
    
    const button = document.createElement('button');
    button.className = 'action-btn';
    button.id = `customPositionBtn${index}`;
    
    const pos = this.customPositions[index];
    const useEmoji = pos?.useEmoji !== false;
    const includeZ = pos?.includeZ !== false;
    const icon = useEmoji ? (pos?.emoji || '🏁') : '🚩';
    
    button.innerHTML = `${icon} ${label}`;
    button.title = includeZ ? `Aller à X=${x.toFixed(1)}, Y=${y.toFixed(1)}, Z=${z.toFixed(1)}` : `Aller à X=${x.toFixed(1)}, Y=${y.toFixed(1)}`;
    button.onclick = () => this.goToCustomPosition(x, y, z, includeZ);
    
    if (!useEmoji && pos?.color) {
      button.style.color = pos.color;
    }
    
    const lockBtn = document.createElement('button');
    lockBtn.className = 'lock-btn';
    lockBtn.id = `lockCustom${index}Btn`;
    lockBtn.textContent = '🔓';
    lockBtn.onclick = () => this.toggleCustomLock(index);
    
    buttonContainer.appendChild(button);
    buttonContainer.appendChild(lockBtn);
    homeActions.appendChild(buttonContainer);
  }

  removeCustomPositionButton(index) {
    const container = document.getElementById(`customPositionContainer${index}`);
    if (container) {
      container.remove();
    }
  }

  async goToCustomPosition(x, y, z, includeZ) {
    if (EnderTrack.Movement) {
      if (includeZ) {
        EnderTrack.UI?.showSuccess?.(`Navigation vers X=${x.toFixed(1)}, Y=${y.toFixed(1)}, Z=${z.toFixed(1)}`);
        await EnderTrack.Movement.moveAbsolute(x, y, z);
      } else {
        const currentZ = EnderTrack.State.get().pos.z;
        EnderTrack.UI?.showSuccess?.(`Navigation vers X=${x.toFixed(1)}, Y=${y.toFixed(1)}`);
        await EnderTrack.Movement.moveAbsolute(x, y, currentZ);
      }
    }
  }

  toggleCustomLock(index) {
    // Implémentation du verrouillage des positions personnalisées
    const lockBtn = document.getElementById(`lockCustom${index}Btn`);
    const button = document.getElementById(`customPositionBtn${index}`);
    
    if (lockBtn && button) {
      const isLocked = lockBtn.textContent === '🔒';
      lockBtn.textContent = isLocked ? '🔓' : '🔒';
      button.disabled = !isLocked;
      button.classList.toggle('disabled', !isLocked);
    }
  }

  // Fonctions pour les boutons "position actuelle"
  setCurrentAsHome(type) {
    const state = EnderTrack.State.get();
    const pos = state.pos;
    
    if (type === 'xy') {
      document.getElementById('homeXY_X').value = pos.x.toFixed(2);
      document.getElementById('homeXY_Y').value = pos.y.toFixed(2);
    } else if (type === 'xyz') {
      document.getElementById('homeXYZ_X').value = pos.x.toFixed(2);
      document.getElementById('homeXYZ_Y').value = pos.y.toFixed(2);
      document.getElementById('homeXYZ_Z').value = pos.z.toFixed(2);
    }
    
    this.updateHomePosition();
    EnderTrack.UI?.showNotification?.(`Position HOME ${type.toUpperCase()} définie`, 'success');
  }

  setCurrentAsCustom(index) {
    const state = EnderTrack.State.get();
    const pos = state.pos;
    
    if (!this.customPositions[index - 1]) {
      this.customPositions[index - 1] = { id: this.nextId++, show: true, color: '#ff6b6b', emoji: '🏁' };
    }
    
    this.customPositions[index - 1].x = pos.x;
    this.customPositions[index - 1].y = pos.y;
    this.customPositions[index - 1].z = pos.z;
    
    this.renderPositionsList();
    this.saveSettings();
    this.requestCanvasRender();
    
    EnderTrack.UI?.showNotification?.(`Position personnalisée ${index} définie`, 'success');
  }

  // Rendu sur canvas
  renderOnCanvas(ctx, coords) {
    // Rendu des limites
    this.renderLimits(ctx, coords);
    
    // Rendu des positions personnalisées
    this.renderCustomPositions(ctx, coords);
  }

  renderLimits(ctx, coords) {
    // Rendu des limites X et Y combinées
    if (this.limits.xShow && this.limits.yShow && 
        this.limits.xMin !== null && this.limits.xMax !== null &&
        this.limits.yMin !== null && this.limits.yMax !== null) {
      
      const topLeft = coords.mapToCanvas(this.limits.xMin, this.limits.yMax);
      const bottomRight = coords.mapToCanvas(this.limits.xMax, this.limits.yMin);
      
      // Rectangle de limites XY - discret
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([3, 6]);
      
      ctx.beginPath();
      ctx.rect(topLeft.cx, topLeft.cy, bottomRight.cx - topLeft.cx, bottomRight.cy - topLeft.cy);
      ctx.stroke();
      
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    
    // Rendu des limites individuelles si seulement une est activée
    ['x', 'y'].forEach(axis => {
      if (this.limits[axis + 'Show'] && this.limits[axis + 'Min'] !== null && this.limits[axis + 'Max'] !== null) {
        const min = this.limits[axis + 'Min'];
        const max = this.limits[axis + 'Max'];
        
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.setLineDash([3, 6]);
        
        if (axis === 'x') {
          // Lignes verticales pour limites X
          const minLine = coords.mapToCanvas(min, 0);
          const maxLine = coords.mapToCanvas(max, 0);
          
          ctx.beginPath();
          ctx.moveTo(minLine.cx, 0);
          ctx.lineTo(minLine.cx, ctx.canvas.height);
          ctx.moveTo(maxLine.cx, 0);
          ctx.lineTo(maxLine.cx, ctx.canvas.height);
          ctx.stroke();
        } else {
          // Lignes horizontales pour limites Y
          const minLine = coords.mapToCanvas(0, min);
          const maxLine = coords.mapToCanvas(0, max);
          
          ctx.beginPath();
          ctx.moveTo(0, minLine.cy);
          ctx.lineTo(ctx.canvas.width, minLine.cy);
          ctx.moveTo(0, maxLine.cy);
          ctx.lineTo(ctx.canvas.width, maxLine.cy);
          ctx.stroke();
        }
        
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    });
  }

  renderCustomPositions(ctx, coords) {
    const state = window.EnderTrack?.State?.get();
    const hoveredPos = state?.hoveredPosition;
    
    this.customPositions.forEach(pos => {
      if (pos && pos.show) {
        const canvasPos = coords.mapToCanvas(pos.x, pos.y);
        const useEmoji = pos.useEmoji !== false;
        const isHovered = hoveredPos?.type === 'custom' && hoveredPos?.data === pos;
        const scale = isHovered ? 1.3 : 1;
        
        if (useEmoji && pos.emoji) {
          // Afficher l'emoji
          ctx.font = `${20 * scale}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pos.emoji, canvasPos.cx, canvasPos.cy - 10 * scale);
          
          // Label en dessous
          ctx.fillStyle = '#ffffff';
          ctx.font = `${10 * scale}px Arial`;
          ctx.fillText(pos.label, canvasPos.cx, canvasPos.cy + 12 * scale);
        } else {
          // Afficher le drapeau coloré
          const flagHeight = 20 * scale;
          const flagWidth = 15 * scale;
          
          // Mât du drapeau
          ctx.strokeStyle = '#666666';
          ctx.lineWidth = 2 * scale;
          ctx.beginPath();
          ctx.moveTo(canvasPos.cx, canvasPos.cy);
          ctx.lineTo(canvasPos.cx, canvasPos.cy - flagHeight);
          ctx.stroke();
          
          // Drapeau
          ctx.fillStyle = pos.color || '#ff6b6b';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1 * scale;
          ctx.beginPath();
          ctx.moveTo(canvasPos.cx, canvasPos.cy - flagHeight);
          ctx.lineTo(canvasPos.cx + flagWidth, canvasPos.cy - flagHeight * 0.75);
          ctx.lineTo(canvasPos.cx, canvasPos.cy - flagHeight * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          
          // Label en dessous
          ctx.fillStyle = '#ffffff';
          ctx.font = `${10 * scale}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText(pos.label, canvasPos.cx, canvasPos.cy + 12 * scale);
        }
      }
    });
  }

  // Sauvegarde et chargement
  saveSettings() {
    const settings = {
      limits: this.limits,
      factors: this.factors,
      customPositions: this.customPositions
    };
    
    if (localStorage.getItem('endertrack_strategic_positions_enabled') === 'true') {
      localStorage.setItem('endertrack_strategic_positions', JSON.stringify(settings));
    }
  }

  loadSettings() {
    if (localStorage.getItem('endertrack_strategic_positions_enabled') !== 'true') {
      localStorage.removeItem('endertrack_strategic_positions');
      return;
    }
    
    const saved = localStorage.getItem('endertrack_strategic_positions');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        this.limits = settings.limits || {};
        this.factors = settings.factors || {};
        this.customPositions = settings.customPositions || [];
        
        this.updateUI();
      } catch (e) {
        console.warn('Failed to load strategic positions settings');
      }
    }
  }

  updateUI() {
    Object.keys(this.limits).forEach(key => {
      const input = document.getElementById(key.replace('Enabled', 'Enable').replace('Show', 'Show'));
      if (input && this.limits[key] !== undefined) {
        if (input.type === 'checkbox') {
          input.checked = this.limits[key];
        } else {
          input.value = this.limits[key];
        }
      }
    });
    
    this.renderPositionsList();
    
    this.customPositions.forEach((pos, index) => {
      if (pos) {
        this.addCustomPositionButton(index, pos.label, pos.x, pos.y, pos.z);
      }
    });
  }

  requestCanvasRender() {
    if (window.EnderTrack?.Canvas?.requestRender) {
      window.EnderTrack.Canvas.requestRender();
    }
  }

  // Getters pour les autres modules
  getFactors() {
    return this.factors;
  }

  getLimits() {
    return {
      xMin: this.limits.xMin,
      xMax: this.limits.xMax,
      yMin: this.limits.yMin,
      yMax: this.limits.yMax,
      zMin: this.limits.zMin,
      zMax: this.limits.zMax,
      xShow: this.limits.xShow,
      yShow: this.limits.yShow,
      zShow: this.limits.zShow
    };
  }

  getCustomPositions() {
    return this.customPositions.filter(pos => pos && pos.show);
  }

  // Fonction pour mettre à jour les limites (appelée par le bouton reset)
  updateLimits() {
    // Ne pas recharger les settings car cela écrase les nouvelles valeurs
    // this.loadSettings();
    this.requestCanvasRender();
  }
}

// Instance globale
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.StrategicPositions = new StrategicPositions();

// Fonctions globales pour les boutons
window.setCurrentAsHome = (type) => EnderTrack.StrategicPositions.setCurrentAsHome(type);
window.setCurrentAsCustom = (index) => EnderTrack.StrategicPositions.setCurrentAsCustom(index);
window.addCustomPosition = () => EnderTrack.StrategicPositions.addCustomPosition();
window.updateCustomPositionField = (index, field, value) => EnderTrack.StrategicPositions.updateCustomPositionField(index, field, value);
window.setCurrentAsCustomPosition = (index) => EnderTrack.StrategicPositions.setCurrentAsCustomPosition(index);
window.deleteCustomPosition = (index) => EnderTrack.StrategicPositions.deleteCustomPosition(index);
window.openEmojiPicker = (index) => {
  if (window.EmojiPicker) {
    window.EmojiPicker.open((emoji) => {
      EnderTrack.StrategicPositions.updateCustomPositionField(index, 'emoji', emoji);
      EnderTrack.StrategicPositions.updateCustomPositionField(index, 'useEmoji', true);
      EnderTrack.StrategicPositions.renderPositionsList();
    });
  }
};

window.openColorPicker = (index) => {
  const input = document.createElement('input');
  input.type = 'color';
  input.value = EnderTrack.StrategicPositions.customPositions[index]?.color || '#ff6b6b';
  input.onchange = () => {
    EnderTrack.StrategicPositions.updateCustomPositionField(index, 'color', input.value);
    EnderTrack.StrategicPositions.updateCustomPositionField(index, 'useEmoji', false);
    EnderTrack.StrategicPositions.renderPositionsList();
  };
  input.click();
};
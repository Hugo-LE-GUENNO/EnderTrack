// modules/navigation/keyboard/keyboard-utils.js - Keyboard utility functions
class KeyboardUtils {
  static initControllerModeSettings() {
    const speedSlider = document.getElementById('speedSlider');
    const speedInput = document.getElementById('speedInput');
    
    if (speedSlider && speedInput) {
      speedSlider.min = 0;
      speedSlider.max = 100;
      speedSlider.value = 50;
      speedInput.min = 0;
      speedInput.max = 100;
      speedInput.value = 50;
      window.continuousSpeedValue = 50;
      
      speedSlider.addEventListener('input', (e) => {
        window.continuousSpeedValue = parseInt(e.target.value);
        speedInput.value = window.continuousSpeedValue;
      });
      
      speedInput.addEventListener('input', (e) => {
        window.continuousSpeedValue = parseInt(e.target.value);
        speedSlider.value = window.continuousSpeedValue;
      });
    }
  }

  static setControllerMode(mode) {
    window.controllerMode = mode;
    
    const stepBtn = document.getElementById('stepModeBtn');
    const continuousBtn = document.getElementById('continuousModeBtn');
    const stepControls = document.getElementById('stepControls');
    const continuousControls = document.getElementById('continuousControls');
    
    if (mode === 'step') {
      stepBtn?.classList.add('active');
      continuousBtn?.classList.remove('active');
      if (stepControls) stepControls.style.display = 'block';
      if (continuousControls) continuousControls.style.display = 'none';
      window.stopContinuousMovement?.();
    } else {
      stepBtn?.classList.remove('active');
      continuousBtn?.classList.add('active');
      if (stepControls) stepControls.style.display = 'none';
      if (continuousControls) continuousControls.style.display = 'block';
    }
    
    window.EnderTrack?.Canvas?.requestRender?.();
    window.EnderTrack?.ZVisualization?.render?.();
  }

  static setSpeedPreset(preset) {
    const speedSlider = document.getElementById('speedSlider');
    const speedInput = document.getElementById('speedInput');
    
    let value;
    if (preset === 'slow') value = 20;
    else if (preset === 'fast') value = 70;
    
    if (speedSlider && speedInput) {
      speedSlider.value = value;
      speedInput.value = value;
      window.continuousSpeedValue = value;
    }
  }

  static getCurrentAxis(axis) {
    const state = window.EnderTrack.State.get();
    const currentPos = state.pos;
    
    const isCoupled = state.lockXY;
    const inputX = document.getElementById('inputX');
    const inputY = document.getElementById('inputY');
    const inputZ = document.getElementById('inputZ');
    
    let updated = [];
    
    switch(axis) {
      case 'x':
        if (inputX && !state.lockX) {
          inputX.value = currentPos.x.toFixed(2);
          inputX.dispatchEvent(new Event('input', { bubbles: true }));
          updated.push('X');
        }
        break;
      case 'y':
        if (inputY && !state.lockY) {
          inputY.value = currentPos.y.toFixed(2);
          inputY.dispatchEvent(new Event('input', { bubbles: true }));
          updated.push('Y');
        }
        break;
      case 'z':
        if (inputZ && !state.lockZ) {
          inputZ.value = currentPos.z.toFixed(2);
          inputZ.dispatchEvent(new Event('input', { bubbles: true }));
          updated.push('Z');
        }
        break;
      case 'all':
        if (inputX && !state.lockX) {
          inputX.value = currentPos.x.toFixed(2);
          inputX.dispatchEvent(new Event('input', { bubbles: true }));
          updated.push('X');
        }
        if (inputY && !state.lockY) {
          inputY.value = currentPos.y.toFixed(2);
          inputY.dispatchEvent(new Event('input', { bubbles: true }));
          updated.push('Y');
        }
        if (inputZ && !state.lockZ) {
          inputZ.value = currentPos.z.toFixed(2);
          inputZ.dispatchEvent(new Event('input', { bubbles: true }));
          updated.push('Z');
        }
        break;
    }
    
    if (window.EnderTrack.Canvas) {
      window.EnderTrack.Canvas.requestRender();
    }
    
    if (updated.length > 0) {
      this.updateLastCommand(`📍 Position ${updated.join('+')} récupérée`);
    }
    
    this.updateGetButtonStates();
  }

  static updateGetButtonStates() {
    const state = window.EnderTrack.State.get();
    const currentPos = state.pos;
    
    const isCoupled = state.lockXY;
    const inputX = document.getElementById('inputX');
    const inputY = document.getElementById('inputY');
    const inputZ = document.getElementById('inputZ');
    
    const getButtons = document.querySelectorAll('.get-btn, .get-all-btn');
    
    const tolerance = 0.01;
    const xMatches = inputX ? Math.abs(parseFloat(inputX.value) - currentPos.x) < tolerance : false;
    const yMatches = inputY ? Math.abs(parseFloat(inputY.value) - currentPos.y) < tolerance : false;
    const zMatches = inputZ ? Math.abs(parseFloat(inputZ.value) - currentPos.z) < tolerance : false;
    
    getButtons.forEach(button => {
      const onclick = button.getAttribute('onclick');
      if (!onclick) return;
      
      let isAtCurrentPos = false;
      
      if (onclick.includes("'x'")) {
        isAtCurrentPos = xMatches;
      } else if (onclick.includes("'y'")) {
        isAtCurrentPos = yMatches;
      } else if (onclick.includes("'z'")) {
        isAtCurrentPos = zMatches;
      } else if (onclick.includes("'all'")) {
        isAtCurrentPos = xMatches && yMatches && zMatches;
      }
      
      if (isAtCurrentPos) {
        button.style.background = 'rgba(34, 197, 94, 0.4)';
        button.style.opacity = '0.7';
        button.style.cursor = 'not-allowed';
        button.disabled = true;
        button.title = 'Déjà à la position actuelle';
      } else {
        button.style.background = 'var(--button-bg)';
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        button.disabled = false;
        
        if (onclick.includes("'x'")) {
          button.title = 'Récupérer position X';
        } else if (onclick.includes("'y'")) {
          button.title = 'Récupérer position Y';
        } else if (onclick.includes("'z'")) {
          button.title = 'Récupérer position Z';
        } else if (onclick.includes("'all'")) {
          button.title = 'Récupérer toutes les positions';
        }
      }
    });
  }

  static updateLastCommand(action) {
    const timestamp = new Date().toLocaleTimeString('fr-FR', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    const container = document.getElementById('lastCommand');
    if (container) {
      container.textContent = `${timestamp} - ${action}`;
    }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.KeyboardUtils = KeyboardUtils;
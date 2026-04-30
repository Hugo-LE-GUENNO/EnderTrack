// modules/navigation/keyboard/continuous-movement.js - Continuous movement system
class ContinuousMovement {
  static handleWheelMovement(delta) {
    const direction = delta > 0 ? 'zUp' : 'zDown';
    const action = delta > 0 ? '▲ Contrôle Z Haut' : '▼ Contrôle Z Bas';
    
    if (window.controllerMode === 'continuous') {
      window.startContinuousMovement(direction);
      window.EnderTrack.KeyboardLogger.addLogEntry(action + ' (Continu)');
      window.EnderTrack.KeyboardUI.animateWheel(direction);
      
      setTimeout(() => {
        window.stopContinuousMovement();
      }, 200);
    } else {
      window.EnderTrack.KeyboardLogger.addLogEntry(action);
      window.EnderTrack.KeyboardUI.animateWheel(direction);
      
      if (window.moveDirection) {
        window.moveDirection(direction);
      }
    }
  }

  static calculateActualSpeed(sliderValue) {
    if (sliderValue === 0) return 0.1;
    return Math.pow(10, (sliderValue / 100) * Math.log10(1000)) / 10;
  }

  static getAdaptiveStep(speed) {
    if (speed < 1) return 0.05;
    else if (speed < 5) return 0.1;
    else if (speed < 20) return 0.5;
    else if (speed < 50) return 1.0;
    else return 2.0;
  }

  static getAdaptiveInterval(speed) {
    if (speed < 1) return 100;
    else if (speed < 5) return 50;
    else if (speed < 20) return 30;
    else if (speed < 50) return 20;
    else return 15;
  }

  static drawCanvasVector(canvasType, dx, dy, speed) {
    if (!window.continuousVector) window.continuousVector = {};
    
    if (canvasType === 'xy') {
      window.continuousVector.xy = { dx, dy, speed };
    } else if (canvasType === 'z') {
      window.continuousVector.z = { dz: dy, speed };
    }
    
    if (window.EnderTrack?.Canvas) {
      window.EnderTrack.Canvas.requestRender();
    }
  }

  static clearCanvasVectors() {
    window.continuousVector = null;
    
    if (window.EnderTrack?.Canvas) {
      window.EnderTrack.Canvas.requestRender();
    }
  }
}

// Global functions for continuous movement
function startContinuousMovement(direction) {
  if (window.controllerMode !== 'continuous') return;
  
  window.stopContinuousMovement();
  
  const actualSpeed = window.EnderTrack.ContinuousMovement.calculateActualSpeed(window.continuousSpeedValue || 50);
  const adaptiveStep = window.EnderTrack.ContinuousMovement.getAdaptiveStep(actualSpeed);
  const moveInterval = window.EnderTrack.ContinuousMovement.getAdaptiveInterval(actualSpeed);
  
  // Get axis orientation for proper direction mapping
  const state = window.EnderTrack.State.get();
  const axisOrientation = state.axisOrientation || { x: 'right', y: 'up' };
  
  // Calculate direction vectors with axis orientation
  let dx = 0, dy = 0, dz = 0;
  switch(direction) {
    case 'up': dy = axisOrientation.y === 'up' ? -1 : 1; break;
    case 'down': dy = axisOrientation.y === 'up' ? 1 : -1; break;
    case 'left': dx = axisOrientation.x === 'right' ? -1 : 1; break;
    case 'right': dx = axisOrientation.x === 'right' ? 1 : -1; break;
    case 'upLeft': 
      dx = axisOrientation.x === 'right' ? -0.707 : 0.707;
      dy = axisOrientation.y === 'up' ? -0.707 : 0.707;
      break;
    case 'upRight': 
      dx = axisOrientation.x === 'right' ? 0.707 : -0.707;
      dy = axisOrientation.y === 'up' ? -0.707 : 0.707;
      break;
    case 'downLeft': 
      dx = axisOrientation.x === 'right' ? -0.707 : 0.707;
      dy = axisOrientation.y === 'up' ? 0.707 : -0.707;
      break;
    case 'downRight': 
      dx = axisOrientation.x === 'right' ? 0.707 : -0.707;
      dy = axisOrientation.y === 'up' ? 0.707 : -0.707;
      break;
    case 'zUp': dz = 1; break;
    case 'zDown': dz = -1; break;
  }
  
  // Draw vectors on canvas
  if (dx !== 0 || dy !== 0) {
    window.EnderTrack.ContinuousMovement.drawCanvasVector('xy', dx, dy, actualSpeed);
  }
  if (dz !== 0) {
    window.EnderTrack.ContinuousMovement.drawCanvasVector('z', 0, dz, actualSpeed);
  }
  
  window.continuousInterval = setInterval(() => {
    if (window.moveDirection) {
      const state = window.EnderTrack.State.get();
      
      let moveX = 0, moveY = 0, moveZ = 0;
      
      // Apply axis orientation to movement
      const axisOrientation = state.axisOrientation || { x: 'right', y: 'up' };
      
      switch(direction) {
        case 'up': moveY = (axisOrientation.y === 'up' ? -1 : 1) * adaptiveStep; break;
        case 'down': moveY = (axisOrientation.y === 'up' ? 1 : -1) * adaptiveStep; break;
        case 'left': moveX = (axisOrientation.x === 'right' ? -1 : 1) * adaptiveStep; break;
        case 'right': moveX = (axisOrientation.x === 'right' ? 1 : -1) * adaptiveStep; break;
        case 'upLeft': 
          moveX = (axisOrientation.x === 'right' ? -1 : 1) * adaptiveStep * 0.707;
          moveY = (axisOrientation.y === 'up' ? -1 : 1) * adaptiveStep * 0.707;
          break;
        case 'upRight': 
          moveX = (axisOrientation.x === 'right' ? 1 : -1) * adaptiveStep * 0.707;
          moveY = (axisOrientation.y === 'up' ? -1 : 1) * adaptiveStep * 0.707;
          break;
        case 'downLeft': 
          moveX = (axisOrientation.x === 'right' ? -1 : 1) * adaptiveStep * 0.707;
          moveY = (axisOrientation.y === 'up' ? 1 : -1) * adaptiveStep * 0.707;
          break;
        case 'downRight': 
          moveX = (axisOrientation.x === 'right' ? 1 : -1) * adaptiveStep * 0.707;
          moveY = (axisOrientation.y === 'up' ? 1 : -1) * adaptiveStep * 0.707;
          break;
        case 'zUp': moveZ = adaptiveStep; break;
        case 'zDown': moveZ = -adaptiveStep; break;
      }
      
      if (moveX !== 0 || moveY !== 0 || moveZ !== 0) {
        const newPos = {
          x: state.pos.x + moveX,
          y: state.pos.y + moveY,
          z: state.pos.z + moveZ
        };
        
        // Clamp to platform limits
        const dimensions = state.plateauDimensions || { x: 200, y: 200, z: 100 };
        const halfX = dimensions.x / 2;
        const halfY = dimensions.y / 2;
        const halfZ = dimensions.z / 2;
        
        newPos.x = Math.max(-halfX, Math.min(halfX, newPos.x));
        newPos.y = Math.max(-halfY, Math.min(halfY, newPos.y));
        newPos.z = Math.max(-halfZ, Math.min(halfZ, newPos.z));
        
        // Add to continuous track
        if (window.EnderTrack.State && window.EnderTrack.State.addContinuousTrackPoint) {
          window.EnderTrack.State.addContinuousTrackPoint(newPos.x, newPos.y, newPos.z);
        }
        
        window.EnderTrack.State.update({ pos: newPos });
        
        if (window.EnderTrack.Canvas) {
          window.EnderTrack.Canvas.requestRender();
        }
      }
    }
  }, moveInterval);
}

function stopContinuousMovement() {
  if (window.continuousInterval) {
    clearInterval(window.continuousInterval);
    window.continuousInterval = null;
  }
  
  window.EnderTrack.ContinuousMovement.clearCanvasVectors();
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ContinuousMovement = ContinuousMovement;
window.startContinuousMovement = startContinuousMovement;
window.stopContinuousMovement = stopContinuousMovement;
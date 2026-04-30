// modules/navigation/keyboard/keyboard-manager.js - Core keyboard mode management
class KeyboardManager {
  constructor() {
    this.isActive = false;
    this.pressedKeys = new Set();
    this.keyTimeout = null;
  }

  init() {
    this.setupEventListeners();
    return true;
  }

  setupEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (this.isActive) {
        this.handleKeyboardInput(e);
      }
    });
    
    document.addEventListener('keyup', (e) => {
      if (this.isActive) {
        this.handleKeyboardRelease(e);
      }
    });
  }

  toggle() {
    this.isActive = !this.isActive;
    
    if (this.isActive) {
      this.activateMode();
    } else {
      this.deactivateMode();
    }

    return this.isActive;
  }

  activateMode() {
    document.getElementById('keyboardMode')?.classList.add('active');
    document.getElementById('relativeControls')?.classList.add('keyboard-mode');
    document.getElementById('navigationLog')?.style.setProperty('display', 'block');
    document.getElementById('normalMode')?.style.setProperty('display', 'none');
    document.getElementById('controllerMode')?.classList.add('active');
    document.getElementById('controllerModeToggle')?.style.setProperty('display', 'flex');
    
    window.EnderTrack.KeyboardLogger?.addLogEntry('🕹️ Contrôleur activé');
    window.initControllerModeSettings?.();
    this.setupWheelHandler();
  }

  deactivateMode() {
    document.getElementById('keyboardMode')?.classList.remove('active');
    document.getElementById('relativeControls')?.classList.remove('keyboard-mode');
    document.getElementById('navigationLog')?.style.setProperty('display', 'none');
    document.getElementById('normalMode')?.style.setProperty('display', '');
    document.getElementById('controllerMode')?.classList.remove('active');
    document.getElementById('controllerModeToggle')?.style.setProperty('display', 'none');
    
    const stepControls = document.getElementById('stepControls');
    const continuousControls = document.getElementById('continuousControls');
    if (stepControls) stepControls.style.display = 'block';
    if (continuousControls) continuousControls.style.display = 'none';
    window.controllerMode = 'step';
    
    window.EnderTrack.KeyboardLogger?.addLogEntry('🕹️ Contrôleur désactivé');
    window.stopContinuousMovement?.();
    this.removeWheelHandler();
    window.EnderTrack.KeyboardUI?.resetJoystick();
  }

  setupWheelHandler() {
    this.wheelHandler = (e) => {
      if (this.isActive) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        window.EnderTrack.ContinuousMovement.handleWheelMovement(delta);
      }
    };

    const controllerRight = document.getElementById('controllerRight');
    if (controllerRight) {
      controllerRight.addEventListener('wheel', this.wheelHandler);
    }
  }

  removeWheelHandler() {
    const controllerRight = document.getElementById('controllerRight');
    if (controllerRight && this.wheelHandler) {
      controllerRight.removeEventListener('wheel', this.wheelHandler);
    }
  }

  handleKeyboardInput(e) {
    const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
    if (navKeys.includes(e.code)) {
      e.preventDefault();
    }

    this.pressedKeys.add(e.code);
    
    if (this.keyTimeout) {
      clearTimeout(this.keyTimeout);
    }
    
    // Z movements
    if (e.code === 'PageUp' || e.code === 'KeyQ') {
      window.EnderTrack.KeyboardInput.handleZMovement('zUp');
      return;
    } else if (e.code === 'PageDown' || e.code === 'KeyE') {
      window.EnderTrack.KeyboardInput.handleZMovement('zDown');
      return;
    }
    
    // XY movements with diagonal detection
    this.keyTimeout = setTimeout(() => {
      window.EnderTrack.KeyboardInput.processXYMovement(this.pressedKeys);
    }, 50);
  }

  handleKeyboardRelease(e) {
    this.pressedKeys.delete(e.code);
    
    let buttonId = null;
    
    if (e.code === 'ArrowUp' || e.code === 'KeyW') buttonId = 'up';
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') buttonId = 'down';
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') buttonId = 'left';
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') buttonId = 'right';
    else if (e.code === 'PageUp' || e.code === 'KeyQ') buttonId = 'zUp';
    else if (e.code === 'PageDown' || e.code === 'KeyE') buttonId = 'zDown';
    
    if (buttonId) {
      window.EnderTrack.KeyboardUI.animateButton(buttonId, false);
    }
    
    // Stop continuous movement
    if (window.controllerMode === 'continuous') {
      const isMovementKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
                            'KeyW', 'KeyA', 'KeyS', 'KeyD', 
                            'PageUp', 'PageDown', 'KeyQ', 'KeyE'].includes(e.code);
      if (isMovementKey) {
        window.stopContinuousMovement();
        window.EnderTrack.KeyboardLogger.addLogEntry('⏹️ Arrêt continu');
        
        const allButtons = ['up', 'down', 'left', 'right', 'zUp', 'zDown'];
        allButtons.forEach(btnId => window.EnderTrack.KeyboardUI.animateButton(btnId, false));
        window.EnderTrack.KeyboardUI.resetJoystick();
      }
    }
    
    // Reset joystick if no XY keys pressed
    const hasXYKeys = this.pressedKeys.has('ArrowUp') || this.pressedKeys.has('KeyW') ||
                      this.pressedKeys.has('ArrowDown') || this.pressedKeys.has('KeyS') ||
                      this.pressedKeys.has('ArrowLeft') || this.pressedKeys.has('KeyA') ||
                      this.pressedKeys.has('ArrowRight') || this.pressedKeys.has('KeyD');
    
    if (!hasXYKeys) {
      window.EnderTrack.KeyboardUI.resetJoystick();
    }
  }

  getStatus() {
    return {
      active: this.isActive,
      pressedKeys: Array.from(this.pressedKeys)
    };
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.KeyboardManager = KeyboardManager;
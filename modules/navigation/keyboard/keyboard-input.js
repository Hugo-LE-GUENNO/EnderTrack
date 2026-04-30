// modules/navigation/keyboard/keyboard-input.js - Keyboard input processing
class KeyboardInput {
  static handleZMovement(direction) {
    if (window.controllerMode === 'continuous') {
      window.startContinuousMovement(direction);
      const action = direction === 'zUp' ? '▲ Z Haut (Continu)' : '▼ Z Bas (Continu)';
      window.EnderTrack.KeyboardLogger.addLogEntry(action);
      window.EnderTrack.KeyboardUI.animateButton(direction, true);
    } else {
      const action = direction === 'zUp' ? '▲ Z Haut' : '▼ Z Bas';
      this.executeMovement(direction, action, direction);
    }
  }

  static processXYMovement(pressedKeys) {
    const keys = {
      up: pressedKeys.has('ArrowUp') || pressedKeys.has('KeyW'),
      down: pressedKeys.has('ArrowDown') || pressedKeys.has('KeyS'),
      left: pressedKeys.has('ArrowLeft') || pressedKeys.has('KeyA'),
      right: pressedKeys.has('ArrowRight') || pressedKeys.has('KeyD')
    };
    
    let direction = null;
    let action = null;
    let buttonId = null;
    
    // Diagonal combinations first
    if (keys.up && keys.left) {
      direction = 'upLeft';
      action = '↖ Haut-Gauche';
    } else if (keys.up && keys.right) {
      direction = 'upRight';
      action = '↗ Haut-Droite';
    } else if (keys.down && keys.left) {
      direction = 'downLeft';
      action = '↙ Bas-Gauche';
    } else if (keys.down && keys.right) {
      direction = 'downRight';
      action = '↘ Bas-Droite';
    }
    // Single movements
    else if (keys.up) {
      direction = 'up';
      action = '▲ Haut';
      buttonId = 'up';
    } else if (keys.down) {
      direction = 'down';
      action = '▼ Bas';
      buttonId = 'down';
    } else if (keys.left) {
      direction = 'left';
      action = '◄ Gauche';
      buttonId = 'left';
    } else if (keys.right) {
      direction = 'right';
      action = '► Droite';
      buttonId = 'right';
    }
    
    if (direction) {
      if (window.controllerMode === 'continuous') {
        window.startContinuousMovement(direction);
        window.EnderTrack.KeyboardLogger.addLogEntry(action + ' (Continu)');
        window.EnderTrack.KeyboardUI.animateJoystick(direction);
        if (buttonId) window.EnderTrack.KeyboardUI.animateButton(buttonId, true);
      } else {
        this.executeMovement(direction, action, buttonId);
      }
    }
  }

  static executeMovement(direction, action, buttonId = null) {
    window.EnderTrack.KeyboardLogger.addLogEntry(action);
    if (buttonId) window.EnderTrack.KeyboardUI.animateButton(buttonId, true);
    window.EnderTrack.KeyboardUI.animateJoystick(direction);
    
    if (window.moveDirection) {
      window.moveDirection(direction);
    }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.KeyboardInput = KeyboardInput;
// modules/navigation/keyboard/keyboard-ui.js - Keyboard UI animations and controls
class KeyboardUI {
  static animateButton(buttonId, pressed) {
    const button = document.getElementById(buttonId);
    if (button) {
      if (pressed) {
        button.classList.add('pressed');
      } else {
        button.classList.remove('pressed');
      }
    }
  }

  static animateJoystick(direction) {
    const stick = document.getElementById('joystickStick');
    if (!stick) return;
    
    // Keep joystick visually intuitive - up is always up, left is always left
    const positions = {
      up: 'translate(0, -25px)',
      upRight: 'translate(18px, -18px)',
      right: 'translate(25px, 0)',
      downRight: 'translate(18px, 18px)',
      down: 'translate(0, 25px)',
      downLeft: 'translate(-18px, 18px)',
      left: 'translate(-25px, 0)',
      upLeft: 'translate(-18px, -18px)'
    };
    
    const transform = positions[direction] || 'translate(0, 0)';
    stick.style.transform = transform;
    stick.classList.add('active');
  }
  
  static resetJoystick() {
    const stick = document.getElementById('joystickStick');
    if (stick) {
      stick.style.transform = 'translate(0, 0)';
      stick.classList.remove('active');
    }
  }

  static animateWheel(direction) {
    const gearWheel = document.getElementById('gearWheel');
    
    if (!this.currentRotation) this.currentRotation = 0;
    
    if (direction === 'zUp') {
      this.currentRotation -= 15;
      if (gearWheel) {
        gearWheel.style.transform = `rotate(${this.currentRotation}deg)`;
      }
    } else if (direction === 'zDown') {
      this.currentRotation += 15;
      if (gearWheel) {
        gearWheel.style.transform = `rotate(${this.currentRotation}deg)`;
      }
    }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.KeyboardUI = KeyboardUI;
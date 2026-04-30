// modules/navigation/controls-helpers.js - Helper functions for NavigationControls

class ControlsHelpers {
  /**
   * Update lock button appearance
   */
  static updateLockButton(buttonId, isLocked, axisName) {
    const btn = document.getElementById(buttonId);
    if (btn) {
      btn.textContent = isLocked ? '🔒' : '🔓';
      btn.classList.toggle('locked', isLocked);
      btn.title = `${axisName} ${isLocked ? 'locked' : 'unlocked'}`;
    }
  }

  /**
   * Update control disabled state
   */
  static updateControlState(controlId, sliderId, inputId, isLocked) {
    const control = document.getElementById(controlId);
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(inputId);
    
    if (control) control.classList.toggle('locked', isLocked);
    if (slider) slider.disabled = isLocked;
    if (input) input.disabled = isLocked;
  }

  /**
   * Update absolute mode input
   */
  static updateAbsoluteInput(inputId, isLocked) {
    const input = document.getElementById(inputId);
    if (input) {
      const inputGroup = input.parentElement;
      if (inputGroup) {
        inputGroup.classList.toggle('locked', isLocked);
      }
      input.disabled = isLocked;
    }
  }

  /**
   * Update home button state
   */
  static updateHomeButton(homeBtnId, isLocked) {
    const homeBtn = document.getElementById(homeBtnId);
    if (homeBtn) {
      homeBtn.disabled = isLocked;
      homeBtn.classList.toggle('disabled', isLocked);
    }
  }
}

// Register globally
window.ControlsHelpers = ControlsHelpers;

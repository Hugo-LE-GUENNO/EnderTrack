// modules/navigation/keyboard-wrapper.js - Compatibility wrapper
// Provides global functions for HTML compatibility

// Global functions for HTML onclick handlers
function toggleKeyboardMode() {
  if (window.EnderTrack?.KeyboardMode) {
    window.EnderTrack.KeyboardMode.toggle();
  }
}

function deactivateControllerMode() {
  if (window.EnderTrack?.KeyboardMode?.isActive) {
    window.EnderTrack.KeyboardMode.toggle();
  }
}

function updateLastCommand(action) {
  window.EnderTrack.KeyboardUtils?.updateLastCommand?.(action);
}

function getCurrentAxis(axis) {
  window.EnderTrack.KeyboardUtils?.getCurrentAxis?.(axis);
}

function initControllerModeSettings() {
  window.EnderTrack.KeyboardUtils?.initControllerModeSettings?.();
}

function setControllerMode(mode) {
  window.EnderTrack.KeyboardUtils?.setControllerMode?.(mode);
}

function setSpeedPreset(preset) {
  window.EnderTrack.KeyboardUtils?.setSpeedPreset?.(preset);
}

// Global variables for compatibility
window.controllerMode = 'step';
window.continuousSpeedValue = 50;
window.continuousInterval = null;
window.continuousVector = null;

// Export functions globally
window.toggleKeyboardMode = toggleKeyboardMode;
window.deactivateControllerMode = deactivateControllerMode;
window.updateLastCommand = updateLastCommand;
window.getCurrentAxis = getCurrentAxis;
window.initControllerModeSettings = initControllerModeSettings;
window.setControllerMode = setControllerMode;
window.setSpeedPreset = setSpeedPreset;
// modules/utils/events.js - Event handling utilities
// Pure event system with no dependencies

class EventEmitter {
  constructor() {
    this.listeners = new Map();
    this.maxListeners = 100;
  }

  // Add event listener
  on(event, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const callbacks = this.listeners.get(event);
    
    // Check max listeners
    if (callbacks.length >= this.maxListeners) {
      console.warn(`Max listeners (${this.maxListeners}) exceeded for event: ${event}`);
    }

    callbacks.push(callback);
    return this;
  }

  // Add one-time event listener
  once(event, callback) {
    const onceWrapper = (...args) => {
      this.off(event, onceWrapper);
      callback.apply(this, args);
    };

    return this.on(event, onceWrapper);
  }

  // Remove event listener
  off(event, callback) {
    if (!this.listeners.has(event)) {
      return this;
    }

    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);

    if (index > -1) {
      callbacks.splice(index, 1);
    }

    // Clean up empty arrays
    if (callbacks.length === 0) {
      this.listeners.delete(event);
    }

    return this;
  }

  // Remove all listeners for an event
  removeAllListeners(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  // Emit event
  emit(event, ...args) {
    if (!this.listeners.has(event)) {
      return false;
    }

    const callbacks = this.listeners.get(event).slice(); // Copy to avoid issues with modifications during emit

    callbacks.forEach(callback => {
      try {
        callback.apply(this, args);
      } catch (error) {
        console.error(`Error in event listener for '${event}':`, error);
      }
    });

    return true;
  }

  // Get listener count
  listenerCount(event) {
    return this.listeners.has(event) ? this.listeners.get(event).length : 0;
  }

  // Get all events
  eventNames() {
    return Array.from(this.listeners.keys());
  }

  // Set max listeners
  setMaxListeners(n) {
    this.maxListeners = n;
    return this;
  }
}

// DOM Event utilities
class DOMEventUtils {
  // Add event listener with automatic cleanup
  static addListener(element, event, handler, options = {}) {
    if (!element || !event || !handler) {
      throw new Error('Element, event, and handler are required');
    }

    element.addEventListener(event, handler, options);

    // Return cleanup function
    return () => {
      element.removeEventListener(event, handler, options);
    };
  }

  // Add multiple event listeners
  static addListeners(element, events, handler, options = {}) {
    const cleanupFunctions = [];

    events.forEach(event => {
      const cleanup = this.addListener(element, event, handler, options);
      cleanupFunctions.push(cleanup);
    });

    // Return cleanup function for all listeners
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }

  // Delegate event handling
  static delegate(parent, selector, event, handler) {
    const delegateHandler = (e) => {
      const target = e.target.closest(selector);
      if (target && parent.contains(target)) {
        handler.call(target, e);
      }
    };

    return this.addListener(parent, event, delegateHandler);
  }

  // Throttle event handler
  static throttle(handler, delay = 100) {
    let lastCall = 0;
    let timeoutId = null;

    return function(...args) {
      const now = Date.now();

      if (now - lastCall >= delay) {
        lastCall = now;
        handler.apply(this, args);
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          lastCall = Date.now();
          handler.apply(this, args);
        }, delay - (now - lastCall));
      }
    };
  }

  // Debounce event handler
  static debounce(handler, delay = 300) {
    let timeoutId = null;

    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handler.apply(this, args);
      }, delay);
    };
  }

  // Get mouse/touch position
  static getPointerPosition(event) {
    if (event.touches && event.touches.length > 0) {
      return {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      };
    }

    return {
      x: event.clientX,
      y: event.clientY
    };
  }

  // Check if event is from touch device
  static isTouchEvent(event) {
    return event.type.startsWith('touch');
  }

  // Prevent default and stop propagation
  static stopEvent(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  // Get element bounds relative to viewport
  static getElementBounds(element) {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2
    };
  }
}

// Keyboard event utilities
class KeyboardEventUtils {
  static keyMap = {
    // Arrow keys
    'ArrowUp': 'up',
    'ArrowDown': 'down',
    'ArrowLeft': 'left',
    'ArrowRight': 'right',
    
    // WASD
    'KeyW': 'up',
    'KeyS': 'down',
    'KeyA': 'left',
    'KeyD': 'right',
    
    // Page keys for Z
    'PageUp': 'zUp',
    'PageDown': 'zDown',
    
    // Numbers
    'Digit1': '1',
    'Digit2': '2',
    'Digit3': '3',
    'Digit4': '4',
    'Digit5': '5',
    
    // Function keys
    'F1': 'f1',
    'F2': 'f2',
    'F3': 'f3',
    
    // Special keys
    'Space': 'space',
    'Enter': 'enter',
    'Escape': 'escape',
    'Tab': 'tab'
  };

  static getKeyName(event) {
    return this.keyMap[event.code] || event.key.toLowerCase();
  }

  static isModifierPressed(event) {
    return event.ctrlKey || event.altKey || event.shiftKey || event.metaKey;
  }

  static getModifiers(event) {
    return {
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey
    };
  }

  static createKeyCombo(event) {
    const modifiers = [];
    if (event.ctrlKey) modifiers.push('ctrl');
    if (event.altKey) modifiers.push('alt');
    if (event.shiftKey) modifiers.push('shift');
    if (event.metaKey) modifiers.push('meta');

    const key = this.getKeyName(event);
    
    return modifiers.length > 0 ? `${modifiers.join('+')}+${key}` : key;
  }
}





// Enhanced global event bus with additional methods
class EnhancedEventBus extends EventEmitter {
  constructor() {
    super();
  }

  // Alias for emit (backward compatibility)
  notifyListeners(event, ...args) {
    return this.emit(event, ...args);
  }

  // Batch event emission
  emitBatch(events) {
    events.forEach(({ event, args = [] }) => {
      this.emit(event, ...args);
    });
  }

  // Event statistics
  getStats() {
    const stats = {};
    this.eventNames().forEach(event => {
      stats[event] = this.listenerCount(event);
    });
    return stats;
  }

  // Debug information
  debug() {
      events: this.eventNames(),
      stats: this.getStats(),
      totalListeners: this.eventNames().reduce((sum, event) => sum + this.listenerCount(event), 0)
    });
  }
}

// Create enhanced global event bus
const globalEventBus = new EnhancedEventBus();

// Global registration
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.EventEmitter = EventEmitter;
window.EnderTrack.DOMEvents = DOMEventUtils;
window.EnderTrack.KeyboardEventUtils = KeyboardEventUtils;

window.EnderTrack.EventBus = globalEventBus;

// Alias for convenience
window.EnderTrack.Events = globalEventBus;
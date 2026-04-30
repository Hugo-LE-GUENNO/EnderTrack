// modules/navigation/keyboard/keyboard-logger.js - Keyboard action logging
class KeyboardLogger {
  constructor() {
    this.logEntries = [];
    this.maxLogEntries = 50;
  }

  addLogEntry(action) {
    const timestamp = new Date().toLocaleTimeString('fr-FR', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });

    const entry = {
      timestamp,
      action,
      id: Date.now()
    };

    this.logEntries.unshift(entry);
    
    if (this.logEntries.length > this.maxLogEntries) {
      this.logEntries = this.logEntries.slice(0, this.maxLogEntries);
    }

    this.updateLogDisplay();
  }

  updateLogDisplay() {
    const container = document.getElementById('lastCommand');
    if (!container || this.logEntries.length === 0) return;

    const lastEntry = this.logEntries[0];
    container.textContent = `${lastEntry.timestamp} - ${lastEntry.action}`;
  }

  clearLog() {
    this.logEntries = [];
    const container = document.getElementById('lastCommand');
    if (container) {
      container.textContent = 'Aucune commande';
    }
  }

  getLogEntries() {
    return this.logEntries;
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.KeyboardLogger = new KeyboardLogger();
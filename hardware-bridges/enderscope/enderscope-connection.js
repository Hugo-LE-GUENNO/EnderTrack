// enderscope/connection.js - Enderscope hardware connection

class EnderscopeConnection {
  constructor() {
    this.isConnected = false;
    this.serverUrl = window.ENDERTRACK_SERVER || 'http://localhost:5000';
    this.currentPort = null;
    this.position = { x: 0, y: 0, z: 0 };
    this.serverSimulationMode = false;
    this.connectionError = null;
    this.connectionMonitor = null;
    this.lastConnectionCheck = Date.now();
  }

  async init() {
    this.setupUI();
    await this.checkServerStatus();
    await this.refreshPorts();
    this.updateMainModeIndicator();
    this.startConnectionMonitor();
    // Auto-connect on startup
    await this.autoConnect();
    return true;
  }

  async autoConnect() {
    try {
      // Check if server is reachable first
      const response = await fetch(`${this.serverUrl}/api/status`, {
        signal: AbortSignal.timeout(2000)
      });
      const status = await response.json();
      
      if (status.connected) {
        // Already connected (server kept connection)
        this.isConnected = true;
        this.currentPort = status.port;
        this.updateConnectionStatus();
        await this.syncPosition();
        this.showStartupNotification(true);
        return;
      }
      
      // Try to connect to default port
      const port = document.getElementById('serialPort')?.value || '/dev/ttyUSB0';
      const baudRate = parseInt(document.getElementById('baudRate')?.value) || 115200;
      
      const connectResponse = await fetch(`${this.serverUrl}/api/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port, baudRate }),
        signal: AbortSignal.timeout(10000)
      });
      
      const result = await connectResponse.json();
      
      if (result.success) {
        this.isConnected = true;
        this.currentPort = port;
        this.currentBaudRate = baudRate;
        this.updateConnectionStatus();
        await this.syncPosition();
        this.showStartupNotification(true);
      } else {
        this.showStartupNotification(false);
      }
    } catch (error) {
      // Server not available — stay in simulator mode silently
      this.showStartupNotification(false);
    }
  }

  showStartupNotification(connected) {
    if (!window.EnderTrack?.UI?.showNotification) return;
    if (connected) {
      window.EnderTrack.UI.showNotification('🔬 Enderscope connecté', 'success');
    } else {
      window.EnderTrack.UI.showNotification('🎮 Mode simulateur', 'info');
    }
  }

  setupUI() {
    this.refreshPorts();
    this.updateConnectionStatus();
  }

  async checkServerStatus() {
    try {
      const response = await fetch(`${this.serverUrl}/api/status`);
      const status = await response.json();
      this.serverSimulationMode = status.simulation_mode || false;
      
      if (this.serverSimulationMode) {
        console.warn('⚠️ Serveur Enderscope en MODE SIMULATION (enderscope.py non trouvé)');
      }
    } catch (error) {
      // Serveur non disponible
    }
  }

  async refreshPorts() {
    try {
      const response = await fetch(`${this.serverUrl}/api/ports`);
      const ports = await response.json();
      
      const select = document.getElementById('serialPort');
      const currentValue = select.value; // Sauvegarder la sélection actuelle
      
      select.innerHTML = '';
      
      // Ajouter /dev/ttyUSB0 par défaut s'il n'est pas dans la liste
      if (!ports.includes('/dev/ttyUSB0')) {
        const defaultOption = document.createElement('option');
        defaultOption.value = '/dev/ttyUSB0';
        defaultOption.textContent = '/dev/ttyUSB0';
        select.appendChild(defaultOption);
      }
      
      ports.forEach(port => {
        const option = document.createElement('option');
        option.value = port;
        option.textContent = port;
        if (port === '/dev/ttyUSB0') {
          option.selected = true; // Sélectionner par défaut
        }
        select.appendChild(option);
      });
      
      // Restaurer la sélection précédente si elle existe
      if (currentValue && ports.includes(currentValue)) {
        select.value = currentValue;
      } else {
        select.value = '/dev/ttyUSB0'; // Défaut
      }

    } catch (error) {
      // Serveur non disponible - mode silencieux
    }
  }

  async connect() {
    const port = document.getElementById('serialPort').value;
    const baudRate = parseInt(document.getElementById('baudRate').value) || 115200;
    
    
    if (!port) {
      return;
    }

    // Show progress bar
    this.showProgress('Connexion en cours...');
    
    try {
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(`${this.serverUrl}/api/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port, baudRate }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        this.isConnected = true;
        this.currentPort = port;
        this.currentBaudRate = baudRate;
        this.hideProgress();
        this.updateConnectionStatus();
        // Synchroniser la position après connexion
        await this.syncPosition();
      } else {
        this.connectionError = result.error;
        this.hideProgress();
        this.updateConnectionStatus();
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        this.connectionError = 'Timeout de connexion';
      } else {
        this.connectionError = 'Serveur non disponible';
      }
      this.hideProgress();
      this.updateConnectionStatus();
    }
  }
  
  showProgress(text = 'Connexion en cours...') {
    const progress = document.getElementById('connectionProgress');
    const progressText = progress?.querySelector('.progress-text');
    const statusIndicator = document.getElementById('connectionStatus');
    
    if (progressText) progressText.textContent = text;
    if (progress) progress.style.display = 'block';
    if (statusIndicator) {
      statusIndicator.classList.remove('connected');
      statusIndicator.classList.add('connecting');
    }
  }
  
  hideProgress() {
    const progress = document.getElementById('connectionProgress');
    
    if (progress) progress.style.display = 'none';
    // Ne pas toucher à statusIndicator ici - laissé à updateConnectionStatus()
  }

  async disconnect() {
    try {
      await fetch(`${this.serverUrl}/api/disconnect`, { method: 'POST' });
      this.isConnected = false;
      this.currentPort = null;
      this.currentBaudRate = null;
      this.connectionError = null;
      this.updateConnectionStatus();
    } catch (error) {
      // Erreur de déconnexion - mode silencieux
    }
  }

  async home() {
    if (!this.isConnected) return;

    try {
      const response = await fetch(`${this.serverUrl}/api/home`, { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        // Synchroniser la position après le homing
        await this.syncPosition();
      }
    } catch (error) {
      // Erreur homing - mode silencieux
    }
  }

  async getPosition() {
    if (!this.isConnected) return;

    try {
      const response = await fetch(`${this.serverUrl}/api/position`);
      const result = await response.json();
      
      if (result.success) {
        const p = result.position;
        this.position = { x: p.x ?? p.X ?? 0, y: p.y ?? p.Y ?? 0, z: p.z ?? p.Z ?? 0 };
        this.updatePositionDisplay();
        
        if (window.EnderTrack?.State) {
          window.EnderTrack.State.update({ pos: this.position });
          window.EnderTrack.State.recordFinalPosition(this.position);
        }
      }
    } catch (error) {
      // Erreur lecture position - mode silencieux
    }
  }

  async queryDeviceInfo() {
    this.deviceInfoReady = false;
    try {
      const response = await fetch(`${this.serverUrl}/api/gcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'M115' }),
        signal: AbortSignal.timeout(3000)
      });
      const result = await response.json();
      if (result.success && result.response) {
        const raw = result.response.join(' ');
        const machineMatch = raw.match(/MACHINE_TYPE:([^\s]+)/);
        const fwMatch = raw.match(/FIRMWARE_NAME:([^\s]+)/);
        this.deviceName = machineMatch ? machineMatch[1].replace(/_/g, ' ') : null;
        this.firmwareName = fwMatch ? fwMatch[1] : null;
      }
    } catch (e) {
      this.deviceName = null;
      this.firmwareName = null;
    }
    this.deviceInfoReady = true;
    if (window._updateStatusNow) window._updateStatusNow();
  }

  async syncPosition() {
    if (!this.isConnected) return;
    await this.queryDeviceInfo();

    try {
      // Récupérer la position actuelle de l'interface
      const currentInterfacePos = window.EnderTrack?.State?.get()?.pos || { x: 0, y: 0, z: 0 };
      
      // Récupérer la position de l'Enderscope
      const response = await fetch(`${this.serverUrl}/api/position`);
      const result = await response.json();
      
      if (result.success) {
        const p = result.position;
        const enderscopePos = { x: p.x ?? p.X ?? 0, y: p.y ?? p.Y ?? 0, z: p.z ?? p.Z ?? 0 };
        
        // Synchroniser l'interface avec la position réelle de l'Enderscope
        this.position = enderscopePos;
        
        if (window.EnderTrack?.State) {
          window.EnderTrack.State.update({ 
            pos: enderscopePos,
            // Mettre à jour aussi les inputs absolus
            targetPosition: enderscopePos
          });
        }
        
        // Mettre à jour les inputs d'interface
        this.updateAbsoluteInputs(enderscopePos);
        this.updatePositionDisplay();
      }
    } catch (error) {
    }
  }

  updateAbsoluteInputs(position) {
    // Mettre à jour tous les inputs de position absolue
    const inputs = [
      { id: 'inputX', value: position.x },
      { id: 'inputY', value: position.y },
      { id: 'inputZ', value: position.z },
      { id: 'inputXSep', value: position.x },
      { id: 'inputYSep', value: position.y }
    ];
    
    inputs.forEach(({ id, value }) => {
      const input = document.getElementById(id);
      if (input && value !== undefined && value !== null) {
        input.value = Number(value).toFixed(2);
      }
    });
  }

  async moveAbsolute(x, y, z) {
    if (!this.isConnected) return false;

    try {
      const response = await fetch(`${this.serverUrl}/api/move/absolute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y, z })
      });

      const result = await response.json();
      
      if (result.success) {
        // Synchroniser la position après le mouvement
        await this.syncPosition();
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async moveRelative(dx, dy, dz) {
    if (!this.isConnected) return false;

    try {
      const response = await fetch(`${this.serverUrl}/api/move/relative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dx, dy, dz })
      });

      const result = await response.json();
      
      if (result.success) {
        // Synchroniser la position après le mouvement
        await this.syncPosition();
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  updateConnectionStatus() {
    const statusIndicator = document.getElementById('connectionStatus');
    const statusText = document.getElementById('connectionText');
    const connectBtn = document.getElementById('connectBtn');
    const controls = document.getElementById('enderscopeControls');

    // Trigger instant status widget update
    if (window._updateStatusNow) window._updateStatusNow();

    if (!statusIndicator) return;
    statusIndicator.classList.remove('connected', 'connecting');

    if (this.isConnected) {
      statusIndicator.classList.add('connected');
      statusText.textContent = `Connecté (${this.currentPort})`;
      statusText.style.color = '#10b981';
      connectBtn.textContent = 'Déconnecter';
      connectBtn.onclick = () => this.disconnect();
      if (controls) controls.style.display = 'block';
    } else {
      if (this.connectionError) {
        statusText.textContent = this.connectionError;
        statusText.style.color = '#ef4444';
      } else {
        statusText.textContent = '🎮 Mode simulateur';
        statusText.style.color = 'var(--text-general)';
      }
      connectBtn.textContent = 'Connecter';
      connectBtn.onclick = () => this.connect();
      if (controls) controls.style.display = 'none';
    }
    this.updateMainModeIndicator();
  }

  updatePositionDisplay() {
    const display = document.getElementById('enderscopePosition');
    if (display) {
      display.textContent = `X: ${this.position.x.toFixed(2)} Y: ${this.position.y.toFixed(2)} Z: ${this.position.z.toFixed(2)}`;
    }
  }

  startConnectionMonitor() {
    // Vérification toutes les 3 secondes
    this.connectionMonitor = setInterval(() => {
      if (this.isConnected) {
        this.checkConnectionHealth();
      } else {
        this.tryReconnect();
      }
    }, 3000);
  }

  async tryReconnect() {
    try {
      const r = await fetch(`${this.serverUrl}/api/ports`);
      const ports = await r.json();
      const usbPort = ports.find(p => p.includes('USB') || p.includes('ACM'));
      if (usbPort) {
        const resp = await fetch(`${this.serverUrl}/api/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ port: usbPort, baudRate: 115200 }),
          signal: AbortSignal.timeout(10000)
        });
        const result = await resp.json();
        if (result.success) {
          this.isConnected = true;
          this.currentPort = usbPort;
          this.connectionError = null;
          this.updateConnectionStatus();
          await this.syncPosition();
          window.EnderTrack?.UI?.showSuccess?.(`🔬 Reconnecté (${usbPort})`);
        }
      }
    } catch {}
  }

  async checkConnectionHealth() {
    try {
      const response = await fetch(`${this.serverUrl}/api/status`, {
        method: 'GET',
        timeout: 2000
      });
      
      if (!response.ok) {
        throw new Error('Serveur non disponible');
      }
      
      const status = await response.json();
      
      // Vérifier si la connexion série est toujours active
      if (status.connected === false && this.isConnected) {
        this.handleConnectionLost('Port série déconnecté');
      }
      
    } catch (error) {
      if (this.isConnected) {
        this.handleConnectionLost('Serveur Enderscope non disponible');
      }
    }
  }

  handleConnectionLost(reason) {
    this.isConnected = false;
    this.currentPort = null;
    this.connectionError = `Déconnecté: ${reason}`;
    this.updateConnectionStatus();
    
    // Notification visuelle
    if (window.EnderTrack?.UI?.showNotification) {
      window.EnderTrack.UI.showNotification(`⚠️ ${reason} - Retour en mode simulateur`, 'warning');
    }
  }

  updateMainModeIndicator() {
    const statusLabel = document.getElementById('mainStatusLabel');
    const statusLight = document.getElementById('mainStatusLight');
    const statusWidget = document.querySelector('.status-widget');
    if (!statusLabel) return;
    if (this.isConnected) {
      statusLabel.innerHTML = '<span style="color:#10b981; font-weight:600;">CONNECTÉ</span> <span style="font-size:10px; opacity:0.6;">' + (this.currentPort || '') + '</span>';
      if (statusLight) { statusLight.style.background = '#10b981'; statusLight.style.boxShadow = '0 0 12px #10b981'; }
      if (statusWidget) { statusWidget.style.borderLeft = '3px solid #10b981'; }
    } else {
      statusLabel.innerHTML = '<span style="color:var(--coordinates-color);">SIMULATEUR</span>';
      if (statusLight) { statusLight.style.background = 'var(--coordinates-color)'; statusLight.style.boxShadow = '0 0 8px var(--coordinates-color)'; }
      if (statusWidget) { statusWidget.style.borderLeft = '3px solid var(--coordinates-color)'; }
    }
  }
  // === MOVEMENT METHODS (fusionnés depuis enderscope-movement.js) ===
  
  // Move to absolute position with hardware integration
  async moveAbsoluteHardware(x, y, z) {
    if (!this.isConnected) {
      return false;
    }

    const feedrate = window.EnderTrack?.State?.get()?.feedrate || 3000;
    console.time('⏱️ moveAbsolute (total avec M400)');
    
    try {
      const response = await fetch(`${this.serverUrl}/api/move/absolute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y, z, feedrate })
      });

      const result = await response.json();
      console.timeEnd('⏱️ moveAbsolute (total avec M400)');
      
      if (result.m400_duration !== undefined) {
      }
      
      if (result.success) {
        if (window.EnderTrack?.State) {
          window.EnderTrack.State.update({ pos: { x, y, z } });
          window.EnderTrack.State.recordFinalPosition({ x, y, z });
        }
        await this.getPosition();
        return true;
      }
      return false;
    } catch (error) {
      console.timeEnd('⏱️ moveAbsolute (total avec M400)');
      return false;
    }
  }

  // Move relative to current position with hardware integration
  async moveRelativeHardware(dx, dy, dz) {
    if (!this.isConnected) {
      return false;
    }

    const feedrate = window.EnderTrack?.State?.get()?.feedrate || 3000;
    console.time('⏱️ moveRelative (total avec M400)');
    
    try {
      const response = await fetch(`${this.serverUrl}/api/move/relative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dx, dy, dz, feedrate })
      });

      const result = await response.json();
      console.timeEnd('⏱️ moveRelative (total avec M400)');
      
      if (result.m400_duration !== undefined) {
      }
      
      if (result.success) {
        const currentState = window.EnderTrack?.State?.get();
        if (currentState) {
          const newPos = {
            x: currentState.pos.x + dx,
            y: currentState.pos.y + dy,
            z: currentState.pos.z + dz
          };
          window.EnderTrack.State.update({ pos: newPos });
          window.EnderTrack.State.recordFinalPosition(newPos);
        }
        await this.getPosition();
        return true;
      }
      return false;
    } catch (error) {
      console.timeEnd('⏱️ moveRelative (total avec M400)');
      return false;
    }
  }

  // Home all axes with hardware integration
  async homeHardware() {
    if (!this.isConnected) {
      return false;
    }

    
    try {
      const response = await fetch(`${this.serverUrl}/api/home`, {
        method: 'POST'
      });

      const result = await response.json();
      
      if (result.success) {
        // Update position to home (0,0,0)
        const homePos = { x: 0, y: 0, z: 0 };
        
        if (window.EnderTrack?.State) {
          window.EnderTrack.State.update({ pos: homePos });
          window.EnderTrack.State.recordFinalPosition(homePos);
        }
        
        // Update Enderscope position
        await this.getPosition();
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}

// Global functions
function refreshSerialPorts() {
  window.EnderTrack?.Enderscope?.refreshPorts();
}

function toggleConnection() {
  if (window.EnderTrack?.Enderscope?.isConnected) {
    window.EnderTrack.Enderscope.disconnect();
  } else {
    window.EnderTrack.Enderscope.connect();
  }
}

function homeEnderscope() {
  window.EnderTrack?.Enderscope?.home();
}

function getEnderscopePosition() {
  window.EnderTrack?.Enderscope?.getPosition();
}

function testEnderscope() {
  if (window.EnderTrack?.Movement) {
    window.EnderTrack.Movement.moveRelative(1, 0, 0);
  }
}

// Emergency stop with G-code (PRIORITÉ MAX)
async function emergencyStopGcode() {
  try {
    const response = await fetch((window.ENDERTRACK_SERVER || 'http://localhost:5000') + '/api/emergency_stop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Priority': 'EMERGENCY' // Header spécial pour priorité max
      },
      body: JSON.stringify({
        command: 'M112', // Emergency stop G-code
        priority: 'EMERGENCY',
        immediate: true // Passer devant toutes les autres commandes
      })
    });
    
    const result = await response.json();
    if (result.success) {
    }
  } catch (error) {
  }
}

// G-code Direct
async function sendGcode() {
  const command = document.getElementById('gcodeInput').value.trim();
  if (!command) return;
  
  const output = document.getElementById('gcodeOutput');
  const appendLog = (text) => {
    if (!output) return;
    output.value += (output.value ? '\n' : '') + text;
    output.scrollTop = output.scrollHeight;
  };
  
  appendLog(`> ${command}`);
  
  try {
    const response = await fetch((window.ENDERTRACK_SERVER || 'http://localhost:5000') + '/api/gcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
    
    const result = await response.json();
    if (result.success) {
      document.getElementById('gcodeInput').value = '';
      if (result.response) {
        result.response.forEach(line => appendLog(line));
      }
    } else {
      appendLog(`❌ ${result.error}`);
    }
  } catch (error) {
    appendLog(`❌ ${error.message}`);
  }
}

async function sendPresetGcode(command) {
  document.getElementById('gcodeInput').value = command;
  await sendGcode();
}

// Beep
async function sendBeep() {
  try {
    const response = await fetch((window.ENDERTRACK_SERVER || 'http://localhost:5000') + '/api/beep', {
      method: 'POST'
    });
    
    const result = await response.json();
    if (result.success) {
    }
  } catch (error) {
  }
}

// Debug functions
async function testConnection() {
  await sendPresetGcode('M115');
}

async function testMovement() {
  if (window.EnderTrack?.Movement) {
    window.EnderTrack.Movement.moveRelative(1, 0, 0);
  }
}

async function resetEnderscope() {
  
  // Reset l'état d'urgence local
  if (window.EnderTrack?.State) {
    window.EnderTrack.State.update({ emergencyStopActive: false });
  }
  if (window.EnderTrack?.Movement) {
    window.EnderTrack.Movement.emergencyStop = false;
  }
  
  // Reset le mode d'urgence visuel
  if (window.EnderTrackApp?.resetEmergencyMode) {
    window.EnderTrackApp.resetEmergencyMode();
  }
  
  // Envoyer M999 pour reset le firmware
  await sendPresetGcode('M999');
  
}

async function resetFirmware() {
  if (!confirm('Reset matériel du microcontrôleur (DTR toggle) ?\nLe firmware va redémarrer.')) return;
  const serverUrl = window.EnderTrack?.Enderscope?.serverUrl || window.ENDERTRACK_SERVER || 'http://localhost:5000';
  try {
    EnderTrack.UI?.showNotification?.('Reset matériel en cours...', 'warning');
    const response = await fetch(serverUrl + '/api/reset_firmware', { method: 'POST' });
    const result = await response.json();
    if (result.success) {
      EnderTrack.UI?.showNotification?.('Firmware reset OK', 'success');
      // Re-sync position
      if (window.EnderTrack?.Enderscope?.syncPosition) {
        setTimeout(() => window.EnderTrack.Enderscope.syncPosition(), 1000);
      }
    } else {
      EnderTrack.UI?.showNotification?.(result.error || 'Reset échoué', 'error');
    }
    if (window._updateStatusNow) window._updateStatusNow();
  } catch (e) {
    EnderTrack.UI?.showNotification?.('Serveur inaccessible', 'error');
  }
}

// New interface functions
function resetSerialPort() {
  document.getElementById('serialPort').value = '/dev/ttyUSB0';
  refreshSerialPorts(); // Actualise aussi les ports série
}

function resetBaudRate() {
  document.getElementById('baudRate').value = '115200';
  refreshSerialPorts(); // Actualise aussi les ports série
}

function handleGcodeEnter(event) {
  if (event.key === 'Enter') {
    sendGcode();
  }
}

function showGcodeHelp() {
  let modal = document.getElementById('gcodeHelpModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'gcodeHelpModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000;';
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    const cmds = [
      ['G0 / G1 X Y Z F', 'Déplacement (G0=rapide, G1=linéaire avec feedrate F)'],
      ['G28', 'Homing — retour origine tous axes'],
      ['G28 X / Y / Z', 'Homing axe individuel'],
      ['G90', 'Mode positionnement absolu'],
      ['G91', 'Mode positionnement relatif'],
      ['G92 X0 Y0 Z0', 'Définir position actuelle comme origine'],
      ['M114', 'Position actuelle (X Y Z)'],
      ['M115', 'Info firmware (version, capabilities)'],
      ['M119', 'État des endstops'],
      ['M400', 'Attendre fin de tous les mouvements'],
      ['M300 S440 P200', 'Bip (fréquence S, durée P ms)'],
      ['M112', '⚠️ Arrêt d\'urgence immédiat'],
      ['M999', 'Reset après arrêt d\'urgence'],
      ['M17', 'Activer les moteurs'],
      ['M18 / M84', 'Désactiver les moteurs'],
      ['M201 X A Y A Z A', 'Accélération max par axe (mm/s²)'],
      ['M203 X V Y V Z V', 'Vitesse max par axe (mm/s)'],
      ['M204 P T', 'Accélération impression (P) / travel (T)'],
      ['M205 X J Y J Z J', 'Jerk / Junction Deviation par axe'],
      ['M211 S0 / S1', 'Désactiver / activer software endstops'],
      ['M500', 'Sauvegarder config en EEPROM'],
      ['M501', 'Charger config depuis EEPROM'],
      ['M502', 'Reset config usine (sans sauver)'],
      ['M503', 'Afficher config actuelle'],
      ['G21', 'Unités en millimètres'],
      ['G20', 'Unités en pouces'],
    ];
    modal.innerHTML = `<div style="background:var(--container-bg,#2c2c2c);border-radius:8px;padding:20px;max-width:520px;width:90%;max-height:80vh;overflow-y:auto;color:#ccc;font-size:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;color:#fff;font-size:15px;">📖 Commandes G-code</h3>
        <button onclick="document.getElementById('gcodeHelpModal').style.display='none'" style="background:none;border:none;color:#888;font-size:18px;cursor:pointer;">✕</button>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${cmds.map(([cmd, desc]) => `<tr style="border-bottom:1px solid #333;">
          <td style="padding:5px 8px 5px 0;font-family:monospace;color:#ffc107;white-space:nowrap;font-size:11px;cursor:pointer;" onclick="document.getElementById('gcodeInput').value='${cmd.split(' ')[0]}';document.getElementById('gcodeHelpModal').style.display='none';" title="Cliquer pour insérer">${cmd}</td>
          <td style="padding:5px 0;color:#aaa;font-size:11px;">${desc}</td>
        </tr>`).join('')}
      </table>
    </div>`;
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
}

function closeGcodeHelp() {
  const modal = document.getElementById('gcodeHelpModal');
  if (modal) modal.style.display = 'none';
}

async function getEnderscopeInfo() {
  await sendPresetGcode('M115');
}

async function syncEnderscopePosition() {
  if (window.EnderTrack?.Enderscope) {
    await window.EnderTrack.Enderscope.syncPosition();
  }
}

function updateFeedrate(value) {
  const feedrate = Math.max(100, Math.min(10000, parseInt(value) || 3000));
  const slider = document.getElementById('feedrateSlider');
  const input = document.getElementById('feedrateInput');
  if (slider) slider.value = feedrate;
  if (input) input.value = feedrate;
  if (window.EnderTrack?.State) {
    window.EnderTrack.State.update({ feedrate });
  }
  localStorage.setItem('endertrack_feedrate', feedrate);
}

// Global instance
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Enderscope = new EnderscopeConnection();

// Alias pour compatibilité avec enderscope-movement.js
class EnderscopeMovement {
  constructor() {
    this.serverUrl = window.ENDERTRACK_SERVER || 'http://localhost:5000';
  }

  isConnected() {
    return window.EnderTrack?.Enderscope?.isConnected || false;
  }

  async moveAbsolute(x, y, z) {
    return await window.EnderTrack.Enderscope.moveAbsoluteHardware(x, y, z);
  }

  async moveRelative(dx, dy, dz) {
    return await window.EnderTrack.Enderscope.moveRelativeHardware(dx, dy, dz);
  }

  async home() {
    return await window.EnderTrack.Enderscope.homeHardware();
  }

  async getPosition() {
    return await window.EnderTrack.Enderscope.getPosition();
  }
}

// Maintenir la compatibilité
window.EnderTrack.EnderscopeMovement = new EnderscopeMovement();
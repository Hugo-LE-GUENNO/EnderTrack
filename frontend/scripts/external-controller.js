// External Controller - Version Modulaire Simplifiée
// Contrôleur principal qui orchestre tous les modules

class ExternalController {
  constructor() {
    this.isActive = false;
    this.selectedController = null;
    
    // Initialiser les modules
    this.detector = new window.EnderTrack.DeviceDetector();
    this.mapper = new window.EnderTrack.InputMapper();
    this.executor = new window.EnderTrack.ActionExecutor();
    this.processor = new window.EnderTrack.InputProcessor(this.mapper, this.executor);
  }

  async init() {
    await this.detector.detectAll();
    this.setupEventListeners();
    return true;
  }

  setupEventListeners() {
    // Gamepad events
    window.addEventListener('gamepadconnected', () => {
      this.detector.detectAll();
      this.updateUI();
    });

    // Keyboard events
    document.addEventListener('keydown', (e) => {
      if (this.mapper.isListening && this.mapper.currentMappingAction) {
        e.preventDefault();
        this.processor.handleKeyboardInput(e.code);
      }
    });

    // MIDI events (si détectés)
    this.detector.controllers.forEach((controller, id) => {
      if (controller.type === 'midi' && controller.input) {
        controller.input.onmidimessage = (event) => {
          this.processor.handleMIDIMessage(id.replace('midi_', ''), event);
        };
      }
    });

    // Universal Bridge events
    if (this.detector.universalBridge) {
      this.detector.universalBridge.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'input') {
          this.processor.handleUniversalInput(message.data);
        } else if (message.type === 'devices') {
          this.detector.updateDevicesFromBridge(message.devices);
          this.updateUI();
        }
      };
    }
  }


  activate() {
    this.isActive = true;
    this.processor.start();
    this.populateDeviceSelector();
  }

  deactivate() {
    this.isActive = false;
    this.processor.stop();
  }

  async refreshDevices() {
    await this.detector.detectAll();
    this.updateUI();
  }

  populateDeviceSelector() {
    const selector = document.getElementById('deviceSelector');
    if (!selector) return;
    
    selector.innerHTML = '<option value="">-- Sélectionnez un périphérique --</option>';
    
    this.detector.controllers.forEach((controller, id) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = `${this.detector.getIcon(controller.type)} ${controller.name}`;
      if (id === 'keyboard_system') option.selected = true;
      selector.appendChild(option);
    });
    
    this.selectDevice('keyboard_system');
  }

  selectDevice(deviceId) {
    const selector = document.getElementById('deviceSelector');
    const selectedId = deviceId || selector?.value;
    
    if (!selectedId) return;
    
    this.selectedController = selectedId;
    const controller = this.detector.controllers.get(selectedId);
    
    if (controller) {
      this.updateDeviceStatus(controller);
    }
    
    this.updateMappingDisplay();
  }

  updateDeviceStatus(controller) {
    const status = document.getElementById('deviceStatus');
    const statusText = document.getElementById('deviceStatusText');
    
    if (status && statusText) {
      status.style.display = 'block';
      status.style.background = controller.connected ? '#10b981' : '#ef4444';
      statusText.textContent = `${controller.name} - ${controller.connected ? 'Connecté' : 'Déconnecté'}`;
    }
  }

  updateUI() {
    const list = document.getElementById('controllerList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (this.detector.controllers.size === 0) {
      list.innerHTML = '<div style="color: #ffc107; padding: 8px;">Aucun contrôleur détecté</div>';
      return;
    }
    
    this.detector.controllers.forEach((controller, id) => {
      const div = document.createElement('div');
      const statusColor = controller.connected ? '#10b981' : '#ef4444';
      const statusText = controller.connected ? 'Connecté' : 'Déconnecté';
      
      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; margin: 4px 0; background: rgba(255,255,255,0.1); border-radius: 4px; border-left: 3px solid ${statusColor};">
          <div>
            <div>${this.detector.getIcon(controller.type)} ${controller.name}</div>
            <small style="color: ${statusColor};">${statusText}</small>
          </div>
          <button onclick="window.ExternalController.selectController('${id}')" style="padding: 4px 12px; font-size: 11px; background: #4a5568; border: none; color: white; border-radius: 4px; cursor: pointer;">Sélectionner</button>
        </div>
      `;
      list.appendChild(div);
    });
    
    this.populateDeviceSelector();
  }

  selectController(id) {
    this.selectedController = id;
    document.getElementById('mappingSection').style.display = 'block';
    this.updateMappingDisplay();
  }

  // Déléguer les méthodes de mapping
  startMapping(action) {
    this.mapper.startMapping(action);
  }

  loadMidiPreset() {
    this.mapper.loadMidiPreset();
    this.updateMappingDisplay();
  }

  loadGamepadPreset() {
    this.mapper.loadGamepadPreset();
    this.updateMappingDisplay();
  }

  updateMappingDisplay() {
    this.mapper.updateMappingDisplay();
  }

  // Méthodes pour la modal (compatibilité)
  openMappingModal() {
    const modal = document.getElementById('mappingModal');
    if (modal) {
      modal.style.display = 'block';
      this.updateMappingModal();
    }
  }

  closeMappingModal() {
    const modal = document.getElementById('mappingModal');
    if (modal) {
      modal.style.display = 'none';
      this.mapper.stopMapping();
    }
  }

  updateMappingModal() {
    const actions = ['up', 'down', 'left', 'right', 'zUp', 'zDown'];
    actions.forEach(action => {
      const valueSpan = document.getElementById(`map${action.charAt(0).toUpperCase() + action.slice(1)}Value`);
      if (valueSpan) {
        const mapping = this.mapper.mapping[action];
        if (mapping) {
          valueSpan.textContent = this.mapper.formatMapping(mapping);
          valueSpan.style.color = '#10b981';
        } else {
          valueSpan.textContent = 'Non mappé';
          valueSpan.style.color = '#ef4444';
        }
      }
    });
  }

  switchMappingTab(tabName) {
    document.querySelectorAll('#mappingModal .display-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('#mappingModal .display-tab-content').forEach(content => content.classList.remove('active'));
    
    const tabs = ['navigation', 'functions', 'presets'];
    const tabIndex = tabs.indexOf(tabName);
    if (tabIndex >= 0) {
      document.querySelectorAll('#mappingModal .display-tab')[tabIndex].classList.add('active');
      document.getElementById(tabName + 'MappingTab').classList.add('active');
    }
  }

  // Déléguer les méthodes de configuration
  saveMappingConfig() {
    this.mapper.saveConfig();
  }

  loadMappingConfig() {
    this.mapper.loadConfig();
    this.updateMappingDisplay();
    this.updateMappingModal();
  }

  clearMappingConfig() {
    this.mapper.clearConfig();
    this.updateMappingDisplay();
    this.updateMappingModal();
  }
}

// Instance globale
window.ExternalController = new ExternalController();

// Fonctions globales pour compatibilité
function selectDevice(deviceId) { window.ExternalController.selectDevice(deviceId); }
function refreshDevices() { window.ExternalController.refreshDevices(); }
function openMappingModal() { window.ExternalController.openMappingModal(); }
function closeMappingModal() { window.ExternalController.closeMappingModal(); }
function startMapping(action) { window.ExternalController.startMapping(action); }
function saveMappingConfig() { window.ExternalController.saveMappingConfig(); }
function loadMappingConfig() { window.ExternalController.loadMappingConfig(); }
function clearMappingConfig() { window.ExternalController.clearMappingConfig(); }
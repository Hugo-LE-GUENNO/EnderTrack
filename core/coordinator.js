// core/coordinator.js - Module coordination and communication
// Coordinates communication between different modules

class ModuleCoordinator {
  constructor() {
    this.modules = new Map();
    this.dependencies = new Map();
    this.initializationOrder = [];
    this.isInitialized = false;
  }

  static init() {
    
    // Register core modules
    this.registerCoreModules();
    
    // Setup inter-module communication
    this.setupCommunication();
    
    this.isInitialized = true;
    
    return true;
  }

  static registerCoreModules() {
    // Register modules with their dependencies
    this.registerModule('State', {
      instance: window.EnderTrack.State,
      dependencies: [],
      priority: 1
    });
    
    this.registerModule('Events', {
      instance: window.EnderTrack.Events,
      dependencies: [],
      priority: 1
    });
    
    this.registerModule('Math', {
      instance: window.EnderTrack.Math,
      dependencies: [],
      priority: 2
    });
    
    this.registerModule('Graphics', {
      instance: window.EnderTrack.Graphics,
      dependencies: [],
      priority: 2
    });
    
    this.registerModule('Validation', {
      instance: window.EnderTrack.Validation,
      dependencies: ['Math'],
      priority: 2
    });
    
    this.registerModule('Coordinates', {
      instance: window.EnderTrack.Coordinates,
      dependencies: ['Math'],
      priority: 3
    });
    
    this.registerModule('Canvas', {
      instance: window.EnderTrack.Canvas,
      dependencies: ['State', 'Events', 'Coordinates'],
      priority: 4
    });
    
    this.registerModule('CanvasRenderer', {
      instance: window.EnderTrack.CanvasRenderer,
      dependencies: ['Graphics', 'Coordinates'],
      priority: 4
    });
    
    this.registerModule('CanvasInteractions', {
      instance: window.EnderTrack.CanvasInteractions,
      dependencies: ['Events', 'Coordinates', 'KeyboardUtils'],
      priority: 5
    });
    
    this.registerModule('Movement', {
      instance: window.EnderTrack.Movement,
      dependencies: ['State', 'Events', 'Math'],
      priority: 5
    });
    
    this.registerModule('Navigation', {
      instance: window.EnderTrack.Navigation,
      dependencies: ['State', 'Movement'],
      priority: 6
    });
    
    this.registerModule('UI.Notifications', {
      instance: window.EnderTrack.UI?.Notifications,
      dependencies: ['Events'],
      priority: 6
    });
    
    this.registerModule('UI.Modals', {
      instance: window.EnderTrack.UI?.Modals,
      dependencies: ['Events'],
      priority: 6
    });
    
    this.registerModule('UI.Controls', {
      instance: window.EnderTrack.UI?.Controls,
      dependencies: ['State', 'Events'],
      priority: 7
    });
    
    this.registerModule('UI.Panels', {
      instance: window.EnderTrack.UI?.Panels,
      dependencies: ['Events'],
      priority: 7
    });
    
    this.registerModule('UI.Tabs', {
      instance: window.EnderTrack.UI?.Tabs,
      dependencies: ['Events'],
      priority: 7
    });
  }

  static registerModule(name, config) {
    const {
      instance,
      dependencies = [],
      priority = 5,
      optional = false
    } = config;

    this.modules.set(name, {
      name,
      instance,
      dependencies,
      priority,
      optional,
      isInitialized: false,
      initializationTime: null
    });

    this.dependencies.set(name, dependencies);
  }

  static setupCommunication() {
    // Setup cross-module event handlers
    this.setupStateCoordination();
    this.setupCanvasCoordination();
    this.setupNavigationCoordination();
    this.setupUICoordination();
  }

  static setupStateCoordination() {
    // Coordinate state changes across modules
    EnderTrack.Events?.on?.('state:changed', (newState, oldState) => {
      // Update coordinate system when map parameters change
      if (newState.mapSizeMm !== oldState.mapSizeMm ||
          newState.zoom !== oldState.zoom ||
          newState.panX !== oldState.panX ||
          newState.panY !== oldState.panY) {
        
        if (EnderTrack.Coordinates) {
          EnderTrack.Coordinates.updateParameters({
            mapSizeMm: newState.mapSizeMm,
            zoom: newState.zoom,
            panX: newState.panX,
            panY: newState.panY
          });
        }
      }
      
      // Update UI controls when state changes
      if (EnderTrack.UI?.Controls) {
        EnderTrack.UI.Controls.syncWithState();
      }
      
      // Request canvas render
      if (EnderTrack.Canvas) {
        EnderTrack.Canvas.requestRender();
      }
    });
  }

  static setupCanvasCoordination() {
    // Coordinate canvas interactions with other systems
    EnderTrack.Events?.on?.('canvas:clicked', (event) => {
      const { map } = event;
      
      // Handle click-to-move if enabled
      const state = EnderTrack.State?.get?.();
      if (state?.enableClickGo && state?.inputMode === 'absolute') {
        if (EnderTrack.Movement) {
          EnderTrack.Movement.moveAbsolute(map.x, map.y, state.pos.z);
        }
      }
    });
    
    // Setup canvas interactions when canvas is ready
    EnderTrack.Events?.on?.('canvas:initialized', (canvas) => {
      if (EnderTrack.CanvasInteractions) {
        EnderTrack.CanvasInteractions.init(canvas);
      }
    });
  }

  static setupNavigationCoordination() {
    // Coordinate navigation with movement system
    EnderTrack.Events?.on?.('navigation:move_requested', (direction) => {
      if (EnderTrack.Movement) {
        EnderTrack.Movement.moveDirection(direction);
      }
    });
    
    // Update position inputs when position changes
    EnderTrack.Events?.on?.('movement:completed', (result) => {
      if (result.success && EnderTrack.UI?.Controls) {
        const state = EnderTrack.State?.get?.();
        if (state) {
          EnderTrack.UI.Controls.setValue('inputX', state.pos.x);
          EnderTrack.UI.Controls.setValue('inputY', state.pos.y);
          EnderTrack.UI.Controls.setValue('inputZ', state.pos.z);
        }
      }
    });
  }

  static setupUICoordination() {
    // Coordinate UI updates
    EnderTrack.Events?.on?.('ui:notification', (notification) => {
      // Log important notifications
      if (notification.type === 'error') {
        console.error('UI Error:', notification.message);
      }
    });
    
    // Coordinate tab switching with state
    EnderTrack.Events?.on?.('tab:switched', (event) => {
      EnderTrack.State?.update?.({ activeTab: event.to });
    });
    
    // Handle plugin activation
    EnderTrack.Events?.on?.('plugin:activated', (pluginData) => {
      if (EnderTrack.UI?.Notifications) {
        EnderTrack.UI.Notifications.showPluginStatus(pluginData.name, 'activated');
      }
    });
  }







  static checkDependencies(moduleName) {
    const dependencies = this.dependencies.get(moduleName) || [];
    const missing = [];
    
    dependencies.forEach(dep => {
      const depModule = this.modules.get(dep);
      if (!depModule || !depModule.instance) {
        missing.push(dep);
      }
    });
    
    return missing;
  }

  // Communication helpers
  static broadcast(event, data) {
    EnderTrack.Events?.emit?.(event, data);
  }

  static request(moduleName, method, ...args) {
    const moduleConfig = this.modules.get(moduleName);
    if (!moduleConfig || !moduleConfig.instance) {
      throw new Error(`Module ${moduleName} not available`);
    }
    
    const instance = moduleConfig.instance;
    if (typeof instance[method] !== 'function') {
      throw new Error(`Method ${method} not found on module ${moduleName}`);
    }
    
    return instance[method](...args);
  }

  static async requestAsync(moduleName, method, ...args) {
    const result = this.request(moduleName, method, ...args);
    return Promise.resolve(result);
  }


}

// Global registration
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Coordinator = ModuleCoordinator;
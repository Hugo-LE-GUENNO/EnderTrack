// modules/ui/tabs.js - Dynamic tab system management
// Handles core tabs and plugin tabs

class TabManager {
  constructor() {
    this.activeTabs = new Map();
    this.pluginTabs = new Map();
    this.currentTab = 'navigation';
    this.isInitialized = false;
  }

  init() {
    
    // Setup core tabs
    this.setupCoreTabs();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Set default active tab
    this.switchTab('navigation');
    
    this.isInitialized = true;
    
    return true;
  }

  setupCoreTabs() {
    // Register core tabs
    this.activeTabs.set('navigation', {
      id: 'navigation',
      name: 'Navigation',
      icon: '🧭',
      type: 'core',
      element: document.getElementById('navigationTab'),
      content: document.getElementById('navigationTabContent'),
      isActive: true
    });
    
    this.activeTabs.set('settings', {
      id: 'settings',
      name: 'Settings',
      icon: '⚙️',
      type: 'core',
      element: document.getElementById('settingsTab'),
      content: document.getElementById('settingsTabContent'),
      isActive: false
    });
    
    this.activeTabs.set('others', {
      id: 'others',
      name: 'Autres',
      icon: '🔧',
      type: 'core',
      element: document.getElementById('othersTab'),
      content: document.getElementById('othersTabContent'),
      isActive: false
    });
    
    this.activeTabs.set('acquisition', {
      id: 'acquisition',
      name: 'Scénario',
      icon: '🎬',
      type: 'core',
      element: document.getElementById('acquisitionTab'),
      content: document.getElementById('acquisitionTabContent'),
      isActive: false,
      module: 'Scenario'
    });
    
    this.activeTabs.set('overlays', {
      id: 'overlays',
      name: 'Overlays',
      icon: '🎨',
      type: 'core',
      element: document.getElementById('overlaysTab'),
      content: document.getElementById('overlaysTabContent'),
      isActive: false,
      module: 'Overlays'
    });
    
    // Register Lists tab as core module
    this.activeTabs.set('lists', {
      id: 'lists',
      name: 'Listes',
      icon: '📋',
      type: 'core',
      element: document.getElementById('listsTab'),
      content: document.getElementById('listsTabContent'),
      isActive: false,
      module: 'Lists'
    });
    
    // Register default plugin tabs (will be managed by plugin system)
    const defaultPlugins = ['sequences', 'drivers', 'enderman'];
    
    defaultPlugins.forEach(pluginId => {
      const tabElement = document.getElementById(`${pluginId}Tab`);
      const contentElement = document.getElementById(`${pluginId}TabContent`);
      
      if (tabElement && contentElement) {
        this.pluginTabs.set(pluginId, {
          id: pluginId,
          name: this.getPluginDisplayName(pluginId),
          icon: this.getPluginIcon(pluginId),
          type: 'plugin',
          element: tabElement,
          content: contentElement,
          isActive: false,
          isLoaded: false
        });
      }
    });
  }

  setupEventListeners() {
    // Listen to plugin events
    EnderTrack.Events.on('plugin:loaded', (pluginData) => {
      this.onPluginLoaded(pluginData);
    });
    
    EnderTrack.Events.on('plugin:activated', (pluginData) => {
      this.onPluginActivated(pluginData);
    });
    
    EnderTrack.Events.on('plugin:deactivated', (pluginData) => {
      this.onPluginDeactivated(pluginData);
    });
  }

  // Switch to a specific tab
  switchTab(tabId) {
    
    const previousTab = this.currentTab;
    
    // Deactivate current tab
    this.deactivateCurrentTab();
    
    // Activate new tab
    const success = this.activateTab(tabId);
    
    if (success) {
      this.currentTab = tabId;
      
      // Update state
      EnderTrack.State.update({ activeTab: tabId });
      
      // Notify listeners
      EnderTrack.Events.notifyListeners('tab:switched', {
        from: previousTab,
        to: tabId
      });
      
      // Gérer l'affichage du panneau droit
      this.updateRightPanel(tabId);
      
      // Gérer les overlays et tracks selon l'onglet
      this.updateOverlaysAndTracks(tabId);
    }
    
    return success;
  }
  
  updateOverlaysAndTracks(tabId) {
    const compassOverlay = document.getElementById('compassOverlay');
    const compassZOverlay = document.getElementById('compassZOverlay');
    
    // Afficher les overlays UNIQUEMENT en mode Navigation
    if (tabId === 'navigation') {
      if (compassOverlay) compassOverlay.style.display = '';
      if (compassZOverlay) compassZOverlay.style.display = '';
    } else {
      if (compassOverlay) compassOverlay.style.display = 'none';
      if (compassZOverlay) compassZOverlay.style.display = 'none';
    }
    
    // Gérer le mode scenario sur le canvas
    const canvas = window.EnderTrack?.Canvas?.getCanvas();
    if (canvas) {
      if (tabId === 'acquisition') {
        canvas.classList.add('scenario-mode');
      } else {
        canvas.classList.remove('scenario-mode');
      }
    }
    
    // Gérer click-and-go : activé uniquement sur Navigation
    if (window.EnderTrack?.Canvas) {
      if (tabId === 'navigation') {
        window.EnderTrack.Canvas.clickAndGoEnabled = true;
      } else {
        window.EnderTrack.Canvas.clickAndGoEnabled = false;
      }
    }
    
    // Activer/désactiver le module Overlays
    if (window.EnderTrack?.Templates) {
      if (tabId === 'overlays') {
        if (!window.EnderTrack.Overlays.isActive) {
          window.EnderTrack.Overlays.activate();
        }
      } else {
        if (window.EnderTrack.Overlays.isActive) {
          window.EnderTrack.Overlays.deactivate();
        }
      }
    }
    
    // Force canvas re-render
    if (window.EnderTrack?.Canvas?.requestRender) {
      window.EnderTrack.Canvas.requestRender();
    }
  }

  updateRightPanel(tabId) {
    const rightPanel = document.querySelector('.right-panel');
    if (!rightPanel) return;
    
    const graphsSection = rightPanel.querySelector('.graphs-section');
    const historySection = rightPanel.querySelector('.history-section');
    const scenarioOutput = document.getElementById('scenarioOutputSection');
    
    if (tabId === 'acquisition') {
      // Masquer historique et graphiques
      if (graphsSection) graphsSection.style.display = 'none';
      if (historySection) historySection.style.display = 'none';
      
      // Afficher section scénario
      if (window.ScenarioModule) {
        window.ScenarioModule.showScenarioOutput();
      }
    } else {
      // Afficher historique et graphiques
      if (graphsSection) graphsSection.style.display = 'block';
      if (historySection) historySection.style.display = 'block';
      
      // Masquer section scénario
      if (scenarioOutput) scenarioOutput.style.display = 'none';
    }
  }

  // Activate a specific tab
  activateTab(tabId) {
    const tab = this.getTab(tabId);
    if (!tab) {
      console.warn(`Tab not found: ${tabId}`);
      return false;
    }
    
    // Update tab button
    if (tab.element) {
      // Remove active class from all tabs
      this.getAllTabElements().forEach(el => el.classList.remove('active'));
      
      // Add active class to current tab
      tab.element.classList.add('active');
    }
    
    // Show tab content
    if (tab.content) {
      // Hide all tab content
      this.getAllTabContent().forEach(el => el.classList.remove('active'));
      
      // Show current tab content
      tab.content.classList.add('active');
    }
    
    // Mark as active
    tab.isActive = true;
    
    // Activate module if needed
    if (tab.module && window.EnderTrack?.[tab.module]) {
      const module = window.EnderTrack[tab.module];
      if (module.activate && !module.isActive) {
        module.activate();
      } else {
      }
    }
    
    // Load plugin if needed
    if (tab.type === 'plugin' && !tab.isLoaded) {
      this.loadPlugin(tabId);
    }
    
    return true;
  }

  // Deactivate current tab
  deactivateCurrentTab() {
    const currentTab = this.getTab(this.currentTab);
    if (currentTab) {
      if (currentTab.element) {
        currentTab.element.classList.remove('active');
      }
      if (currentTab.content) {
        currentTab.content.classList.remove('active');
      }
      currentTab.isActive = false;
    }
  }

  // Get tab by ID
  getTab(tabId) {
    return this.activeTabs.get(tabId) || this.pluginTabs.get(tabId);
  }

  // Get all tab elements
  getAllTabElements() {
    const elements = [];
    
    this.activeTabs.forEach(tab => {
      if (tab.element) elements.push(tab.element);
    });
    
    this.pluginTabs.forEach(tab => {
      if (tab.element) elements.push(tab.element);
    });
    
    return elements;
  }

  // Get all tab content elements
  getAllTabContent() {
    const elements = [];
    
    this.activeTabs.forEach(tab => {
      if (tab.content) elements.push(tab.content);
    });
    
    this.pluginTabs.forEach(tab => {
      if (tab.content) elements.push(tab.content);
    });
    
    return elements;
  }

  // Plugin management
  addPluginTab(pluginData) {
    const { id, displayName, icon } = pluginData;
    
    // Create tab button
    const tabButton = this.createTabButton(id, displayName, icon, 'plugin');
    
    // Create tab content
    const tabContent = this.createTabContent(id);
    
    // Add to plugin tabs
    this.pluginTabs.set(id, {
      id,
      name: displayName,
      icon,
      type: 'plugin',
      element: tabButton,
      content: tabContent,
      isActive: false,
      isLoaded: false,
      pluginData
    });
    
    // Insert into DOM
    this.insertPluginTab(tabButton, tabContent);
    
  }

  removePluginTab(pluginId) {
    const tab = this.pluginTabs.get(pluginId);
    if (!tab) return;
    
    // Remove from DOM
    if (tab.element) {
      tab.element.remove();
    }
    if (tab.content) {
      tab.content.remove();
    }
    
    // Remove from map
    this.pluginTabs.delete(pluginId);
    
    // Switch to navigation if this was active
    if (this.currentTab === pluginId) {
      this.switchTab('navigation');
    }
    
  }

  createTabButton(id, displayName, icon, type) {
    const button = document.createElement('button');
    button.id = `${id}Tab`;
    button.className = `toggle-btn ${type === 'plugin' ? 'plugin-tab' : ''}`; // Use toggle-btn class from new CSS
    button.innerHTML = `${icon} ${displayName}`;
    button.onclick = () => this.switchTab(id);
    
    return button;
  }

  createTabContent(id) {
    const content = document.createElement('div');
    content.id = `${id}TabContent`;
    content.className = 'tab-panel';
    
    return content;
  }

  insertPluginTab(tabButton, tabContent) {
    // Insert tab button in dynamic tabs container
    const dynamicContainer = document.getElementById('dynamicTabsContainer');
    if (dynamicContainer) {
      // Insert before the "Add" button
      const addButton = document.getElementById('addPluginTab');
      if (addButton) {
        dynamicContainer.insertBefore(tabButton, addButton);
      } else {
        dynamicContainer.appendChild(tabButton);
      }
    }
    
    // Insert tab content in tab content container
    const tabContentContainer = document.querySelector('.tab-content');
    if (tabContentContainer) {
      tabContentContainer.appendChild(tabContent);
    }
  }

  // Plugin event handlers
  onPluginLoaded(pluginData) {
    const tab = this.pluginTabs.get(pluginData.id);
    if (tab) {
      tab.isLoaded = true;
      tab.pluginData = pluginData;
    }
  }

  onPluginActivated(pluginData) {
    // Plugin is now available for use
    const tab = this.pluginTabs.get(pluginData.id);
    if (tab) {
      tab.element.style.display = 'block';
      tab.isLoaded = true;
    }
  }

  onPluginDeactivated(pluginData) {
    // Hide plugin tab but don't remove it
    const tab = this.pluginTabs.get(pluginData.id);
    if (tab) {
      tab.element.style.display = 'none';
      
      // Switch away if currently active
      if (this.currentTab === pluginData.id) {
        this.switchTab('navigation');
      }
    }
  }

  // Load plugin when tab is first accessed
  async loadPlugin(pluginId) {
    
    try {
      // This will be handled by the plugin manager
      if (window.EnderTrack.PluginManager) {
        await window.EnderTrack.PluginManager.activatePlugin(pluginId);
      }
    } catch (error) {
      console.error(`Failed to load plugin ${pluginId}:`, error);
      
      // Show error in tab content
      const tab = this.pluginTabs.get(pluginId);
      if (tab && tab.content) {
        tab.content.innerHTML = `
          <div class="plugin-error">
            <h4>❌ Erreur de Plugin</h4>
            <p>Impossible de charger le plugin "${pluginId}"</p>
            <p class="error-details">${error.message}</p>
          </div>
        `;
      }
    }
  }

  // Helper methods for plugin display
  getPluginDisplayName(pluginId) {
    const names = {
      'lists': 'Listes',
      'sequences': 'Sequences',
      'drivers': 'Drivers',
      'enderman': 'Enderman'
    };
    return names[pluginId] || pluginId;
  }

  getPluginIcon(pluginId) {
    const icons = {
      'lists': '📋',
      'sequences': '🔄',
      'drivers': '🔬',
      'enderman': '🤖'
    };
    return icons[pluginId] || '🔌';
  }

  // Tab state management
  getActiveTab() {
    return this.currentTab;
  }

  getAllTabs() {
    const allTabs = [];
    
    this.activeTabs.forEach(tab => allTabs.push(tab));
    this.pluginTabs.forEach(tab => allTabs.push(tab));
    
    return allTabs;
  }

  getVisibleTabs() {
    return this.getAllTabs().filter(tab => 
      tab.element && tab.element.style.display !== 'none'
    );
  }

  // Tab ordering
  reorderTabs(tabOrder) {
    // Reorder plugin tabs based on user preference
    const container = document.getElementById('dynamicTabsContainer');
    if (!container) return;
    
    // Clear container (except add button)
    const addButton = document.getElementById('addPluginTab');
    container.innerHTML = '';
    
    // Re-add tabs in specified order
    tabOrder.forEach(tabId => {
      const tab = this.pluginTabs.get(tabId);
      if (tab && tab.element) {
        container.appendChild(tab.element);
      }
    });
    
    // Re-add the add button
    if (addButton) {
      container.appendChild(addButton);
    }
  }

  // Export/Import tab configuration
  exportTabConfig() {
    const config = {
      activeTab: this.currentTab,
      pluginTabs: Array.from(this.pluginTabs.keys()),
      tabOrder: this.getVisibleTabs()
        .filter(tab => tab.type === 'plugin')
        .map(tab => tab.id)
    };
    
    return config;
  }

  importTabConfig(config) {
    if (config.tabOrder) {
      this.reorderTabs(config.tabOrder);
    }
    
    if (config.activeTab) {
      this.switchTab(config.activeTab);
    }
  }

  // Debug information
  getDebugInfo() {
    return {
      currentTab: this.currentTab,
      activeTabs: Array.from(this.activeTabs.keys()),
      pluginTabs: Array.from(this.pluginTabs.keys()),
      visibleTabs: this.getVisibleTabs().map(tab => tab.id),
      isInitialized: this.isInitialized
    };
  }
}

// Global instance
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.UI = window.EnderTrack.UI || {};
window.EnderTrack.UI.Tabs = new TabManager();

// Expose switchTab globally for HTML onclick handlers
// This will be overridden by the function in index.html
// modules/ui/panels.js - Panel management system

class PanelManager {
  constructor() {
    this.panels = new Map();
    this.isInitialized = false;
  }

  init() {
    
    // Initialize existing panels
    this.initializeExistingPanels();
    
    // Setup event listeners
    this.setupEventListeners();
    
    this.isInitialized = true;
    
    return true;
  }

  initializeExistingPanels() {
    // Register main application panels
    this.registerPanel('left-panel', {
      element: document.querySelector('.left-panel'),
      type: 'sidebar',
      resizable: false,
      collapsible: true,
      defaultWidth: 400
    });
    
    this.registerPanel('center-panel', {
      element: document.querySelector('.center-panel'),
      type: 'main',
      resizable: false,
      collapsible: false
    });
    
    this.registerPanel('right-panel', {
      element: document.querySelector('.right-panel'),
      type: 'sidebar',
      resizable: false,
      collapsible: true,
      defaultWidth: 300
    });
  }

  setupEventListeners() {
    // Listen to window resize
    window.addEventListener('resize', () => {
      this.handleWindowResize();
      // Also resize Z visualization
      if (EnderTrack.ZVisualization?.resize) {
        EnderTrack.ZVisualization.resize();
      }
    });
    
    // Listen to state changes
    EnderTrack.Events?.on?.('state:changed', (newState, oldState) => {
      this.handleStateChange(newState, oldState);
    });
  }

  registerPanel(id, config) {
    const {
      element,
      type = 'generic',
      resizable = false,
      collapsible = false,
      defaultWidth = null,
      defaultHeight = null,
      minWidth = 200,
      minHeight = 100,
      maxWidth = null,
      maxHeight = null
    } = config;

    if (!element) {
      console.warn(`Panel element not found for id: ${id}`);
      return null;
    }

    const panel = {
      id,
      element,
      type,
      resizable,
      collapsible,
      defaultWidth,
      defaultHeight,
      minWidth,
      minHeight,
      maxWidth,
      maxHeight,
      isCollapsed: false,
      currentWidth: defaultWidth,
      currentHeight: defaultHeight
    };

    // Setup panel features
    if (collapsible) {
      this.setupCollapsible(panel);
    }
    
    if (resizable) {
      this.setupResizable(panel);
    }

    this.panels.set(id, panel);
    return panel;
  }

  setupCollapsible(panel) {
    // Create collapse button
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'panel-collapse-btn';
    collapseBtn.innerHTML = panel.type === 'sidebar' ? '◀' : '▼';
    collapseBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(255,255,255,0.1);
      border: none;
      color: #666;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      z-index: 10;
    `;
    
    collapseBtn.addEventListener('mouseenter', () => {
      collapseBtn.style.background = 'rgba(255,255,255,0.2)';
    });
    
    collapseBtn.addEventListener('mouseleave', () => {
      collapseBtn.style.background = 'rgba(255,255,255,0.1)';
    });
    
    collapseBtn.addEventListener('click', () => {
      this.toggleCollapse(panel.id);
    });
    
    // Add button to panel
    panel.element.style.position = 'relative';
    panel.element.appendChild(collapseBtn);
    panel.collapseBtn = collapseBtn;
  }

  setupResizable(panel) {
    // Create resize handles
    const handles = [];
    
    if (panel.type === 'sidebar') {
      // Vertical resize handle
      const handle = this.createResizeHandle('vertical');
      panel.element.appendChild(handle);
      handles.push(handle);
      
      this.setupResizeHandle(handle, panel, 'width');
    }
    
    panel.resizeHandles = handles;
  }

  createResizeHandle(direction) {
    const handle = document.createElement('div');
    handle.className = `resize-handle resize-handle-${direction}`;
    
    const styles = {
      vertical: `
        position: absolute;
        top: 0;
        right: -2px;
        width: 4px;
        height: 100%;
        cursor: ew-resize;
        background: transparent;
        z-index: 10;
      `,
      horizontal: `
        position: absolute;
        bottom: -2px;
        left: 0;
        width: 100%;
        height: 4px;
        cursor: ns-resize;
        background: transparent;
        z-index: 10;
      `
    };
    
    handle.style.cssText = styles[direction];
    
    // Visual feedback on hover
    handle.addEventListener('mouseenter', () => {
      handle.style.background = 'rgba(59, 130, 246, 0.3)';
    });
    
    handle.addEventListener('mouseleave', () => {
      handle.style.background = 'transparent';
    });
    
    return handle;
  }

  setupResizeHandle(handle, panel, dimension) {
    let isResizing = false;
    let startPos = 0;
    let startSize = 0;
    
    const startResize = (e) => {
      isResizing = true;
      startPos = dimension === 'width' ? e.clientX : e.clientY;
      startSize = dimension === 'width' ? panel.element.offsetWidth : panel.element.offsetHeight;
      
      document.addEventListener('mousemove', doResize);
      document.addEventListener('mouseup', stopResize);
      
      // Prevent text selection during resize
      document.body.style.userSelect = 'none';
      
      e.preventDefault();
    };
    
    const doResize = (e) => {
      if (!isResizing) return;
      
      const currentPos = dimension === 'width' ? e.clientX : e.clientY;
      const delta = currentPos - startPos;
      const newSize = startSize + delta;
      
      // Apply constraints
      const minSize = dimension === 'width' ? panel.minWidth : panel.minHeight;
      const maxSize = dimension === 'width' ? panel.maxWidth : panel.maxHeight;
      
      let clampedSize = Math.max(newSize, minSize);
      if (maxSize) {
        clampedSize = Math.min(clampedSize, maxSize);
      }
      
      // Apply new size
      if (dimension === 'width') {
        panel.element.style.width = `${clampedSize}px`;
        panel.currentWidth = clampedSize;
      } else {
        panel.element.style.height = `${clampedSize}px`;
        panel.currentHeight = clampedSize;
      }
      
      // Emit resize event
      EnderTrack.Events?.emit?.('panel:resized', {
        panelId: panel.id,
        dimension,
        size: clampedSize
      });
    };
    
    const stopResize = () => {
      isResizing = false;
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
      document.body.style.userSelect = '';
    };
    
    handle.addEventListener('mousedown', startResize);
  }

  toggleCollapse(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel || !panel.collapsible) return;
    
    if (panel.isCollapsed) {
      this.expandPanel(panelId);
    } else {
      this.collapsePanel(panelId);
    }
  }

  collapsePanel(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel || !panel.collapsible || panel.isCollapsed) return;
    
    // Store current size
    panel.preCollapseWidth = panel.element.offsetWidth;
    panel.preCollapseHeight = panel.element.offsetHeight;
    
    // Animate collapse
    panel.element.style.transition = 'all 0.3s ease';
    
    if (panel.type === 'sidebar') {
      panel.element.style.width = '40px';
      panel.element.style.overflow = 'hidden';
    } else {
      panel.element.style.height = '40px';
      panel.element.style.overflow = 'hidden';
    }
    
    // Update collapse button
    if (panel.collapseBtn) {
      panel.collapseBtn.innerHTML = panel.type === 'sidebar' ? '▶' : '▲';
    }
    
    panel.isCollapsed = true;
    
    // Emit event
    EnderTrack.Events?.emit?.('panel:collapsed', { panelId });
    
    // Remove transition after animation
    setTimeout(() => {
      panel.element.style.transition = '';
    }, 300);
  }

  expandPanel(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel || !panel.collapsible || !panel.isCollapsed) return;
    
    // Animate expand
    panel.element.style.transition = 'all 0.3s ease';
    
    if (panel.type === 'sidebar') {
      panel.element.style.width = `${panel.preCollapseWidth || panel.defaultWidth}px`;
    } else {
      panel.element.style.height = `${panel.preCollapseHeight || panel.defaultHeight}px`;
    }
    
    panel.element.style.overflow = '';
    
    // Update collapse button
    if (panel.collapseBtn) {
      panel.collapseBtn.innerHTML = panel.type === 'sidebar' ? '◀' : '▼';
    }
    
    panel.isCollapsed = false;
    
    // Emit event
    EnderTrack.Events?.emit?.('panel:expanded', { panelId });
    
    // Remove transition after animation
    setTimeout(() => {
      panel.element.style.transition = '';
    }, 300);
  }

  showPanel(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel) return;
    
    panel.element.style.display = 'block';
    
    EnderTrack.Events?.emit?.('panel:shown', { panelId });
  }

  hidePanel(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel) return;
    
    panel.element.style.display = 'none';
    
    EnderTrack.Events?.emit?.('panel:hidden', { panelId });
  }

  resizePanel(panelId, width, height) {
    const panel = this.panels.get(panelId);
    if (!panel) return;
    
    if (width !== null && width !== undefined) {
      const clampedWidth = Math.max(width, panel.minWidth);
      panel.element.style.width = `${clampedWidth}px`;
      panel.currentWidth = clampedWidth;
    }
    
    if (height !== null && height !== undefined) {
      const clampedHeight = Math.max(height, panel.minHeight);
      panel.element.style.height = `${clampedHeight}px`;
      panel.currentHeight = clampedHeight;
    }
    
    EnderTrack.Events?.emit?.('panel:resized', {
      panelId,
      width: panel.currentWidth,
      height: panel.currentHeight
    });
  }

  // Dynamic panel creation
  createPanel(id, config) {
    const {
      parent,
      title = '',
      content = '',
      className = '',
      width = 300,
      height = 200,
      resizable = true,
      collapsible = true,
      closable = false
    } = config;

    // Create panel element
    const panel = document.createElement('div');
    panel.id = id;
    panel.className = `dynamic-panel ${className}`;
    panel.style.cssText = `
      position: absolute;
      width: ${width}px;
      height: ${height}px;
      background: white;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      z-index: 1000;
    `;

    // Create header
    if (title || closable) {
      const header = document.createElement('div');
      header.className = 'panel-header';
      header.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid #e5e7eb;
        background: #f9fafb;
        border-radius: 8px 8px 0 0;
        cursor: move;
      `;

      if (title) {
        const titleEl = document.createElement('h4');
        titleEl.textContent = title;
        titleEl.style.cssText = `
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #111827;
        `;
        header.appendChild(titleEl);
      }

      if (closable) {
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #6b7280;
          padding: 0;
          width: 20px;
          height: 20px;
        `;
        
        closeBtn.addEventListener('click', () => {
          this.removePanel(id);
        });
        
        header.appendChild(closeBtn);
      }

      panel.appendChild(header);
      
      // Make draggable
      this.makeDraggable(panel, header);
    }

    // Create content area
    const contentEl = document.createElement('div');
    contentEl.className = 'panel-content';
    contentEl.style.cssText = `
      padding: 16px;
      height: calc(100% - ${title || closable ? '49px' : '0px'});
      overflow: auto;
    `;

    if (typeof content === 'string') {
      contentEl.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      contentEl.appendChild(content);
    }

    panel.appendChild(contentEl);

    // Add to parent
    const parentEl = typeof parent === 'string' ? document.getElementById(parent) : parent;
    if (parentEl) {
      parentEl.appendChild(panel);
    } else {
      document.body.appendChild(panel);
    }

    // Register panel
    this.registerPanel(id, {
      element: panel,
      type: 'dynamic',
      resizable,
      collapsible,
      defaultWidth: width,
      defaultHeight: height
    });

    return panel;
  }

  makeDraggable(panel, handle) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const startDrag = (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(panel.style.left) || 0;
      startTop = parseInt(panel.style.top) || 0;

      document.addEventListener('mousemove', doDrag);
      document.addEventListener('mouseup', stopDrag);
      
      panel.style.zIndex = this.getTopZIndex() + 1;
      
      e.preventDefault();
    };

    const doDrag = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      panel.style.left = `${startLeft + deltaX}px`;
      panel.style.top = `${startTop + deltaY}px`;
    };

    const stopDrag = () => {
      isDragging = false;
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
    };

    handle.addEventListener('mousedown', startDrag);
  }

  removePanel(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel) return;

    // Remove from DOM
    if (panel.element.parentNode) {
      panel.element.parentNode.removeChild(panel.element);
    }

    // Remove from registry
    this.panels.delete(panelId);

    EnderTrack.Events?.emit?.('panel:removed', { panelId });
  }

  // Event handlers
  handleWindowResize() {
    // Adjust panels on window resize
    this.panels.forEach((panel, id) => {
      if (panel.type === 'dynamic') {
        // Ensure dynamic panels stay within viewport
        this.constrainToViewport(panel);
      }
    });
  }

  handleStateChange(newState, oldState) {
    // React to state changes that affect panels
    // This could be used to show/hide panels based on modes
  }

  // Utility methods
  constrainToViewport(panel) {
    const rect = panel.element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = parseInt(panel.element.style.left) || 0;
    let top = parseInt(panel.element.style.top) || 0;

    // Constrain to viewport
    if (left + rect.width > viewportWidth) {
      left = viewportWidth - rect.width;
    }
    if (left < 0) left = 0;

    if (top + rect.height > viewportHeight) {
      top = viewportHeight - rect.height;
    }
    if (top < 0) top = 0;

    panel.element.style.left = `${left}px`;
    panel.element.style.top = `${top}px`;
  }

  getTopZIndex() {
    let maxZ = 1000;
    this.panels.forEach(panel => {
      const z = parseInt(panel.element.style.zIndex) || 0;
      if (z > maxZ) maxZ = z;
    });
    return maxZ;
  }

  // Panel state management
  getPanelState() {
    const state = {};
    
    this.panels.forEach((panel, id) => {
      state[id] = {
        isCollapsed: panel.isCollapsed,
        currentWidth: panel.currentWidth,
        currentHeight: panel.currentHeight,
        position: {
          left: parseInt(panel.element.style.left) || 0,
          top: parseInt(panel.element.style.top) || 0
        }
      };
    });
    
    return state;
  }

  restorePanelState(state) {
    Object.entries(state).forEach(([panelId, panelState]) => {
      const panel = this.panels.get(panelId);
      if (!panel) return;

      // Restore size
      if (panelState.currentWidth) {
        this.resizePanel(panelId, panelState.currentWidth, null);
      }
      if (panelState.currentHeight) {
        this.resizePanel(panelId, null, panelState.currentHeight);
      }

      // Restore position
      if (panelState.position) {
        panel.element.style.left = `${panelState.position.left}px`;
        panel.element.style.top = `${panelState.position.top}px`;
      }

      // Restore collapse state
      if (panelState.isCollapsed && !panel.isCollapsed) {
        this.collapsePanel(panelId);
      } else if (!panelState.isCollapsed && panel.isCollapsed) {
        this.expandPanel(panelId);
      }
    });
  }

  // Debug information
  getDebugInfo() {
    return {
      isInitialized: this.isInitialized,
      panelCount: this.panels.size,
      panels: Array.from(this.panels.keys()),
      panelStates: this.getPanelState()
    };
  }
}

// Global instance
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.UI = window.EnderTrack.UI || {};
window.EnderTrack.UI.Panels = new PanelManager();
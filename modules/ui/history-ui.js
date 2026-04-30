// modules/ui/history-ui.js - History UI management
// Handles all history-related UI updates

class HistoryUI {
  constructor() {
    this.isInitialized = false;
  }

  init() {

    // Load saved preferences
    this.loadHistoryPreferences();
    
    // Listen to state changes
    EnderTrack.Events?.on?.('state:changed', (newState, oldState) => {
      this.updateHistoryUI(newState);
    });
    
    this.isInitialized = true;

    
    return true;
  }

  updateHistoryUI(state) {
    // Update live displays
    this.updateLiveDisplays(state);
    
    // Update history navigation
    this.updateHistoryNavigation(state);
    
    // Update history table
    this.updateHistoryTable(state.positionHistory);
    
    // Update mini graphs
    this.updateMiniGraphs(state.positionHistory);
    
    // Update navigation controls state
    this.updateNavigationControlsState(state);
  }

  updateLiveDisplays(state) {
    // Protection contre state.pos undefined
    if (!state.pos || state.pos.x === undefined || state.pos.y === undefined || state.pos.z === undefined) {
      return;
    }
    
    // Update position display
    const posLabel = document.getElementById('posLabel');
    if (posLabel) {
      posLabel.textContent = `X:${state.pos.x.toFixed(2)} Y:${state.pos.y.toFixed(2)} Z:${state.pos.z.toFixed(2)}`;
    }
    
    // Update platform info
    const platformSize = document.getElementById('platformSize');
    if (platformSize) {
      const dimensions = state.plateauDimensions || { x: 200, y: 200, z: 100 };
      platformSize.textContent = `${dimensions.x}×${dimensions.y}×${dimensions.z}mm`;
    }
    
    // Update zoom level
    const zoomLevel = document.getElementById('zoomLevel');
    if (zoomLevel) {
      const zoom = state.zoom || 1;
      zoomLevel.textContent = `${zoom.toFixed(1)}x`;
    }
    
    // Update status widget positions
    const statusPosX = document.getElementById('statusPosX');
    const statusPosY = document.getElementById('statusPosY');
    const statusPosZ = document.getElementById('statusPosZ');
    
    const px = state.pos?.x, py = state.pos?.y, pz = state.pos?.z;
    // debug log disabled
    if (statusPosX && px !== undefined) statusPosX.textContent = Number(px).toFixed(2);
    if (statusPosY && py !== undefined) statusPosY.textContent = Number(py).toFixed(2);
    if (statusPosZ && pz !== undefined) statusPosZ.textContent = Number(pz).toFixed(2);
    
    // Update get button states when position changes
    if (window.updateGetButtonStates) {
      window.updateGetButtonStates();
    }
  }

  updateHistoryTable(history) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    
    const state = EnderTrack.State.get();
    const currentHistory = state.historyViewMode === 'XY' ? 
                         state.positionHistoryXY.filter(p => p.isFinalPosition) :
                         state.positionHistory.filter(p => p.isFinalPosition);
    
    // Show last 10 positions from current history
    const recentHistory = currentHistory.slice(-10);
    
    // Gray out table in history mode
    const table = tbody.closest('table');
    if (table) {
      table.style.opacity = state.historyMode ? '1' : '0.6';
      table.style.pointerEvents = state.historyMode ? 'auto' : 'none';
    }
    
    // Update table header based on mode
    const thead = table.querySelector('thead');
    if (thead) {
      if (state.historyViewMode === 'XY') {
        thead.innerHTML = `
          <tr>
            <th>Time</th>
            <th>ID</th>
            <th>X</th>
            <th>Y</th>
          </tr>
        `;
      } else {
        thead.innerHTML = `
          <tr>
            <th>Time</th>
            <th>ID</th>
            <th>X</th>
            <th>Y</th>
            <th>Z</th>
          </tr>
        `;
      }
    }
    
    // Generate numbering for XYZ mode
    const allVisited = state.positionHistory.filter(pos => pos.isFinalPosition);
    const xyGroups = new Map();
    
    allVisited.forEach((pos, allIndex) => {
      const xyKey = `${pos.x.toFixed(2)},${pos.y.toFixed(2)}`;
      if (!xyGroups.has(xyKey)) {
        xyGroups.set(xyKey, []);
      }
      xyGroups.get(xyKey).push({ pos, allIndex });
    });
    
    tbody.innerHTML = recentHistory.map((entry, index) => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const globalIndex = currentHistory.length - recentHistory.length + index;
      const isCurrentlyExplored = state.historyIndex === globalIndex;
      const isLivePosition = state.historyIndex === -1 && index === recentHistory.length - 1 && !state.historyMode;
      
      const bgColor = (isCurrentlyExplored || isLivePosition) ? 'background: rgba(79, 158, 255, 0.5) !important;' : '';
      const cursor = state.historyMode ? 'cursor: pointer;' : 'cursor: default;';
      const onclick = state.historyMode ? `onclick="EnderTrack.State.goToHistoryPosition(${globalIndex})"` : '';
      
      // Generate display number based on mode
      let displayNumber;
      if (state.historyViewMode === 'XY') {
        displayNumber = globalIndex + 1;
      } else {
        // XYZ mode: find sub-numbering
        const xyKey = `${entry.x.toFixed(2)},${entry.y.toFixed(2)}`;
        const group = xyGroups.get(xyKey) || [];
        
        if (group.length > 1) {
          const subIndex = group.findIndex(item => 
            Math.abs(item.pos.x - entry.x) < 0.01 && 
            Math.abs(item.pos.y - entry.y) < 0.01 && 
            Math.abs(item.pos.z - entry.z) < 0.01
          );
          
          let xyGroupIndex = 1;
          for (const [key, grp] of xyGroups) {
            if (key === xyKey) break;
            xyGroupIndex++;
          }
          
          displayNumber = `${xyGroupIndex}-${subIndex + 1}`;
        } else {
          let xyGroupIndex = 1;
          for (const [key, grp] of xyGroups) {
            if (key === xyKey) break;
            xyGroupIndex++;
          }
          displayNumber = xyGroupIndex;
        }
      }
      
      if (state.historyViewMode === 'XY') {
        return `
          <tr style="${bgColor} ${cursor}" ${onclick}>
            <td>${time}</td>
            <td>${displayNumber}</td>
            <td>${entry.x.toFixed(2)}</td>
            <td>${entry.y.toFixed(2)}</td>
          </tr>
        `;
      } else {
        return `
          <tr style="${bgColor} ${cursor}" ${onclick}>
            <td>${time}</td>
            <td>${displayNumber}</td>
            <td>${entry.x.toFixed(2)}</td>
            <td>${entry.y.toFixed(2)}</td>
            <td>${entry.z.toFixed(2)}</td>
          </tr>
        `;
      }
    }).join('');
  }

  updateMiniGraphs(history) {
    if (history.length < 2) return;
    
    const canvases = {
      x: document.getElementById('gX'),
      y: document.getElementById('gY'),
      z: document.getElementById('gZ')
    };
    
    Object.entries(canvases).forEach(([axis, canvas]) => {
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Get recent data (last 50 points)
      const recentData = history.slice(-50);
      if (recentData.length < 2) return;
      
      // Find min/max for scaling
      const values = recentData.map(p => p[axis]);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 1;
      
      // Draw line with axis-specific color
      const colors = { x: '#ff4444', y: '#44ff44', z: '#4444ff' };
      ctx.strokeStyle = colors[axis] || '#0b84ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      recentData.forEach((point, i) => {
        const x = (i / (recentData.length - 1)) * width;
        const y = height - ((point[axis] - min) / range) * height;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    });
  }

  updateHistoryNavigation(state) {
    // Create navigation controls if they don't exist
    let navContainer = document.getElementById('historyNavigation');
    if (!navContainer) {
      const historySection = document.querySelector('.history-section');
      if (historySection) {
        navContainer = document.createElement('div');
        navContainer.id = 'historyNavigation';
        navContainer.style.cssText = `
          display: block;
          margin-top: 8px;
          padding: 12px 8px;
          border-top: 1px solid #333;
          background: rgba(0,0,0,0.2);
          border-radius: 4px;
        `;
        
        navContainer.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
            <div style="display: flex; gap: 4px; margin-bottom: 8px; background: #2c2c2c; padding: 4px; border-radius: 6px;">
              <button id="historyModeBtn" style="
                flex: 1;
                padding: 8px 16px;
                border: none;
                background: transparent;
                color: #aaa;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s ease;
              ">ACTIVATE HISTORY</button>
            </div>
            <div style="display: flex; gap: 4px; margin-bottom: 8px; background: #2c2c2c; padding: 4px; border-radius: 6px;">
              <button id="historyViewModeXY" style="
                flex: 1;
                padding: 8px 16px;
                border: none;
                background: transparent;
                color: #aaa;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s ease;
              ">XY</button>
              <button id="historyViewModeXYZ" style="
                flex: 1;
                padding: 8px 16px;
                border: none;
                background: transparent;
                color: #aaa;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s ease;
              ">XYZ</button>
            </div>
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
              <button id="historyPrevBtn" style="
                background: #444;
                border: 1px solid #666;
                color: #fff;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                font-weight: bold;
              ">◀ PREV</button>
              <span id="historyIndicator" style="
                font-size: 12px;
                color: #fff;
                background: #333;
                padding: 4px 8px;
                border-radius: 4px;
                min-width: 80px;
                text-align: center;
                font-weight: bold;
              ">0/0</span>
              <button id="historyNextBtn" style="
                background: #444;
                border: 1px solid #666;
                color: #fff;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                font-weight: bold;
              ">NEXT ▶</button>
            </div>
          </div>
        `;
        
        historySection.appendChild(navContainer);
        
        // Add event listeners
        document.getElementById('historyViewModeXY').addEventListener('click', () => {
          if (state.historyViewMode !== 'XY') {
            EnderTrack.State.toggleHistoryViewMode();
            this.saveHistoryPreferences();
          }
        });
        
        document.getElementById('historyViewModeXYZ').addEventListener('click', () => {
          if (state.historyViewMode !== 'XYZ') {
            EnderTrack.State.toggleHistoryViewMode();
            this.saveHistoryPreferences();
          }
        });
        
        document.getElementById('historyModeBtn').addEventListener('click', () => {
          if (window.deactivateControllerMode) {
            window.deactivateControllerMode();
          }
          EnderTrack.State.toggleHistoryMode();
          this.saveHistoryPreferences();
        });
        
        document.getElementById('historyPrevBtn').addEventListener('click', () => {
          EnderTrack.State.goToPreviousPosition();
        });
        
        document.getElementById('historyNextBtn').addEventListener('click', () => {
          EnderTrack.State.goToNextPosition();
        });
      }
    }
    
    const viewModeBtnXY = document.getElementById('historyViewModeXY');
    const viewModeBtnXYZ = document.getElementById('historyViewModeXYZ');
    const modeBtn = document.getElementById('historyModeBtn');
    const prevBtn = document.getElementById('historyPrevBtn');
    const nextBtn = document.getElementById('historyNextBtn');
    const indicator = document.getElementById('historyIndicator');
    
    const currentHistory = state.historyViewMode === 'XY' ? 
                         state.positionHistoryXY.filter(p => p.isFinalPosition) :
                         state.positionHistory.filter(p => p.isFinalPosition);
    const totalPositions = currentHistory.length;
    
    if (viewModeBtnXY && viewModeBtnXYZ && modeBtn && prevBtn && nextBtn && indicator) {
      // Update view mode buttons
      if (state.historyViewMode === 'XY') {
        viewModeBtnXY.style.background = '#4a5568';
        viewModeBtnXY.style.color = '#fff';
        viewModeBtnXYZ.style.background = 'transparent';
        viewModeBtnXYZ.style.color = '#aaa';
      } else {
        viewModeBtnXY.style.background = 'transparent';
        viewModeBtnXY.style.color = '#aaa';
        viewModeBtnXYZ.style.background = '#4a5568';
        viewModeBtnXYZ.style.color = '#fff';
      }
      
      // Update mode button
      if (state.historyMode) {
        modeBtn.style.background = '#4a5568';
        modeBtn.style.color = '#fff';
        modeBtn.title = 'History mode ON (frozen) - Click to return to live mode';
      } else {
        modeBtn.style.background = 'transparent';
        modeBtn.style.color = '#aaa';
        modeBtn.title = 'Live mode - Click to enter HISTORY mode';
      }
      
      // Show/hide navigation buttons and view mode buttons based on mode
      const viewModeContainer = viewModeBtnXY.parentElement;
      viewModeContainer.style.display = state.historyMode ? 'flex' : 'none';
      prevBtn.style.display = state.historyMode ? 'inline-block' : 'none';
      nextBtn.style.display = state.historyMode ? 'inline-block' : 'none';
      indicator.style.display = state.historyMode ? 'inline-block' : 'none';
      
      if (state.historyMode) {
        // Update navigation buttons
        const canNavigate = totalPositions > 0;
        prevBtn.disabled = !canNavigate || state.historyIndex <= 0;
        nextBtn.disabled = !canNavigate || state.historyIndex >= totalPositions - 1;
        
        // Update button styles based on state
        prevBtn.style.opacity = prevBtn.disabled ? '0.3' : '1';
        nextBtn.style.opacity = nextBtn.disabled ? '0.3' : '1';
      }
      
      // Update indicator
      if (totalPositions === 0) {
        indicator.textContent = '0/0';
      } else if (state.historyMode) {
        indicator.textContent = `${state.historyIndex + 1}/${totalPositions}`;
      } else {
        indicator.textContent = `${totalPositions}/${totalPositions} (live)`;
      }
    }
  }

  updateNavigationControlsState(state) {
    const leftPanel = document.querySelector('.left-panel');
    if (leftPanel) {
      leftPanel.style.opacity = state.historyMode ? '0.5' : '1';
      leftPanel.style.pointerEvents = state.historyMode ? 'none' : 'auto';
    }
    
    // Keep Z visualization panel interactive in history mode
    const zPanel = document.querySelector('.z-visualization-panel');
    if (zPanel && state.historyMode) {
      zPanel.style.pointerEvents = 'auto';
      zPanel.style.opacity = '1';
    }
  }

  saveHistoryPreferences() {
    const state = EnderTrack.State.get();
    const prefs = {
      historyMode: state.historyMode,
      historyViewMode: state.historyViewMode
    };
    localStorage.setItem('endertrack_history_preferences', JSON.stringify(prefs));
  }

  loadHistoryPreferences() {
    const saved = localStorage.getItem('endertrack_history_preferences');
    if (saved) {
      try {
        const prefs = JSON.parse(saved);
        if (prefs.historyMode !== undefined) {
          EnderTrack.State.update({ historyMode: prefs.historyMode });
        }
        if (prefs.historyViewMode !== undefined) {
          EnderTrack.State.update({ historyViewMode: prefs.historyViewMode });
        }
      } catch (e) {
        console.warn('Failed to load history preferences');
      }
    }
  }
}

// Global instance
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.UI = window.EnderTrack.UI || {};
window.EnderTrack.UI.History = new HistoryUI();
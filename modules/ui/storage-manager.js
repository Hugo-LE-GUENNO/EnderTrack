// modules/ui/storage-manager.js - Gestion centralisée du localStorage

class StorageManager {
  constructor() {
    this.storageKeys = {
      // Configuration
      'endertrack_state': { label: 'App state', category: 'config', default: false },
      'endertrack_plateau_dimensions': { label: 'Dimensions plateau', category: 'config', default: false },
      'endertrack_coordinate_bounds': { label: 'Coordinate ranges', category: 'config', default: false },
      'endertrack_axis_orientation': { label: 'Orientation axes', category: 'config', default: false },
      'endertrack_safety_limits': { label: 'Safety limits', category: 'config', default: false },
      
      // History
      'showPositionXYHistory': { label: 'Affichage positions XY', category: 'history', default: false },
      'showPositionZHistory': { label: 'Affichage positions Z', category: 'history', default: false },
      'showTrackPositions': { label: 'Affichage track positions', category: 'history', default: false },
      'showTrackFree': { label: 'Affichage track continu', category: 'history', default: false },
      'endertrack_history': { label: 'History positions', category: 'history', default: false },
      'endertrack_track': { label: 'Saved track', category: 'history', default: false },
      
      // Strategic positions
      'endertrack_strategic_positions': { label: 'Strategic positions', category: 'positions', default: false },
      
      // Lists
      'endertrack_lists': { label: 'Saved lists', category: 'lists', default: false },
      'endertrack_list_settings': { label: 'Parameters listes', category: 'lists', default: false },
      
      // Theme et UI
      'endertrack_theme': { label: 'Theme visuel', category: 'ui', default: false },
      'endertrack_custom_colors': { label: 'Custom colors', category: 'ui', default: false },
      'endertrack_ui_settings': { label: 'Parameters interface', category: 'ui', default: false },
      'endertrack_display_settings': { label: 'Parameters affichage', category: 'ui', default: false }
    };
  }

  // Save tout le localStorage
  saveAll() {
    const data = {};
    
    // Save TOUT le localStorage, pas seulement les clés sets
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      if (value !== null) {
        data[key] = value;
      }
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `endertrack_config_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    if (window.EnderTrack?.UI?.showSuccess) {
      window.EnderTrack.UI.showSuccess('Full configuration exported');
    }
  }

  // Load depuis un fichier
  loadFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          
          Object.entries(data).forEach(([key, value]) => {
            localStorage.setItem(key, value);
          });
          
          if (window.EnderTrack?.UI?.showSuccess) {
            window.EnderTrack.UI.showSuccess('Configuration loaded successfully');
          }
          
          setTimeout(() => location.reload(), 1000);
        } catch (error) {
          if (window.EnderTrack?.UI?.showError) {
            window.EnderTrack.UI.showError('Error lors du chargement du fichier');
          }
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  }

  // Reset tout
  resetAll() {
    if (confirm('Reset ALL data? This action is irreversible.')) {
      localStorage.clear();
      if (window.EnderTrack?.UI?.showSuccess) {
        window.EnderTrack.UI.showSuccess('Data reset');
      }
      setTimeout(() => location.reload(), 1000);
    }
  }

  // Décocher toutes les checkboxes
  resetToNoStorage() {
    const checkboxes = document.querySelectorAll('#storageCustomizationModal input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
  }

  // Cocher toutes les checkboxes
  resetToFullStorage() {
    const checkboxes = document.querySelectorAll('#storageCustomizationModal input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
  }

  // Obtenir la taille du localStorage
  getStorageSize() {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length;
      }
    }
    return (total / 1024).toFixed(2); // KB
  }

  // Obtenir les statistiques
  getStats() {
    const stats = {
      totalKeys: 0,
      size: this.getStorageSize(),
      categories: {}
    };
    
    Object.entries(this.storageKeys).forEach(([key, config]) => {
      if (localStorage.getItem(key) !== null) {
        stats.totalKeys++;
        if (!stats.categories[config.category]) {
          stats.categories[config.category] = 0;
        }
        stats.categories[config.category]++;
      }
    });
    
    return stats;
  }

  // Open le modal de personnalisation
  openCustomizationModal() {
    const modal = document.getElementById('storageCustomizationModal');
    if (modal) {
      this.renderCustomizationOptions();
      modal.style.display = 'block';
    }
  }

  // Close le modal
  closeCustomizationModal() {
    const modal = document.getElementById('storageCustomizationModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // Rendre les options de personnalisation
  renderCustomizationOptions() {
    const container = document.getElementById('storageOptionsContainer');
    if (!container) return;
    
    const categories = {
      config: '⚙️ Configuration',
      history: '📈 History',
      positions: '📍 Positions',
      lists: '📋 Lists',
      ui: '🎨 Interface'
    };
    
    let html = '';
    
    Object.entries(categories).forEach(([catKey, catLabel]) => {
      const items = Object.entries(this.storageKeys)
        .filter(([_, config]) => config.category === catKey);
      
      if (items.length > 0) {
        html += `
          <div class="storage-category">
            <h4>${catLabel}</h4>
            <div class="storage-items">
        `;
        
        items.forEach(([key, config]) => {
          const enableKey = `${key}_enabled`;
          const checked = localStorage.getItem(enableKey) === 'true' ? 'checked' : '';
          html += `
            <label class="checkbox-label">
              <input type="checkbox" ${checked} data-storage-key="${key}" class="simple-checkbox">
              <span>${config.label}</span>
            </label>
          `;
        });
        
        html += `
            </div>
          </div>
        `;
      }
    });
    
    container.innerHTML = html;
  }

  // Apply les changements de personnalisation
  applyCustomization() {
    const checkboxes = document.querySelectorAll('[data-storage-key]');
    
    checkboxes.forEach(checkbox => {
      const key = checkbox.dataset.storageKey;
      const enableKey = `${key}_enabled`;
      
      if (checkbox.checked) {
        localStorage.setItem(enableKey, 'true');
      } else {
        localStorage.removeItem(enableKey);
        // Delete aussi les données si désactivated
        localStorage.removeItem(key);
      }
    });
    
    if (window.EnderTrack?.UI?.showSuccess) {
      window.EnderTrack.UI.showSuccess('Customization applied');
    }
    
    this.closeCustomizationModal();
  }
}

// Instance globale
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.StorageManager = new StorageManager();

// Fonctions globales
window.openStorageCustomization = () => window.EnderTrack.StorageManager.openCustomizationModal();
window.closeStorageCustomization = () => window.EnderTrack.StorageManager.closeCustomizationModal();
window.applyStorageCustomization = () => window.EnderTrack.StorageManager.applyCustomization();
window.saveAllStorage = () => window.EnderTrack.StorageManager.saveAll();
window.loadStorageFromFile = () => window.EnderTrack.StorageManager.loadFromFile();
window.resetAllStorage = () => window.EnderTrack.StorageManager.resetAll();

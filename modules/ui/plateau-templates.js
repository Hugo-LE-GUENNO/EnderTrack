// modules/ui/plateau-templates.js - Gestion des profils de plateau

class PlateauTemplates {
  constructor() {
    this.templates = [];
    this.currentFilter = 'all';
  }

  async init() {
    await this.loadTemplates();
    await this.loadManualProfile();
    return true;
  }

  async loadManualProfile() {
    // Load manual profile from localStorage if it exists
    const savedProfile = localStorage.getItem('endertrack_manual_profile');
    if (savedProfile) {
      try {
        const manualProfile = JSON.parse(savedProfile);
        // Add to templates list if not already present
        const existingIndex = this.templates.findIndex(t => t.id === 'manual_profile');
        if (existingIndex >= 0) {
          this.templates[existingIndex] = manualProfile;
        } else {
          this.templates.unshift(manualProfile); // Add at beginning
        }
      } catch (e) {
        console.warn('Failed to load manual profile:', e);
      }
    }
  }

  async loadTemplates() {
    this.templates = [];
    
    // Charger les profils principaux
    if (window.ProfilesData?.main) {
      this.templates = [...window.ProfilesData.main];
      // console.log(`✅ Main profiles loaded: ${window.ProfilesData.main.length}`);
    }
    
    // Charger les profils Enderscope
    if (window.ProfilesData?.enderscope) {
      this.templates = [...this.templates, ...window.ProfilesData.enderscope];
      // console.log(`✅ Enderscope profiles loaded: ${window.ProfilesData.enderscope.length}`);
    }
    
    // Scanner automatiquement les profils custom (ProfileCustom1, ProfileCustom2, etc.)
    let customIndex = 1;
    while (window[`ProfileCustom${customIndex}`]) {
      const customProfiles = window[`ProfileCustom${customIndex}`];
      const categoryName = `Custom${customIndex}`;
      
      // Ajouter la catégorie custom à chaque profil
      customProfiles.forEach(profile => {
        profile.customCategory = categoryName;
      });
      
      this.templates = [...this.templates, ...customProfiles];
      // console.log(`✅ Custom profiles loaded from ProfileCustom${customIndex}: ${customProfiles.length}`);
      customIndex++;
    }
    
    // Fallback si aucun profil
    if (this.templates.length === 0) {
      this.templates = [
        {
          "id": "default_stage",
          "name": "Stage par défaut",
          "brand": "Generic",
          "dimensions": { "x": 200, "y": 200, "z": 100 },
          "coordinateBounds": {
            "x": { "min": -100, "max": 100 },
            "y": { "min": -100, "max": 100 },
            "z": { "min": 0, "max": 100 }
          },
          "axisOrientation": { "x": "right", "y": "up", "z": "up" },
          "description": "Configuration par défaut",
          "gcode": true
        }
      ];
    }
  }

  openModal() {
    const modal = document.getElementById('templateModal');
    if (modal) {
      modal.style.display = 'flex';
      this.resetModal();
    }
  }

  closeModal() {
    const modal = document.getElementById('templateModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  resetModal() {
    document.getElementById('templateSearch').value = '';
    document.getElementById('templateSearch').style.display = 'block';
    document.getElementById('templateList').style.display = 'block';
    document.getElementById('templateCard').style.display = 'none';
    this.showProfileList();
  }

  showProfileList() {
    const listContainer = document.getElementById('templateList');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    
    // Group by brand
    const brands = {};
    this.templates.forEach(template => {
      const brandKey = template.customCategory || template.brand;
      if (!brands[brandKey]) {
        brands[brandKey] = [];
      }
      brands[brandKey].push(template);
    });
    
    // Add profiles by brand with spacing
    Object.keys(brands).forEach((brand, index) => {
      if (index > 0) {
        const spacer = document.createElement('div');
        spacer.style.height = '12px';
        listContainer.appendChild(spacer);
      }
      
      const brandHeader = document.createElement('div');
      brandHeader.className = 'brand-header';
      brandHeader.textContent = brand;
      listContainer.appendChild(brandHeader);
      
      brands[brand].forEach(template => {
        const item = document.createElement('div');
        item.className = 'profile-item';
        item.innerHTML = `
          <div class="profile-name">${template.name}</div>
          <div class="profile-dimensions">${template.dimensions.x}×${template.dimensions.y}×${template.dimensions.z}mm</div>
        `;
        item.onclick = () => this.showTemplateCard(template.id);
        listContainer.appendChild(item);
      });
    });
  }

  filterProfiles(searchText) {
    const listContainer = document.getElementById('templateList');
    if (!listContainer) return;

    const search = searchText.toLowerCase();
    
    // Si vide, retour à la liste complète
    if (search.length === 0) {
      this.resetModal();
      return;
    }
    
    const filtered = this.templates.filter(template => 
      template.name.toLowerCase().includes(search) ||
      template.brand.toLowerCase().includes(search)
    );

    listContainer.innerHTML = '';
    
    if (filtered.length === 0) {
      listContainer.innerHTML = '<div class="no-results">Aucun profil trouvé</div>';
    } else {
      filtered.forEach(template => {
        const item = document.createElement('div');
        item.className = 'profile-item';
        item.innerHTML = `
          <div class="profile-name">${template.name}</div>
          <div class="profile-dimensions">${template.dimensions.x}×${template.dimensions.y}×${template.dimensions.z}mm</div>
        `;
        item.onclick = () => this.showTemplateCard(template.id);
        listContainer.appendChild(item);
      });
    }
  }

  showTemplateCard(templateId) {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    // Hide search and list
    document.getElementById('templateSearch').style.display = 'none';
    document.getElementById('templateList').style.display = 'none';

    const card = document.getElementById('templateCard');
    if (!card) return;

    const gcodeIcon = template.gcode ? '✅' : '❌';
    const gcodeClass = template.gcode ? 'supported' : 'not-supported';
    const gcodeText = template.gcode ? 'Compatible G-code' : 'Protocole propriétaire';
    const brandColor = template.brandColor || '#4a5568';

    card.innerHTML = `
      <div class="template-header">
        <div class="template-title-section">
          <h3 class="template-name">${template.name}</h3>
          <div class="template-brand-badge" style="background: ${brandColor}; color: white;">
            ${template.customCategory || template.brand}
          </div>
        </div>
        <div class="template-gcode-badge ${gcodeClass}">
          ${gcodeIcon} ${gcodeText}
        </div>
      </div>
      
      <div class="template-specs">
        <div class="spec-section">
          <div class="spec-header">
            <span class="spec-icon">📐</span>
            <span class="spec-title">Dimensions du plateau</span>
          </div>
          <div class="dimensions-row">
            <div class="dim-item">
              <span class="dim-label">Largeur (X)</span>
              <span class="dim-value">${template.dimensions.x} mm</span>
            </div>
            <div class="dim-item">
              <span class="dim-label">Profondeur (Y)</span>
              <span class="dim-value">${template.dimensions.y} mm</span>
            </div>
            <div class="dim-item">
              <span class="dim-label">Hauteur (Z)</span>
              <span class="dim-value">${template.dimensions.z} mm</span>
            </div>
          </div>
        </div>
        
        <div class="spec-section">
          <div class="spec-header">
            <span class="spec-icon">📏</span>
            <span class="spec-title">Zone de travail</span>
          </div>
          <div class="coordinates-table">
            <div class="coord-row">
              <span class="coord-axis">X :</span>
              <span class="coord-range">${template.coordinateBounds.x.min} mm → ${template.coordinateBounds.x.max} mm</span>
            </div>
            <div class="coord-row">
              <span class="coord-axis">Y :</span>
              <span class="coord-range">${template.coordinateBounds.y.min} mm → ${template.coordinateBounds.y.max} mm</span>
            </div>
            <div class="coord-row">
              <span class="coord-axis">Z :</span>
              <span class="coord-range">${template.coordinateBounds.z.min} mm → ${template.coordinateBounds.z.max} mm</span>
            </div>
          </div>
        </div>
        
        <div class="spec-section">
          <div class="spec-header">
            <span class="spec-icon">🧭</span>
            <span class="spec-title">Orientation des axes</span>
          </div>
          <div class="orientation-display">
            <div class="axis-item">
              <span class="axis-label">Axe X :</span>
              <span class="axis-direction">${template.axisOrientation.x === 'right' ? 'Droite →' : 'Gauche ←'}</span>
            </div>
            <div class="axis-item">
              <span class="axis-label">Axe Y :</span>
              <span class="axis-direction">${template.axisOrientation.y === 'up' ? 'Haut ↑' : 'Bas ↓'}</span>
            </div>
            <div class="axis-item">
              <span class="axis-label">Axe Z :</span>
              <span class="axis-direction">${template.axisOrientation.z === 'up' ? 'Haut ↑' : 'Bas ↓'}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="template-description">
        <div class="description-header">
          <span class="spec-icon">📝</span>
          <span class="spec-title">Description</span>
        </div>
        <p class="description-text">${template.description}</p>
      </div>
      
      <div class="template-actions">
        <button class="template-back-btn btn" onclick="window.PlateauTemplates.resetModal()">← Retour à la liste</button>
        <button class="template-apply-btn btn" onclick="window.PlateauTemplates.applyTemplate('${template.id}')">
          ✅ Appliquer ce profil
        </button>
      </div>
    `;
    
    card.style.display = 'block';
  }

  applyTemplate(templateId) {
    this.selectTemplate(templateId);
    this.closeModal();
  }

  selectTemplate(templateId) {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    // Update plateau dimensions
    const plateauX = document.getElementById('plateauX');
    const plateauY = document.getElementById('plateauY');
    const plateauZ = document.getElementById('plateauZ');

    if (plateauX) plateauX.value = template.dimensions.x;
    if (plateauY) plateauY.value = template.dimensions.y;
    if (plateauZ) plateauZ.value = template.dimensions.z;

    // Update coordinate bounds
    const xMin = document.getElementById('xMin');
    const xMax = document.getElementById('xMax');
    const yMin = document.getElementById('yMin');
    const yMax = document.getElementById('yMax');
    const zMin = document.getElementById('zMin');
    const zMax = document.getElementById('zMax');

    if (xMin && template.coordinateBounds) xMin.value = template.coordinateBounds.x.min;
    if (xMax && template.coordinateBounds) xMax.value = template.coordinateBounds.x.max;
    if (yMin && template.coordinateBounds) yMin.value = template.coordinateBounds.y.min;
    if (yMax && template.coordinateBounds) yMax.value = template.coordinateBounds.y.max;
    if (zMin && template.coordinateBounds) zMin.value = template.coordinateBounds.z.min;
    if (zMax && template.coordinateBounds) zMax.value = template.coordinateBounds.z.max;

    // Update axis orientation
    if (template.axisOrientation && window.setAxisOrientation) {
      window.setAxisOrientation(template.axisOrientation.x, template.axisOrientation.y, template.axisOrientation.z);
    }

    // Apply changes through coordinate config
    if (window.EnderTrack?.CoordinateConfig) {
      const coordConfig = window.EnderTrack.CoordinateConfig;
      
      // Update coordinate config with template data
      coordConfig.setPlateauDimensions(template.dimensions.x, template.dimensions.y, template.dimensions.z);
      
      if (template.coordinateBounds) {
        coordConfig.setCoordinateBounds(template.coordinateBounds);
      }
      
      if (template.axisOrientation) {
        coordConfig.setAxisOrientation(template.axisOrientation);
      }
    }
    
    // Force full state update
    if (window.EnderTrack?.State) {
      window.EnderTrack.State.update({
        plateauDimensions: template.dimensions,
        coordinateBounds: template.coordinateBounds,
        axisOrientation: template.axisOrientation,
        mapSizeMm: Math.max(template.dimensions.x, template.dimensions.y)
      });
    }
    
    // Émettre l'événement de changement de plateau
    if (window.EnderTrack?.Events) {
      window.EnderTrack.Events.emit('plateau:changed');
    }
    
    // Update profile display in settings
    this.updateProfileDisplay(template);
    
    // Force canvas re-render avec la même méthode que zoom/pan
    window.EnderTrack.Canvas.updateCoordinateSystem();
    window.EnderTrack.Canvas.requestRender();
    
    // Appliquer automatiquement les limites de sécurité au plateau
    if (window.resetLimitsToPlateauSize) {
      window.resetLimitsToPlateauSize();
    }
    
    // Close modal
    this.closeModal();
    
    // Show notification
    if (window.EnderTrack?.Notifications) {
      window.EnderTrack.Notifications.show(
        `Profil "${template.name}" appliqué`, 
        'success'
      );
    }
  }

  validateAndApply() {
    const plateauX = document.getElementById('plateauX');
    const plateauY = document.getElementById('plateauY');
    const plateauZ = document.getElementById('plateauZ');

    if (!plateauX || !plateauY || !plateauZ) return false;

    const x = parseInt(plateauX.value) || 200;
    const y = parseInt(plateauY.value) || 200;
    const z = parseInt(plateauZ.value) || 100;

    // Validate ranges
    const validX = Math.max(10, Math.min(1000, x));
    const validY = Math.max(10, Math.min(1000, y));
    const validZ = Math.max(10, Math.min(500, z));

    // Update inputs if clamped
    if (validX !== x) plateauX.value = validX;
    if (validY !== y) plateauY.value = validY;
    if (validZ !== z) plateauZ.value = validZ;

    // Update state
    if (window.EnderTrack?.State) {
      const newDimensions = { x: validX, y: validY, z: validZ };
      
      window.EnderTrack.State.update({
        plateauDimensions: newDimensions,
        mapSizeMm: Math.max(validX, validY)
      });

      // Update coordinate system
      if (window.EnderTrack?.Coordinates) {
        window.EnderTrack.Coordinates.updateParameters({
          plateauDimensions: newDimensions,
          mapSizeMm: Math.max(validX, validY)
        });
      }
      

      // Force canvas render
      if (window.EnderTrack?.Canvas) {
        window.EnderTrack.Canvas.requestRender();
      }
      
      // Émettre l'événement de changement de plateau
      if (window.EnderTrack?.Events) {
        window.EnderTrack.Events.emit('plateau:changed');
      }
    }

    return true;
  }

  updateProfileDisplay(template) {
    // Update settings display
    const selectedProfile = document.getElementById('selectedProfile');
    const profileName = document.getElementById('profileName');
    const profileDimensions = document.getElementById('profileDimensions');
    
    if (selectedProfile && profileName && profileDimensions) {
      profileName.textContent = template.name;
      profileDimensions.textContent = `${template.dimensions.x}×${template.dimensions.y}×${template.dimensions.z}mm`;
      selectedProfile.style.display = 'block';
    }
    
    // Update canvas overlay display
    const profileInfo = document.getElementById('profileInfo');
    const profileNameCanvas = document.getElementById('profileNameCanvas');
    
    if (profileInfo && profileNameCanvas) {
      profileNameCanvas.textContent = template.name;
      profileInfo.style.display = 'inline';
    }
  }
}

// Global functions
function validatePlateauSize() {
  if (window.PlateauTemplates) {
    const success = window.PlateauTemplates.validateAndApply();
    
    if (success && window.EnderTrack?.UI?.showNotification) {
      window.EnderTrack.UI.showNotification(
        'Dimensions du plateau validées', 
        'success'
      );
    }
  }
}

function openTemplateModal() {
  if (window.PlateauTemplates) {
    window.PlateauTemplates.openModal();
  }
}

function closeTemplateModal() {
  if (window.PlateauTemplates) {
    window.PlateauTemplates.closeModal();
  }
}

function filterTemplateDropdown() {
  const searchText = document.getElementById('templateSearch').value;
  if (window.PlateauTemplates) {
    window.PlateauTemplates.filterDropdown(searchText);
    
    // Hide card when searching
    if (searchText.length > 0) {
      document.getElementById('templateCard').style.display = 'none';
    }
  }
}

// Nouvelle fonction pour gérer le focus
function handleSearchFocus() {
  const dropdown = document.getElementById('templateDropdown');
  if (dropdown && window.PlateauTemplates) {
    // Afficher tous les profils au focus
    window.PlateauTemplates.populateDropdown();
    dropdown.style.display = 'block';
    
    // Calculer la hauteur maximale disponible dans le modal
    const modal = document.getElementById('templateModal');
    const modalBody = modal?.querySelector('.modal-body');
    const searchInput = document.getElementById('templateSearch');
    
    if (modalBody && searchInput) {
      const modalRect = modalBody.getBoundingClientRect();
      const searchRect = searchInput.getBoundingClientRect();
      const availableHeight = modalRect.bottom - searchRect.bottom - 20; // 20px de marge
      
      dropdown.style.maxHeight = `${Math.max(200, availableHeight)}px`;
    }
  }
}

// Nouvelle fonction pour gérer la perte de focus
function handleSearchBlur(event) {
  const dropdown = document.getElementById('templateDropdown');
  // Délai pour permettre le clic sur le dropdown
  setTimeout(() => {
    if (dropdown && !dropdown.contains(document.activeElement)) {
      dropdown.style.display = 'none';
    }
  }, 150);
}

function handleSearchKeydown(event) {
  const dropdown = document.getElementById('templateDropdown');
  
  if (!dropdown || dropdown.style.display === 'none') return;
  
  switch(event.key) {
    case 'ArrowDown':
      event.preventDefault();
      if (dropdown.selectedIndex < dropdown.options.length - 1) {
        dropdown.selectedIndex++;
      } else {
        dropdown.selectedIndex = 0;
      }
      break;
      
    case 'ArrowUp':
      event.preventDefault();
      if (dropdown.selectedIndex > 0) {
        dropdown.selectedIndex--;
      } else {
        dropdown.selectedIndex = dropdown.options.length - 1;
      }
      break;
      
    case 'Enter':
      event.preventDefault();
      if (dropdown.selectedIndex >= 0 && dropdown.options[dropdown.selectedIndex].value) {
        selectTemplate();
      }
      break;
      
    case 'Escape':
      dropdown.style.display = 'none';
      document.getElementById('templateSearch').focus();
      break;
  }
}

function handleDropdownKeydown(event) {
  const dropdown = document.getElementById('templateDropdown');
  const searchInput = document.getElementById('templateSearch');
  
  switch(event.key) {
    case 'Enter':
      event.preventDefault();
      if (dropdown.selectedIndex >= 0 && dropdown.options[dropdown.selectedIndex].value) {
        selectTemplate();
      }
      break;
      
    case 'Escape':
      dropdown.style.display = 'none';
      searchInput.focus();
      break;
  }
}

function selectTemplate() {
  const dropdown = document.getElementById('templateDropdown');
  const templateId = dropdown.value;
  
  if (templateId && templateId !== '' && window.PlateauTemplates) {
    const template = window.PlateauTemplates.templates.find(t => t.id === templateId);
    
    if (template) {
      // Update search input with selected template name
      document.getElementById('templateSearch').value = template.name;
      // Hide dropdown
      dropdown.style.display = 'none';
      // Show card
      window.PlateauTemplates.showTemplateCard(templateId);
    }
  } else {
    // Hide card if no valid selection
    const card = document.getElementById('templateCard');
    if (card) card.style.display = 'none';
  }
}

// Global instance
window.PlateauTemplates = new PlateauTemplates();
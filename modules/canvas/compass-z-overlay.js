// modules/canvas/compass-z-overlay.js - Boussole Z en overlay

class CompassZOverlay {
  constructor() {
    this.container = null;
    this.svg = null;
  }

  init() {
    this.container = document.getElementById('compassZOverlay');
    if (!this.container) {
      return false;
    }

    // Créer le SVG vertical pour Z (basé sur l'ancienne boussole Z)
    this.container.innerHTML = `<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="22" fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
      <line id="z-line" x1="40" y1="40" x2="40" y2="18" stroke="#888888" stroke-width="2"/>
      <polygon id="z-arrow" points="40,18 37,22 43,22" fill="#888888"/>
      <text id="z-text" x="40" y="13" font-family="Arial" font-size="11" fill="#888888" text-anchor="middle" font-weight="normal">Z+</text>
    </svg>`;
    
    this.svg = this.container.querySelector('svg');
    
    this.container.addEventListener('click', (e) => {
      this.handleClick(e);
    });

    return true;
  }

  render(state) {
    if (!this.svg) return;

    const zOrientation = state.axisOrientation?.z || 'up';
    const zLine = this.svg.querySelector('#z-line');
    const zArrow = this.svg.querySelector('#z-arrow');
    const zText = this.svg.querySelector('#z-text');

    if (zLine && zArrow && zText) {
      if (zOrientation === 'down') {
        // Flèche vers le bas
        zLine.setAttribute('y2', '62');
        zArrow.setAttribute('points', '40,62 37,58 43,58');
        zText.setAttribute('y', '72');
      } else {
        // Flèche vers le haut (défaut)
        zLine.setAttribute('y2', '18');
        zArrow.setAttribute('points', '40,18 37,22 43,22');
        zText.setAttribute('y', '13');
      }
    }
  }

  handleClick(e) {
    const viewportManager = window.EnderTrack?.Viewport?.Manager;
    const activeLayout = viewportManager?.currentLayout || 'single';
    
    const borderFactors = {
      'single': 0.8,
      '50-50': 0.6,
      '2x2': 0.4
    };
    
    const borderFactor = borderFactors[activeLayout] || 0.8;
    
    if (window.EnderTrack?.ZVisualization?.interactions?.zFitToView) {
      window.EnderTrack.ZVisualization.interactions.zFitToView(borderFactor);
    }
  }
}

// Export global - Ne pas écraser EnderTrack.Canvas
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Canvas = window.EnderTrack.Canvas || {};
window.EnderTrack.Canvas.CompassZOverlay = new CompassZOverlay();

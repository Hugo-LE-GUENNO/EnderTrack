// modules/canvas/compass-overlay.js - Boussole SVG en overlay

class CompassOverlay {
  constructor() {
    this.container = null;
    this.svg = null;
  }

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      return false;
    }

    // Créer le SVG directement
    this.container.innerHTML = `<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="22" fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
      <line x1="40" y1="40" x2="62" y2="40" stroke="#888888" stroke-width="2"/>
      <polygon points="62,40 58,37 58,43" fill="#888888"/>
      <text x="72" y="44" font-family="Arial" font-size="11" fill="#888888" text-anchor="middle" font-weight="normal">X+</text>
      <line x1="40" y1="40" x2="40" y2="18" stroke="#aaaaaa" stroke-width="2"/>
      <polygon points="40,18 37,22 43,22" fill="#aaaaaa"/>
      <text x="40" y="13" font-family="Arial" font-size="11" fill="#888888" text-anchor="middle" font-weight="normal">Y+</text>
    </svg>`;
    
    this.svg = this.container.querySelector('svg');

    // Event listener pour les clics
    this.container.addEventListener('click', (e) => {
      this.handleClick(e);
    });

    return true;
  }

  render(state) {
    if (!this.svg) return;

    const axisOrientation = state.axisOrientation || { x: 'right', y: 'up' };
    
    const xLine = this.svg.querySelector('line:nth-of-type(1)');
    const xArrow = this.svg.querySelector('polygon:nth-of-type(1)');
    const xText = this.svg.querySelector('text:nth-of-type(1)');
    const yLine = this.svg.querySelector('line:nth-of-type(2)');
    const yArrow = this.svg.querySelector('polygon:nth-of-type(2)');
    const yText = this.svg.querySelector('text:nth-of-type(2)');

    if (xLine && xArrow && xText) {
      if (axisOrientation.x === 'right') {
        xLine.setAttribute('x2', '62');
        xArrow.setAttribute('points', '62,40 58,37 58,43');
        xText.setAttribute('x', '72');
      } else {
        xLine.setAttribute('x2', '18');
        xArrow.setAttribute('points', '18,40 22,37 22,43');
        xText.setAttribute('x', '8');
      }
    }

    if (yLine && yArrow && yText) {
      if (axisOrientation.y === 'up') {
        yLine.setAttribute('y2', '18');
        yArrow.setAttribute('points', '40,18 37,22 43,22');
        yText.setAttribute('y', '13');
      } else {
        yLine.setAttribute('y2', '62');
        yArrow.setAttribute('points', '40,62 37,58 43,58');
        yText.setAttribute('y', '72');
      }
    }
  }

  handleClick(e) {
    // Adapter le borderFactor selon le layout actif
    const activeLayout = window.EnderTrack?.Viewport?.Manager?.activeLayout || 'single';
    let borderFactor;
    
    switch(activeLayout) {
      case 'single':
        borderFactor = 0.8;
        break;
      case '50-50':
        borderFactor = 0.6;
        break;
      case '2x2':
        borderFactor = 0.4;
        break;
      default:
        borderFactor = 0.8;
    }
    
    if (window.EnderTrack?.CanvasInteractions?.fitToView) {
      window.EnderTrack.CanvasInteractions.fitToView(borderFactor);
    }
  }
}

// Export global - Ne pas écraser EnderTrack.Canvas
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Canvas = window.EnderTrack.Canvas || {};
window.EnderTrack.Canvas.CompassOverlay = new CompassOverlay();

// modules/canvas/z-renderers/z-ui-renderer.js - Z UI elements rendering
class ZUIRenderer {
  static render(ctx, canvas, state, zPan, zRange, zCompassHovered, zCompassBounds) {
    this.drawZLimits(ctx, canvas, state, zPan, zRange);
    // Boussole Z désactivée - maintenant dans l'overlay unifié
    return null;
  }

  static drawZLimits(ctx, canvas, state, zPan, zRange) {
    // Afficher les limites de sécurité Z avec pointillés discrets
    if (window.EnderTrack?.StrategicPositions) {
      const limits = window.EnderTrack.StrategicPositions.getLimits();
      
      if (limits.zShow && limits.zMin !== null && limits.zMax !== null) {
        const zMin = limits.zMin;
        const zMax = limits.zMax;
        const zOrientation = state.axisOrientation?.z || 'up';
        const zInverted = zOrientation === 'down' ? -1 : 1;
        
        // Calculer les positions Y sur le canvas Z
        const halfRange = zRange / 2;
        const minY = canvas.height/2 - (zInverted * (zMin - zPan) / halfRange) * (canvas.height/2);
        const maxY = canvas.height/2 - (zInverted * (zMax - zPan) / halfRange) * (canvas.height/2);
        
        // Dessiner les limites Z (rouge pointillé discret)
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.setLineDash([3, 6]);
        
        // Ligne limite min
        if (minY >= 0 && minY <= canvas.height) {
          ctx.beginPath();
          ctx.moveTo(0, minY);
          ctx.lineTo(canvas.width, minY);
          ctx.stroke();
        }
        
        // Ligne limite max
        if (maxY >= 0 && maxY <= canvas.height) {
          ctx.beginPath();
          ctx.moveTo(0, maxY);
          ctx.lineTo(canvas.width, maxY);
          ctx.stroke();
        }
        
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }
  }

  static drawZCompass(ctx, canvas, zCompassHovered) {
    const centerX = canvas.width / 2;
    const centerY = 45;
    const baseRadius = 30;
    const isHovered = zCompassHovered || false;
    
    // Store bounds for click detection
    const zCompassBounds = {
      x: centerX - baseRadius - 2,
      y: centerY - baseRadius - 2,
      width: (baseRadius + 2) * 2,
      height: (baseRadius + 2) * 2
    };
    
    // Check if colors or orientation changed to regenerate SVG
    const currentColor = window.customColors?.axisZColor || '#4f9eff';
    const currentOrientation = window.EnderTrack?.State?.get()?.zOrientation || 'up';
    const currentKey = `${currentColor}-${currentOrientation}`;
    
    if (!this.compassImageZ || this.lastZKey !== currentKey) {
      this.generateZCompassSVG(currentColor);
      this.lastZKey = currentKey;
    }
    
    if (this.compassImageZ && this.compassImageZ.complete) {
      const size = isHovered ? 76 : 70;
      const x = centerX - size/2;
      const y = centerY - size/2;
      
      // Add hover effect with shadow
      if (isHovered) {
        ctx.shadowColor = 'rgba(255,255,255,0.3)';
        ctx.shadowBlur = 8;
      }
      
      ctx.drawImage(this.compassImageZ, x, y, size, size);
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    
    return zCompassBounds;
  }
  
  static generateZCompassSVG(color) {
    const zOrientation = window.EnderTrack?.State?.get()?.zOrientation || 'up';
    
    let svgContent;
    if (zOrientation === 'down') {
      // Flèche vers le bas
      svgContent = `<svg width="60" height="70" viewBox="0 0 60 70" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="35" r="22" fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
        <line x1="30" y1="35" x2="30" y2="57" stroke="${color}" stroke-width="2"/>
        <polygon points="30,57 27,53 33,53" fill="${color}"/>
        <text x="30" y="67" font-family="Arial" font-size="11" fill="#888888" text-anchor="middle" font-weight="normal">Z+</text>
      </svg>`;
    } else {
      // Flèche vers le haut (défaut)
      svgContent = `<svg width="60" height="70" viewBox="0 0 60 70" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="35" r="22" fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
        <line x1="30" y1="35" x2="30" y2="13" stroke="${color}" stroke-width="2"/>
        <polygon points="30,13 27,17 33,17" fill="${color}"/>
        <text x="30" y="8" font-family="Arial" font-size="11" fill="#888888" text-anchor="middle" font-weight="normal">Z+</text>
      </svg>`;
    }
    
    this.compassImageZ = new Image();
    this.compassImageZ.src = 'data:image/svg+xml;base64,' + btoa(svgContent);
  }


}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ZUIRenderer = ZUIRenderer;
// modules/utils/graphics.js - Graphics and drawing utilities

class GraphicsUtils {
  // Color utilities
  static hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  static rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  static rgbaToString(r, g, b, a = 1) {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  static interpolateColor(color1, color2, factor) {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);
    
    if (!c1 || !c2) return color1;
    
    const r = Math.round(c1.r + (c2.r - c1.r) * factor);
    const g = Math.round(c1.g + (c2.g - c1.g) * factor);
    const b = Math.round(c1.b + (c2.b - c1.b) * factor);
    
    return this.rgbToHex(r, g, b);
  }

  // Drawing primitives
  static drawLine(ctx, x1, y1, x2, y2, options = {}) {
    const {
      color = '#000000',
      width = 1,
      dash = null,
      alpha = 1
    } = options;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    
    if (dash) {
      ctx.setLineDash(dash);
    }
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    ctx.restore();
  }

  static drawCircle(ctx, x, y, radius, options = {}) {
    const {
      fillColor = null,
      strokeColor = null,
      lineWidth = 1,
      alpha = 1
    } = options;

    ctx.save();
    ctx.globalAlpha = alpha;
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    
    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    
    ctx.restore();
  }

  static drawRectangle(ctx, x, y, width, height, options = {}) {
    const {
      fillColor = null,
      strokeColor = null,
      lineWidth = 1,
      alpha = 1,
      cornerRadius = 0
    } = options;

    ctx.save();
    ctx.globalAlpha = alpha;
    
    if (cornerRadius > 0) {
      this.drawRoundedRect(ctx, x, y, width, height, cornerRadius);
    } else {
      ctx.beginPath();
      ctx.rect(x, y, width, height);
    }
    
    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    
    ctx.restore();
  }

  static drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  static drawArrow(ctx, x1, y1, x2, y2, options = {}) {
    const {
      color = '#000000',
      width = 2,
      headSize = 10,
      alpha = 1
    } = options;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    // Draw arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headAngle = Math.PI / 6; // 30 degrees
    
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headSize * Math.cos(angle - headAngle),
      y2 - headSize * Math.sin(angle - headAngle)
    );
    ctx.lineTo(
      x2 - headSize * Math.cos(angle + headAngle),
      y2 - headSize * Math.sin(angle + headAngle)
    );
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }

  static drawText(ctx, text, x, y, options = {}) {
    const {
      font = '12px Arial',
      color = '#000000',
      align = 'left',
      baseline = 'top',
      alpha = 1,
      background = null,
      padding = 4
    } = options;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    
    // Draw background if specified
    if (background) {
      const metrics = ctx.measureText(text);
      const textWidth = metrics.width;
      const textHeight = parseInt(font.match(/\d+/)[0]); // Extract font size
      
      let bgX = x;
      let bgY = y;
      
      // Adjust position based on alignment
      if (align === 'center') bgX -= textWidth / 2;
      else if (align === 'right') bgX -= textWidth;
      
      if (baseline === 'middle') bgY -= textHeight / 2;
      else if (baseline === 'bottom') bgY -= textHeight;
      
      ctx.fillStyle = background;
      ctx.fillRect(
        bgX - padding, 
        bgY - padding, 
        textWidth + padding * 2, 
        textHeight + padding * 2
      );
      ctx.fillStyle = color;
    }
    
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // Grid drawing
  static drawGrid(ctx, bounds, spacing, options = {}) {
    const {
      color = '#cccccc',
      width = 0.5,
      alpha = 0.5,
      majorSpacing = null,
      majorColor = '#999999',
      majorWidth = 1
    } = options;

    ctx.save();
    ctx.globalAlpha = alpha;
    
    // Draw minor grid lines
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    
    // Vertical lines
    for (let x = bounds.minX; x <= bounds.maxX; x += spacing) {
      ctx.moveTo(x, bounds.minY);
      ctx.lineTo(x, bounds.maxY);
    }
    
    // Horizontal lines
    for (let y = bounds.minY; y <= bounds.maxY; y += spacing) {
      ctx.moveTo(bounds.minX, y);
      ctx.lineTo(bounds.maxX, y);
    }
    
    ctx.stroke();
    
    // Draw major grid lines if specified
    if (majorSpacing) {
      ctx.strokeStyle = majorColor;
      ctx.lineWidth = majorWidth;
      ctx.beginPath();
      
      // Major vertical lines
      for (let x = bounds.minX; x <= bounds.maxX; x += majorSpacing) {
        ctx.moveTo(x, bounds.minY);
        ctx.lineTo(x, bounds.maxY);
      }
      
      // Major horizontal lines
      for (let y = bounds.minY; y <= bounds.maxY; y += majorSpacing) {
        ctx.moveTo(bounds.minX, y);
        ctx.lineTo(bounds.maxX, y);
      }
      
      ctx.stroke();
    }
    
    ctx.restore();
  }

  // Path drawing
  static drawPath(ctx, points, options = {}) {
    const {
      color = '#000000',
      width = 2,
      closed = false,
      smooth = false,
      alpha = 1
    } = options;

    if (points.length < 2) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    
    ctx.beginPath();
    
    if (smooth && points.length > 2) {
      // Draw smooth curve using quadratic curves
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 1; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        const midX = (current.x + next.x) / 2;
        const midY = (current.y + next.y) / 2;
        
        ctx.quadraticCurveTo(current.x, current.y, midX, midY);
      }
      
      // Draw to last point
      const lastPoint = points[points.length - 1];
      ctx.lineTo(lastPoint.x, lastPoint.y);
    } else {
      // Draw straight lines
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
    }
    
    if (closed) {
      ctx.closePath();
    }
    
    ctx.stroke();
    ctx.restore();
  }

  // Gradient utilities
  static createLinearGradient(ctx, x1, y1, x2, y2, colorStops) {
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    
    colorStops.forEach(stop => {
      gradient.addColorStop(stop.position, stop.color);
    });
    
    return gradient;
  }

  static createRadialGradient(ctx, x1, y1, r1, x2, y2, r2, colorStops) {
    const gradient = ctx.createRadialGradient(x1, y1, r1, x2, y2, r2);
    
    colorStops.forEach(stop => {
      gradient.addColorStop(stop.position, stop.color);
    });
    
    return gradient;
  }

  // Image utilities
  static drawImageFit(ctx, image, x, y, width, height, options = {}) {
    const {
      fit = 'contain', // 'contain', 'cover', 'fill', 'none'
      align = 'center', // 'left', 'center', 'right'
      valign = 'middle' // 'top', 'middle', 'bottom'
    } = options;

    const imageAspect = image.width / image.height;
    const targetAspect = width / height;
    
    let drawWidth, drawHeight, drawX, drawY;
    
    switch (fit) {
      case 'contain':
        if (imageAspect > targetAspect) {
          drawWidth = width;
          drawHeight = width / imageAspect;
        } else {
          drawWidth = height * imageAspect;
          drawHeight = height;
        }
        break;
        
      case 'cover':
        if (imageAspect > targetAspect) {
          drawWidth = height * imageAspect;
          drawHeight = height;
        } else {
          drawWidth = width;
          drawHeight = width / imageAspect;
        }
        break;
        
      case 'fill':
        drawWidth = width;
        drawHeight = height;
        break;
        
      case 'none':
        drawWidth = image.width;
        drawHeight = image.height;
        break;
    }
    
    // Calculate position based on alignment
    switch (align) {
      case 'left':
        drawX = x;
        break;
      case 'center':
        drawX = x + (width - drawWidth) / 2;
        break;
      case 'right':
        drawX = x + width - drawWidth;
        break;
    }
    
    switch (valign) {
      case 'top':
        drawY = y;
        break;
      case 'middle':
        drawY = y + (height - drawHeight) / 2;
        break;
      case 'bottom':
        drawY = y + height - drawHeight;
        break;
    }
    
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  }

  // Animation utilities
  static easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  static easeIn(t) {
    return t * t;
  }

  static easeOut(t) {
    return t * (2 - t);
  }

  static bounce(t) {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    } else if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    } else {
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
  }

  // Canvas utilities
  static clearCanvas(ctx, x = 0, y = 0, width = null, height = null) {
    if (width === null) width = ctx.canvas.width;
    if (height === null) height = ctx.canvas.height;
    
    ctx.clearRect(x, y, width, height);
  }

  static saveCanvasAsImage(canvas, filename = 'canvas.png', quality = 1.0) {
    const link = document.createElement('a');
    link.download = filename;
    
    if (filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) {
      link.href = canvas.toDataURL('image/jpeg', quality);
    } else {
      link.href = canvas.toDataURL('image/png');
    }
    
    link.click();
  }

  static getCanvasImageData(canvas, x = 0, y = 0, width = null, height = null) {
    const ctx = canvas.getContext('2d');
    if (width === null) width = canvas.width;
    if (height === null) height = canvas.height;
    
    return ctx.getImageData(x, y, width, height);
  }

  // Measurement utilities
  static measureText(ctx, text, font = null) {
    if (font) {
      const oldFont = ctx.font;
      ctx.font = font;
      const metrics = ctx.measureText(text);
      ctx.font = oldFont;
      return metrics;
    }
    
    return ctx.measureText(text);
  }

  static getTextBounds(ctx, text, x, y, font = null) {
    const metrics = this.measureText(ctx, text, font);
    const fontSize = font ? parseInt(font.match(/\d+/)[0]) : 12;
    
    return {
      x: x,
      y: y - fontSize,
      width: metrics.width,
      height: fontSize
    };
  }

  // Transformation utilities
  static rotatePoint(x, y, centerX, centerY, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    const dx = x - centerX;
    const dy = y - centerY;
    
    return {
      x: centerX + dx * cos - dy * sin,
      y: centerY + dx * sin + dy * cos
    };
  }

  static scalePoint(x, y, centerX, centerY, scaleX, scaleY = scaleX) {
    return {
      x: centerX + (x - centerX) * scaleX,
      y: centerY + (y - centerY) * scaleY
    };
  }

  // Hit testing
  static pointInRect(px, py, x, y, width, height) {
    return px >= x && px <= x + width && py >= y && py <= y + height;
  }

  static pointInCircle(px, py, cx, cy, radius) {
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= radius * radius;
  }

  static pointInPolygon(px, py, vertices) {
    let inside = false;
    
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x;
      const yi = vertices[i].y;
      const xj = vertices[j].x;
      const yj = vertices[j].y;
      
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }
}

// Global registration
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Graphics = GraphicsUtils;
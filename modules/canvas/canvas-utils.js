// modules/canvas/canvas-utils.js - Canvas utility functions
class CanvasUtils {
  static drawCircle(ctx, x, y, radius, color, fill = true) {
    const canvasPos = window.EnderTrack.Coordinates.mapToCanvas(x, y);
    const pixelRadius = window.EnderTrack.Coordinates.mmToPixels(radius);
    
    ctx.beginPath();
    ctx.arc(canvasPos.cx, canvasPos.cy, pixelRadius, 0, Math.PI * 2);
    
    if (fill) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.stroke();
    }
  }

  static drawLine(ctx, x1, y1, x2, y2, color, width = 1) {
    const start = window.EnderTrack.Coordinates.mapToCanvas(x1, y1);
    const end = window.EnderTrack.Coordinates.mapToCanvas(x2, y2);
    
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(start.cx, start.cy);
    ctx.lineTo(end.cx, end.cy);
    ctx.stroke();
  }

  static drawText(ctx, x, y, text, color, font = '12px sans-serif') {
    const canvasPos = window.EnderTrack.Coordinates.mapToCanvas(x, y);
    
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvasPos.cx, canvasPos.cy);
  }

  static isPointVisible(x, y, canvas, margin = 10) {
    return x >= -margin && x <= canvas.width + margin && 
           y >= -margin && y <= canvas.height + margin;
  }

  static getCustomColor(colorKey, defaultColor) {
    return window.customColors?.[colorKey] || defaultColor;
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.CanvasUtils = CanvasUtils;
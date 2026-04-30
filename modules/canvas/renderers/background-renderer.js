// modules/canvas/renderers/background-renderer.js - Background and platform rendering
class BackgroundRenderer {
  static render(ctx, canvas, state) {
    this.renderBackground(ctx, canvas, state);
    this.renderPlatform(ctx, canvas, state);
  }

  static renderBackground(ctx, canvas, state) {
    // Use Enderscope theme colors
    const bgColor = window.customColors?.outsideColor || getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim();
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  static renderPlatform(ctx, canvas, state) {
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return;
    
    const bounds = coords.getCoordinateBounds();
    
    // Get all four corners to handle any axis orientation
    const corners = [
      coords.mapToCanvas(bounds.minX, bounds.minY),
      coords.mapToCanvas(bounds.maxX, bounds.minY),
      coords.mapToCanvas(bounds.maxX, bounds.maxY),
      coords.mapToCanvas(bounds.minX, bounds.maxY)
    ];
    
    const xs = corners.map(c => c.cx);
    const ys = corners.map(c => c.cy);
    
    const leftEdge = Math.min(...xs);
    const rightEdge = Math.max(...xs);
    const topEdge = Math.min(...ys);
    const bottomEdge = Math.max(...ys);
    
    // Platform background - Use Enderscope theme
    const mapBackground = window.customColors?.mapBackground || getComputedStyle(document.documentElement).getPropertyValue('--container-bg').trim();
    ctx.fillStyle = mapBackground;
    ctx.fillRect(leftEdge, topEdge, rightEdge - leftEdge, bottomEdge - topEdge);
    
    // Platform boundary - Use Enderscope theme
    const originAxesColor = window.customColors?.originAxes || getComputedStyle(document.documentElement).getPropertyValue('--active-element').trim();
    ctx.strokeStyle = originAxesColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.rect(leftEdge, topEdge, rightEdge - leftEdge, bottomEdge - topEdge);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.BackgroundRenderer = BackgroundRenderer;
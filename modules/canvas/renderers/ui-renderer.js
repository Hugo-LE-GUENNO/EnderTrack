// modules/canvas/renderers/ui-renderer.js - UI elements rendering
class UIRenderer {
  static render(ctx, canvas, state) {
    this.renderScaleIndicator(ctx, canvas, state);
    this.renderMiniPreview(ctx, canvas, state);
  }

  static renderScaleIndicator(ctx, canvas, state) {
    const zoom = state.zoom || 1;
    const scaleBarRatio = 0.33; // Taille fixe de la barre
    const scaleBarMultiplier = state.scaleBarMultiplier || 1; // Multiplicateur utilisateur
    const targetBarLengthPx = canvas.width * scaleBarRatio;
    
    // CORRECTION: Utiliser directement le zoom sans passer par targetScaleMm
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return;
    
    const pxPerMm = coords.pxPerMm() * zoom;
    const targetScaleMm = targetBarLengthPx / pxPerMm;
    
    const scaleSteps = [
      50, 20, 10, 5, 2, 1,
      0.5, 0.2, 0.1, 0.05, 0.02, 0.01,
      0.005, 0.002, 0.001,
      0.0005, 0.0002, 0.0001,
      0.00005, 0.00002, 0.00001,
      0.000005, 0.000002, 0.000001
    ];
    
    let bestScale = scaleSteps[0];
    for (const step of scaleSteps) {
      if (step <= targetScaleMm) {
        bestScale = step;
        break;
      }
    }
    
    // Appliquer le multiplicateur choisi par l'utilisateur
    bestScale *= scaleBarMultiplier;
    
    let scaleValueMm, unit, displayValue;
    
    if (bestScale >= 1) {
      scaleValueMm = bestScale;
      displayValue = bestScale;
      unit = 'mm';
    } else if (bestScale >= 0.001) {
      scaleValueMm = bestScale;
      displayValue = bestScale * 1000;
      // Format with appropriate decimals
      if (displayValue >= 10) {
        displayValue = Math.round(displayValue);
      } else if (displayValue >= 1) {
        displayValue = Math.round(displayValue * 10) / 10;
      } else {
        displayValue = Math.round(displayValue * 100) / 100;
      }
      unit = 'µm';
    } else {
      scaleValueMm = bestScale;
      displayValue = Math.round(bestScale * 1000000);
      unit = 'nm';
    }
    
    const barLengthPx = scaleValueMm * pxPerMm;
    const x = 20;
    const y = canvas.height - 30;
    
    // Scale bar
    const scaleBarColor = window.customColors?.scaleBarColor || '#ffffff';
    ctx.strokeStyle = scaleBarColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + barLengthPx, y);
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + 8);
    ctx.moveTo(x + barLengthPx, y - 8);
    ctx.lineTo(x + barLengthPx, y + 8);
    ctx.stroke();
    
    // Scale text
    ctx.fillStyle = scaleBarColor;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${displayValue}${unit}`, x + barLengthPx / 2, y - 12);
  }



  static renderMiniPreview(ctx, canvas, state) {
    // Ne pas afficher les overlays en mode scenario
    const isScenarioMode = canvas.classList.contains('scenario-mode');
    if (isScenarioMode) return;
    
    // Render overlays in unified container
    if (window.EnderTrack?.MiniPreview) {
      window.EnderTrack.MiniPreview.renderInHeader('miniPreviewXY', state);
    }
    if (window.EnderTrack?.MiniZPreview) {
      window.EnderTrack.MiniZPreview.renderInHeader('miniPreviewZ', state);
    }
    if (window.EnderTrack?.Canvas?.CompassOverlay) {
      window.EnderTrack.Canvas.CompassOverlay.render(state);
    }
    if (window.EnderTrack?.Canvas?.CompassZOverlay) {
      window.EnderTrack.Canvas.CompassZOverlay.render(state);
    }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.UIRenderer = UIRenderer;
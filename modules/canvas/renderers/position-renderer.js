// modules/canvas/renderers/position-renderer.js - Position and overlay rendering
class PositionRenderer {
  static render(ctx, canvas, state) {
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return;
    
    const currentPos = coords.mapToCanvas(state.pos.x, state.pos.y);
    const posX = currentPos.cx;
    const posY = currentPos.cy;
    
    this.renderMovementVector(ctx, state, posX, posY);
    this.renderOverlays(ctx, state, coords);
    this.renderHistoryPositions(ctx, state, coords);
    this.renderCurrentPosition(ctx, state, posX, posY);
  }

  static renderMovementVector(ctx, state, posX, posY) {
    if (window.continuousVector && window.continuousVector.xy) {
      const vector = window.continuousVector.xy;
      const vectorLength = 20 + (vector.speed * 2);
      
      const vectorEndX = posX + (vector.dx * vectorLength);
      const vectorEndY = posY + (vector.dy * vectorLength);
      
      const futurePositionColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-potential').trim();
      ctx.strokeStyle = futurePositionColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(posX, posY);
      ctx.lineTo(vectorEndX, vectorEndY);
      ctx.stroke();
      
      // Arrowhead
      const angle = Math.atan2(vector.dy, vector.dx);
      const arrowSize = 8;
      
      ctx.fillStyle = futurePositionColor;
      ctx.beginPath();
      ctx.moveTo(vectorEndX, vectorEndY);
      ctx.lineTo(
        vectorEndX - arrowSize * Math.cos(angle - Math.PI / 6),
        vectorEndY - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        vectorEndX - arrowSize * Math.cos(angle + Math.PI / 6),
        vectorEndY - arrowSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    }
  }

  static renderOverlays(ctx, state, coords) {
    const showFuturePositionsXY = document.getElementById('showFuturePositionsXY');
    const showFutureXYEnabled = !showFuturePositionsXY || showFuturePositionsXY.checked;
    
    if (!state.historyMode && showFutureXYEnabled && state.activeTab === 'navigation') {
      this.renderNavigationOverlays(ctx, state, coords);
    }
    
    if (!state.historyMode) {
      // Render Scenario track
      const scenarioActive = window.EnderTrack?.Scenario?.isActive;
      if (scenarioActive && window.EnderTrack?.Scenario?.scenarioTrack?.enabled) {
        this.renderScenarioTrack(ctx, coords);
      }
    }
  }


  
  static renderScenarioTrack(ctx, coords) {
    const track = window.EnderTrack?.Scenario?.scenarioTrack;
    if (!track?.visited?.length) return;
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    const first = coords.mapToCanvas(track.visited[0].x, track.visited[0].y);
    ctx.moveTo(first.cx, first.cy);
    for (let i = 1; i < track.visited.length; i++) {
      const p = coords.mapToCanvas(track.visited[i].x, track.visited[i].y);
      ctx.lineTo(p.cx, p.cy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  static renderNavigationOverlays(ctx, state, coords) {
    if (window.EnderTrack?.Lists?.isActive) return;
    const isContinuous = window.EnderTrack?.KeyboardMode?.isActive && (window.controllerMode || 'step') === 'continuous';
    if (isContinuous) return;

    const futurePositionColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-potential').trim() || '#ffc107';

    // Relative overlays: 8 directional crosshairs
    let sensX = state.sensitivityX || 1;
    let sensY = state.sensitivityY || 1;
    const xySlider = document.getElementById('sensitivityXY');
    const xSlider = document.getElementById('sensitivityX');
    const ySlider = document.getElementById('sensitivityY');

    if (state.lockXY && xySlider) {
      const v = parseFloat(xySlider.value);
      if (!isNaN(v)) { sensX = v; sensY = v; }
    } else {
      const vx = parseFloat(xSlider?.value); if (!isNaN(vx)) sensX = vx;
      const vy = parseFloat(ySlider?.value); if (!isNaN(vy)) sensY = vy;
    }

    const DIAG = 1 / Math.sqrt(2);
    const dirs = [
      { x: 0, y: sensY, locked: state.lockY },
      { x: 0, y: -sensY, locked: state.lockY },
      { x: -sensX, y: 0, locked: state.lockX },
      { x: sensX, y: 0, locked: state.lockX },
      { x: -sensX * DIAG, y: -sensY * DIAG, locked: state.lockX || state.lockY },
      { x: sensX * DIAG, y: -sensY * DIAG, locked: state.lockX || state.lockY },
      { x: -sensX * DIAG, y: sensY * DIAG, locked: state.lockX || state.lockY },
      { x: sensX * DIAG, y: sensY * DIAG, locked: state.lockX || state.lockY }
    ];

    ctx.strokeStyle = futurePositionColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    dirs.forEach(d => {
      if (d.locked) return;
      const cp = coords.mapToCanvas(state.pos.x + d.x, state.pos.y + d.y);
      ctx.beginPath();
      ctx.moveTo(cp.cx - 8, cp.cy); ctx.lineTo(cp.cx + 8, cp.cy);
      ctx.moveTo(cp.cx, cp.cy - 8); ctx.lineTo(cp.cx, cp.cy + 8);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // Absolute overlay: goto crosshair
    const inputX = document.getElementById('inputX');
    const inputY = document.getElementById('inputY');
    if (inputX && inputY) {
      const fx = parseFloat(inputX.value) || 0;
      const fy = parseFloat(inputY.value) || 0;
      if (Math.abs(fx - state.pos.x) > 0.01 || Math.abs(fy - state.pos.y) > 0.01) {
        const cp = coords.mapToCanvas(fx, fy);
        ctx.strokeStyle = futurePositionColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cp.cx - 10, cp.cy); ctx.lineTo(cp.cx + 10, cp.cy);
        ctx.moveTo(cp.cx, cp.cy - 10); ctx.lineTo(cp.cx, cp.cy + 10);
        ctx.stroke();
      }
    }
  }

  static renderHistoryPositions(ctx, state, coords) {
    // Don't show history in Scenario mode
    if (window.EnderTrack?.Scenario?.isActive) return;
    
    const showPositionXYHistory = document.getElementById('showPositionXYHistory');
    const showHistoryXYEnabled = !showPositionXYHistory || showPositionXYHistory.checked;
    
    if (state.positionHistory && showHistoryXYEnabled) {
      const currentHistory = state.historyViewMode === 'XY' ? 
                           state.positionHistoryXY.filter(p => p.isFinalPosition) :
                           state.positionHistory.filter(p => p.isFinalPosition);
      
      const allVisited = state.positionHistory.filter(pos => pos.isFinalPosition);
      const xyGroups = new Map();
      
      allVisited.forEach((pos, allIndex) => {
        const xyKey = `${pos.x.toFixed(2)},${pos.y.toFixed(2)}`;
        if (!xyGroups.has(xyKey)) {
          xyGroups.set(xyKey, []);
        }
        xyGroups.get(xyKey).push({ pos, allIndex });
      });
      
      let displayIndex = 1;
      xyGroups.forEach((group) => {
        const latestItem = group[group.length - 1];
        const { pos } = latestItem;
        const canvasPos = coords.mapToCanvas(pos.x, pos.y);
        const visitedX = canvasPos.cx;
        const visitedY = canvasPos.cy;
        
        if (showHistoryXYEnabled) {
          const historyColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-history').trim();
          group.forEach(item => {
            const groupCanvasPos = coords.mapToCanvas(item.pos.x, item.pos.y);
            const groupPosX = groupCanvasPos.cx;
            const groupPosY = groupCanvasPos.cy;
            ctx.fillStyle = historyColor;
            ctx.beginPath();
            ctx.arc(groupPosX, groupPosY, 1, 0, Math.PI * 2);
            ctx.fill();
          });
        }
        
        if (state.historyMode) {
          const historyIndex = currentHistory.findIndex(h => 
            Math.abs(h.x - pos.x) < 0.01 && Math.abs(h.y - pos.y) < 0.01
          );
          
          if (historyIndex >= 0) {
            const isCurrentHistory = state.historyIndex === historyIndex;
            ctx.fillStyle = isCurrentHistory ? '#4f9eff' : '#ffffff';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const number = state.historyViewMode === 'XY' ? 
              displayIndex.toString() : 
              (group.length > 1 ? `${displayIndex}-${group.length}` : displayIndex.toString());
            
            ctx.strokeText(number, visitedX, visitedY - 12);
            ctx.fillText(number, visitedX, visitedY - 12);
          }
        }
        displayIndex++;
      });
    }
  }

  static renderCurrentPosition(ctx, state, posX, posY) {
    // Vérifier si la position est sur le plateau
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return;
    
    const bounds = coords.getCoordinateBounds();
    const isOnPlateau = state.pos.x >= bounds.minX && state.pos.x <= bounds.maxX &&
                       state.pos.y >= bounds.minY && state.pos.y <= bounds.maxY;
    
    // Ne pas afficher le crosshair si en dehors du plateau
    if (!isOnPlateau) return;
    
    if (posX < -50 || posX > ctx.canvas.width + 50 || 
        posY < -50 || posY > ctx.canvas.height + 50) {
      return;
    }
    
    const crosshairColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-current').trim();
    ctx.strokeStyle = crosshairColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(posX - 10, posY);
    ctx.lineTo(posX + 10, posY);
    ctx.moveTo(posX, posY - 10);
    ctx.lineTo(posX, posY + 10);
    ctx.stroke();
  }


}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.PositionRenderer = PositionRenderer;
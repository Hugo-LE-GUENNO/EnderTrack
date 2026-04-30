// modules/canvas/z-renderers/z-position-renderer.js - Z position rendering
class ZPositionRenderer {
  static render(ctx, canvas, state, zPan, zRange) {
    const zOrientation = state.axisOrientation?.z || 'up';
    const zInverted = zOrientation === 'down' ? -1 : 1;
    
    this.drawCurrentPosition(ctx, canvas, state, zPan, zRange, zInverted);
    this.drawPotentialPositions(ctx, canvas, state, zPan, zRange, zInverted);
    this.drawListPositions(ctx, canvas, state, zPan, zRange, zInverted);
    this.drawVisitedPositions(ctx, canvas, state, zPan, zRange, zInverted);
  }

  static drawCurrentPosition(ctx, canvas, state, zPan, zRange, zInverted) {
    const halfRange = zRange / 2;
    const currentY = canvas.height/2 - (zInverted * (state.pos.z - zPan) / halfRange) * (canvas.height/2);
    
    // Movement vector
    if (window.continuousVector && window.continuousVector.z) {
      this.drawMovementVector(ctx, canvas, currentY, window.continuousVector.z, zInverted);
    }
    
    if (currentY >= 0 && currentY <= canvas.height) {
      const currentPositionColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-current').trim() || '#ffffff';
      ctx.strokeStyle = currentPositionColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, currentY);
      ctx.lineTo(canvas.width, currentY);
      ctx.stroke();
    }
  }

  static drawMovementVector(ctx, canvas, currentY, vector, zInverted) {
    const vectorLength = 20 + (vector.speed * 2);
    const vectorEndY = currentY - (zInverted * vector.dz * vectorLength);
    
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(canvas.width/2, currentY);
    ctx.lineTo(canvas.width/2, vectorEndY);
    ctx.stroke();
    
    // Arrowhead
    const arrowSize = 8;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(canvas.width/2, vectorEndY);
    
    if (vector.dz > 0) {
      ctx.lineTo(canvas.width/2 - arrowSize/2, vectorEndY + arrowSize);
      ctx.lineTo(canvas.width/2 + arrowSize/2, vectorEndY + arrowSize);
    } else {
      ctx.lineTo(canvas.width/2 - arrowSize/2, vectorEndY - arrowSize);
      ctx.lineTo(canvas.width/2 + arrowSize/2, vectorEndY - arrowSize);
    }
    
    ctx.closePath();
    ctx.fill();
  }

  static drawPotentialPositions(ctx, canvas, state, zPan, zRange, zInverted) {
    if (state.historyMode) return;
    
    const showFuturePositionsZ = document.getElementById('showFuturePositionsZ');
    if (showFuturePositionsZ && !showFuturePositionsZ.checked) return;
    
    if (window.EnderTrack?.KeyboardMode?.isActive && (window.controllerMode || 'step') === 'continuous') {
      return;
    }
    
    const halfRange = zRange / 2;
    
    if (!state.lockZ) {
      this.drawRelativePotentials(ctx, canvas, state, zPan, halfRange, zInverted);
    }
    this.drawAbsolutePotential(ctx, canvas, state, zPan, halfRange, zInverted);
  }

  static drawRelativePotentials(ctx, canvas, state, zPan, halfRange, zInverted) {
    const zSlider = document.getElementById('sensitivityZ');
    const sensitivityZ = (zSlider ? parseFloat(zSlider.value) : null) || state.sensitivityZ || 0.5;
    const potentialColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-potential').trim() || '#ffc107';
    
    // Z up position
    const zUpY = canvas.height/2 - (zInverted * ((state.pos.z + sensitivityZ) - zPan) / halfRange) * (canvas.height/2);
    if (zUpY >= 0 && zUpY <= canvas.height) {
      ctx.strokeStyle = potentialColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(5, zUpY);
      ctx.lineTo(canvas.width - 5, zUpY);
      ctx.stroke();
    }
    
    // Z down position
    const zDownY = canvas.height/2 - (zInverted * ((state.pos.z - sensitivityZ) - zPan) / halfRange) * (canvas.height/2);
    if (zDownY >= 0 && zDownY <= canvas.height) {
      ctx.strokeStyle = potentialColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(5, zDownY);
      ctx.lineTo(canvas.width - 5, zDownY);
      ctx.stroke();
    }
  }

  static drawAbsolutePotential(ctx, canvas, state, zPan, halfRange, zInverted) {
    const inputZ = document.getElementById('inputZ');
    if (inputZ) {
      const futureZ = parseFloat(inputZ.value) || 0;
      if (futureZ !== state.pos.z) {
        const futureY = canvas.height/2 - (zInverted * (futureZ - zPan) / halfRange) * (canvas.height/2);
        if (futureY >= 0 && futureY <= canvas.height) {
          const potentialColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-potential').trim() || '#ffc107';
          const distanceFromCurrent = Math.abs(futureY - (canvas.height/2 - (zInverted * (state.pos.z - zPan) / halfRange) * (canvas.height/2)));
          
          if (distanceFromCurrent < 5) {
            ctx.strokeStyle = potentialColor;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 4]);
          } else {
            ctx.strokeStyle = potentialColor;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
          }
          
          ctx.beginPath();
          ctx.moveTo(0, futureY);
          ctx.lineTo(canvas.width, futureY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  }

  static drawCursorPosition(ctx, canvas, state, zPan, zRange, zInverted) {
    // Récupérer mouseZ depuis l'instance ZVisualization
    const mouseZ = window.EnderTrack?.ZVisualization?.mouseZ;
    if (mouseZ === null || mouseZ === undefined) return;
    
    const halfRange = zRange / 2;
    const cursorY = canvas.height/2 - (zInverted * (mouseZ - zPan) / halfRange) * (canvas.height/2);
    
    if (cursorY >= 0 && cursorY <= canvas.height) {
      const cursorColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-cursor').trim() || '#00bcd4';
      ctx.strokeStyle = cursorColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, cursorY);
      ctx.lineTo(canvas.width, cursorY);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  static drawListPositions(ctx, canvas, state, zPan, zRange, zInverted) {
    if (!window.EnderTrack?.Lists) return;
    const Lists = window.EnderTrack.Lists;
    const tab = state.activeTab;
    const halfRange = zRange / 2;
    const scenarioListId = window.EnderTrack?.Scenario?.selectedListId;

    Lists.groups.forEach(g => {
      const isActiveGroup = g.id === Lists.activeGroupId;
      let show;
      if (tab === 'lists') show = isActiveGroup;
      else if (tab === 'acquisition') show = String(g.id) === String(scenarioListId);
      else show = g.pinned;
      if (!show || !g.positions?.length) return;

      // Group points by Z (rounded to 0.01) to handle overlaps
      const byZ = new Map();
      g.positions.forEach((p, idx) => {
        const zKey = Math.round(p.z * 100);
        if (!byZ.has(zKey)) byZ.set(zKey, []);
        byZ.get(zKey).push({ p, idx });
      });

      const color = g.color || '#4a90e2';
      const executing = window.EnderTrack?.Scenario?.isExecuting;
      const track = executing && window.EnderTrack?.Scenario?.scenarioTrack;

      byZ.forEach((points, zKey) => {
        const z = zKey / 100;
        const y = canvas.height / 2 - (zInverted * (z - zPan) / halfRange) * (canvas.height / 2);
        if (y < -10 || y > canvas.height + 10) return;

        const count = points.length;
        const r = 5;
        const spacing = Math.min(r * 2.5, (canvas.width - 20) / Math.max(count, 1));
        const startX = canvas.width / 2 - ((count - 1) * spacing) / 2;

        points.forEach(({ p, idx }, i) => {
          const cx = startX + i * spacing;
          const isSel = isActiveGroup && idx === Lists.selectedIdx && Lists.isActive;
          const isHov = isActiveGroup && idx === Lists.hoveredIdx && Lists.isActive;

          // Point color
          if (track) {
            const key = `${p.x},${p.y}`;
            const currentKey = track.current ? `${track.current.x},${track.current.y}` : null;
            const visitedSet = new Set(track.visited.map(v => `${v.x},${v.y}`));
            if (key === currentKey) ctx.fillStyle = '#ffc107';
            else if (visitedSet.has(key)) ctx.fillStyle = '#4caf50';
            else ctx.fillStyle = '#555';
          } else {
            ctx.fillStyle = color;
          }

          ctx.globalAlpha = isSel ? 1 : (isHov ? 0.9 : 0.7);
          ctx.beginPath();
          ctx.arc(cx, y, isSel ? 7 : (isHov ? 6 : r), 0, Math.PI * 2);
          ctx.fill();

          // Number
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(idx + 1, cx, y);
          ctx.globalAlpha = 1;

          // Selection / hover ring
          if (isSel) {
            ctx.strokeStyle = '#ffc107';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, y, 9, 0, Math.PI * 2);
            ctx.stroke();
          } else if (isHov) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.arc(cx, y, 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        });
      });
    });
  }

  static drawVisitedPositions(ctx, canvas, state, zPan, zRange, zInverted) {
    const showPositionZHistory = document.getElementById('showPositionZHistory');
    if (showPositionZHistory && !showPositionZHistory.checked) return;
    
    const halfRange = zRange / 2;
    
    if (state.positionHistory && state.positionHistory.length > 1) {
      const visited = state.positionHistory.filter(pos => pos.isFinalPosition);
      const historyColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-history').trim() || '#888888';
      
      visited.forEach((pos, index) => {
        const visitedY = canvas.height/2 - (zInverted * (pos.z - zPan) / halfRange) * (canvas.height/2);
        if (visitedY >= 0 && visitedY <= canvas.height) {
          if (Math.abs(pos.z - state.pos.z) > 0.01) {
            ctx.strokeStyle = historyColor;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            ctx.moveTo(0, visitedY);
            ctx.lineTo(canvas.width, visitedY);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          
          if (state.historyMode) {
            const isCurrentHistory = state.historyIndex === index;
            ctx.fillStyle = isCurrentHistory ? '#4f9eff' : '#ffffff';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const number = (index + 1).toString();
            ctx.strokeText(number, canvas.width - 15, visitedY);
            ctx.fillText(number, canvas.width - 15, visitedY);
          }
        }
      });
    }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ZPositionRenderer = ZPositionRenderer;
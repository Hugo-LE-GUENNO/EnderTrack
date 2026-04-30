// modules/canvas/renderers/track-renderer.js - Track and path rendering
class TrackRenderer {
  static render(ctx, canvas, state) {
    // Don't render tracks in Scenario mode
    if (window.EnderTrack?.Scenario?.isActive) return;
    
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return;
    
    this.renderContinuousTrack(ctx, state, coords);
    // this.renderDiscreteTrack(ctx, state, coords); // Désactivé pour éviter le double tracé
    this.renderTrackPoints(ctx, state, coords);
    this.renderListTracks(ctx, state, coords);
  }

  static renderContinuousTrack(ctx, state, coords) {
    const showTrackFree = document.getElementById('showTrackFree');
    const showTrackFreeEnabled = !showTrackFree || showTrackFree.checked;
    
    if (showTrackFreeEnabled && state.continuousTrack && state.continuousTrack.length > 1) {
      const historyColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-history').trim() || '#888888';
      ctx.strokeStyle = historyColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.2;
      
      // Draw track in real-time as it's being created
      for (let i = 0; i < state.continuousTrack.length - 1; i++) {
        const point = state.continuousTrack[i];
        const nextPoint = state.continuousTrack[i + 1];
        
        const canvasPos = coords.mapToCanvas(point.x, point.y);
        const nextCanvasPos = coords.mapToCanvas(nextPoint.x, nextPoint.y);
        
        ctx.beginPath();
        ctx.moveTo(canvasPos.cx, canvasPos.cy);
        ctx.lineTo(nextCanvasPos.cx, nextCanvasPos.cy);
        ctx.stroke();
      }
      
      ctx.globalAlpha = 1;
    }
  }

  static renderDiscreteTrack(ctx, state, coords) {
    const showTrackPositions = document.getElementById('showTrackPositions');
    const showTrackPositionsEnabled = !showTrackPositions || showTrackPositions.checked;
    
    if (showTrackPositionsEnabled && state.track.length > 1) {
      const historyColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-history').trim() || '#888888';
      ctx.strokeStyle = historyColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.2;
      
      // Draw track in real-time as it's being created
      for (let i = 0; i < state.track.length - 1; i++) {
        const point = state.track[i];
        const nextPoint = state.track[i + 1];
        
        const canvasPos = coords.mapToCanvas(point.x, point.y);
        const nextCanvasPos = coords.mapToCanvas(nextPoint.x, nextPoint.y);
        
        ctx.beginPath();
        ctx.moveTo(canvasPos.cx, canvasPos.cy);
        ctx.lineTo(nextCanvasPos.cx, nextCanvasPos.cy);
        ctx.stroke();
      }
      
      ctx.globalAlpha = 1;
    }
  }

  static renderTrackPoints(ctx, state, coords) {
    const showTrackPositions = document.getElementById('showTrackPositions');
    const showPositionXYHistory = document.getElementById('showPositionXYHistory');
    const showTrackPositionsEnabled = !showTrackPositions || showTrackPositions.checked;
    const showHistoryXYEnabled = !showPositionXYHistory || showPositionXYHistory.checked;
    
    if (showTrackPositionsEnabled && showHistoryXYEnabled && state.track.length > 0) {
      const historyColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-history').trim() || '#888888';
      ctx.fillStyle = historyColor;
      ctx.globalAlpha = 0.3;
      
      for (const point of state.track) {
        const canvasPos = coords.mapToCanvas(point.x, point.y);
        const posX = canvasPos.cx;
        const posY = canvasPos.cy;
        
        if (posX >= -10 && posX <= ctx.canvas.width + 10 && 
            posY >= -10 && posY <= ctx.canvas.height + 10) {
          ctx.beginPath();
          ctx.arc(posX, posY, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      ctx.globalAlpha = 1;
    }
  }

  static renderListTracks(ctx, state, coords) {
    // Rendu des trajectoires des listes
    if (window.EnderTrack?.Lists?.getListTracks) {
      const listTracks = window.EnderTrack.Lists.getListTracks();
      
      for (const track of listTracks) {
        if (track.segments && track.segments.length > 0) {
          ctx.strokeStyle = track.color;
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.8;
          
          for (const segment of track.segments) {
            const fromPos = coords.mapToCanvas(segment.from.x, segment.from.y);
            const toPos = coords.mapToCanvas(segment.to.x, segment.to.y);
            const fromX = fromPos.cx;
            const fromY = fromPos.cy;
            const toX = toPos.cx;
            const toY = toPos.cy;
            
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.stroke();
            
            // Flèche directionnelle
            const angle = Math.atan2(toY - fromY, toX - fromX);
            const arrowLength = 8;
            const arrowAngle = Math.PI / 6;
            
            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(
              toX - arrowLength * Math.cos(angle - arrowAngle),
              toY - arrowLength * Math.sin(angle - arrowAngle)
            );
            ctx.moveTo(toX, toY);
            ctx.lineTo(
              toX - arrowLength * Math.cos(angle + arrowAngle),
              toY - arrowLength * Math.sin(angle + arrowAngle)
            );
            ctx.stroke();
          }
          
          ctx.globalAlpha = 1;
        }
      }
    }
    
    // Rendu des tracks de preview
    if (window.EnderTrack?.Lists?.getPreviewTracks) {
      const previewTracks = window.EnderTrack.Lists.getPreviewTracks();
      
      for (const track of previewTracks) {
        if (track.segments && track.segments.length > 0) {
          ctx.strokeStyle = track.color;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.6;
          ctx.setLineDash([5, 5]);
          
          for (const segment of track.segments) {
            const fromPos = coords.mapToCanvas(segment.from.x, segment.from.y);
            const toPos = coords.mapToCanvas(segment.to.x, segment.to.y);
            const fromX = fromPos.cx;
            const fromY = fromPos.cy;
            const toX = toPos.cx;
            const toY = toPos.cy;
            
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.stroke();
          }
          
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
      }
    }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.TrackRenderer = TrackRenderer;
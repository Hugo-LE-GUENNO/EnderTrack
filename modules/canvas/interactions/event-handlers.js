// modules/canvas/interactions/event-handlers.js - Gestionnaires d'événements de base

class EventHandlers {
  constructor(interactions) {
    this.interactions = interactions;
  }

  setupMouseEvents(canvas) {
    canvas.addEventListener('mousedown', (e) => {
      this.interactions.handlePointerStart(e.clientX, e.clientY, e);
    });
    
    canvas.addEventListener('mousemove', (e) => {
      this.interactions.handlePointerMove(e.clientX, e.clientY, e);
    });
    
    canvas.addEventListener('mouseup', (e) => {
      this.interactions.handlePointerEnd(e.clientX, e.clientY, e);
    });
    
    canvas.addEventListener('mouseleave', (e) => {
      this.interactions.clearMouseCoordinates();
      this.interactions.compassHovered = false;
      canvas.classList.remove('crosshair-cursor');
      canvas.style.cursor = '';
      if (EnderTrack.Canvas) {
        EnderTrack.Canvas.compassHovered = false;
        EnderTrack.Canvas.requestRender();
      }
      this.interactions.handlePointerEnd(e.clientX, e.clientY, e);
    });
    
    canvas.addEventListener('click', (e) => {
      if (e._overlayHandled || e._listHandled) return;
      if (this.interactions._dragMoved) { this.interactions._dragMoved = false; return; }
      this.interactions.handleClick(e.clientX, e.clientY, e);
    });
    
    canvas.addEventListener('dblclick', (e) => {
      this.interactions.handleDoubleClick(e.clientX, e.clientY, e);
    });
    
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  setupTouchEvents(canvas) {
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        this.interactions.handlePointerStart(touch.clientX, touch.clientY, e);
      } else if (e.touches.length === 2) {
        this.interactions.handlePinchStart(e);
      }
    });
    
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        this.interactions.handlePointerMove(touch.clientX, touch.clientY, e);
      } else if (e.touches.length === 2) {
        this.interactions.handlePinchMove(e);
      }
    });
    
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      
      if (e.touches.length === 0) {
        this.interactions.handlePointerEnd(0, 0, e);
      }
    });
  }

  setupKeyboardEvents(canvas) {
    canvas.tabIndex = 0;
    
    canvas.addEventListener('keydown', (e) => {
      this.interactions.handleKeyDown(e);
    });
    
    canvas.addEventListener('keyup', (e) => {
      this.interactions.handleKeyUp(e);
    });
  }

  setupWheelEvents(canvas) {
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom on trackpad or Ctrl+scroll → zoom
        this.interactions.handleWheel(e);
      } else if (e.deltaMode === 0 && Math.abs(e.deltaX) > 1) {
        // Trackpad 2-finger scroll (has horizontal component, pixel mode) → pan
        this.interactions.zoomPanHandler.handlePan(-e.deltaX, -e.deltaY);
        window.EnderTrack.Canvas?.requestRender?.();
      } else if (e.deltaMode === 0 && Math.abs(e.deltaY) < 50 && !Number.isInteger(e.deltaY)) {
        // Trackpad vertical scroll (small fractional deltas) → pan
        this.interactions.zoomPanHandler.handlePan(0, -e.deltaY);
        window.EnderTrack.Canvas?.requestRender?.();
      } else {
        // Mouse wheel (deltaMode 1 = lines, or large integer deltas) → zoom
        this.interactions.handleWheel(e);
      }
    }, { passive: false });
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.EventHandlers = EventHandlers;
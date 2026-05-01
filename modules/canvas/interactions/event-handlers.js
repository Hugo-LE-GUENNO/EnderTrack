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
      if (e.ctrlKey) {
        // Pinch-to-zoom on trackpad (or Ctrl+scroll)
        this.interactions.handleWheel(e);
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.5 || !e.deltaMode) {
        // Two-finger scroll on trackpad → pan
        // deltaMode 0 = pixels (trackpad), 1 = lines (mouse wheel)
        if (Math.abs(e.deltaX) > 2 || Math.abs(e.deltaY) > 2) {
          this.interactions.zoomPanHandler.handlePan(-e.deltaX * 0.5, -e.deltaY * 0.5);
          window.EnderTrack.Canvas?.requestRender?.();
        } else {
          this.interactions.handleWheel(e);
        }
      } else {
        // Mouse wheel → zoom
        this.interactions.handleWheel(e);
      }
    }, { passive: false });
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.EventHandlers = EventHandlers;
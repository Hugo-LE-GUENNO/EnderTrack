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
    
    // Delayed click to distinguish from double-click
    let _clickTimer = null;
    canvas.addEventListener('click', (e) => {
      if (e._overlayHandled || e._listHandled) return;
      if (this.interactions._dragMoved) { this.interactions._dragMoved = false; return; }
      if (Date.now() - (this.interactions._lastPanTime || 0) < 300) return;
      if (_clickTimer) { clearTimeout(_clickTimer); _clickTimer = null; return; }
      const cx = e.clientX, cy = e.clientY, ev = e;
      _clickTimer = setTimeout(() => {
        _clickTimer = null;
        this.interactions.handleClick(cx, cy, ev);
      }, 250);
    });
    
    canvas.addEventListener('dblclick', (e) => {
      if (_clickTimer) { clearTimeout(_clickTimer); _clickTimer = null; }
      this.interactions._dblClickPan = true;
      this.interactions.handleDoubleClick(e.clientX, e.clientY, e);
    });
    
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  setupTouchEvents(canvas) {
    let _touchStart = null;
    let _touchMoved = false;

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        _touchStart = { x: touch.clientX, y: touch.clientY, time: Date.now() };
        _touchMoved = false;
        this.interactions.handlePointerStart(touch.clientX, touch.clientY, e);
      } else if (e.touches.length === 2) {
        _touchStart = null;
        this.interactions.handlePinchStart(e);
      }
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (_touchStart && Math.hypot(touch.clientX - _touchStart.x, touch.clientY - _touchStart.y) > 15) {
          _touchMoved = true;
        }
        this.interactions.handlePointerMove(touch.clientX, touch.clientY, e);
      } else if (e.touches.length === 2) {
        this.interactions.handlePinchMove(e);
      }
    });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (e.touches.length === 0 && _touchStart) {
        const dt = Date.now() - _touchStart.time;
        this.interactions.handlePointerEnd(_touchStart.x, _touchStart.y, e);
        // Tap: short touch without movement → trigger click
        if (!_touchMoved && !this.interactions._dragMoved && dt < 300) {
          this.interactions.handleClick(_touchStart.x, _touchStart.y, e);
        }
        _touchStart = null;
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
        this.interactions.handleWheel(e);
      } else if (e.deltaMode === 1) {
        this.interactions.handleWheel(e);
      } else {
        this.interactions.zoomPanHandler.handlePan(-e.deltaX, -e.deltaY);
        this.interactions._lastPanTime = Date.now();
        window.EnderTrack.Canvas?.requestRender?.();
      }
    }, { passive: false });
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.EventHandlers = EventHandlers;
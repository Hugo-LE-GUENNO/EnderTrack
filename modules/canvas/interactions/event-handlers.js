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
    
    // Immediate click — dblclick cleans up any dialog
    canvas.addEventListener('click', (e) => {
      if (e._overlayHandled || e._listHandled) return;
      if (this.interactions._dragMoved) { this.interactions._dragMoved = false; return; }
      if (Date.now() - (this.interactions._lastPanTime || 0) < 300) return;
      this.interactions.handleClick(e.clientX, e.clientY, e);
    });
    
    canvas.addEventListener('dblclick', (e) => {
      document.querySelector('.click-and-go-dialog')?.remove();
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
      // Skip if overlay is handling this touch
      if (window.EnderTrack?.Overlays?._dragging) return;
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        this.interactions.handlePointerStart(touch.clientX, touch.clientY, e);
      } else if (e.touches.length === 2) {
        _touchStart = null;
        this._isPinching = true;
        this.interactions.handlePinchStart(e);
      }
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (window.EnderTrack?.Overlays?._dragging) return;
      if (e.touches.length === 1) {
        if (this._isPinching) return;
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
      if (this._isPinching) {
        if (e.touches.length === 0) {
          this._isPinching = false;
          this.interactions._lastPanTime = Date.now();
        }
        return;
      }
      if (e.touches.length === 0 && _touchStart) {
        const dt = Date.now() - _touchStart.time;
        this.interactions.handlePointerEnd(_touchStart.x, _touchStart.y, e);

        // Tap: short touch, small movement
        const dist = Math.hypot(
          (e.changedTouches?.[0]?.clientX || _touchStart.x) - _touchStart.x,
          (e.changedTouches?.[0]?.clientY || _touchStart.y) - _touchStart.y
        );
        if (!this.interactions._dragMoved && dist < 20 && dt < 400) {
          const ts = { ..._touchStart };
          const canvas = this.interactions.canvas;
          // Dispatch real DOM click for Lists module
          const clickEvt = new MouseEvent('click', {
            clientX: ts.x, clientY: ts.y, bubbles: true, cancelable: true
          });
          canvas.dispatchEvent(clickEvt);
          this.interactions.handleClick(ts.x, ts.y, clickEvt);
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
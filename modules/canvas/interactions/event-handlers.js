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
      let d = document.getElementById('_dbg'); if (!d) { d = document.createElement('div'); d.id = '_dbg'; d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#000;color:#0f0;font:11px monospace;padding:4px;max-height:30vh;overflow:auto;'; document.body.appendChild(d); } d.innerHTML = 'click event: touch=' + !!e._fromTouch + ' drag=' + this.interactions._dragMoved + ' panAge=' + (Date.now() - (this.interactions._lastPanTime || 0)) + '<br>' + d.innerHTML;
      if (e._overlayHandled || e._listHandled) return;
      if (!e._fromTouch) {
        if (this.interactions._dragMoved) { this.interactions._dragMoved = false; return; }
        if (Date.now() - (this.interactions._lastPanTime || 0) < 300) return;
      }
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
        _touchStart = { x: touch.clientX, y: touch.clientY, time: Date.now() };
        _touchMoved = false;
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
        }
        return;
      }
      if (e.touches.length === 0 && _touchStart) {
        const dt = Date.now() - _touchStart.time;

        // Reset drag state without triggering _lastPanTime
        this.interactions.isDragging = false;
        this.interactions.isPanning = false;
        this.interactions.canvas.style.cursor = '';

        // Tap detection: small movement + short duration
        const endTouch = e.changedTouches?.[0];
        const dist = endTouch ? Math.hypot(endTouch.clientX - _touchStart.x, endTouch.clientY - _touchStart.y) : 0;

        if (dist < 20 && dt < 400 && !this.interactions._dragMoved) {
          let d = document.getElementById('_dbg'); if (!d) { d = document.createElement('div'); d.id = '_dbg'; d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#000;color:#0f0;font:11px monospace;padding:4px;max-height:30vh;overflow:auto;'; document.body.appendChild(d); } d.innerHTML = 'TAP dist=' + Math.round(dist) + ' dt=' + dt + '<br>' + d.innerHTML;
          // Dispatch DOM click for Lists module, then handleClick for click-and-go
          const clickEvt = new MouseEvent('click', {
            clientX: _touchStart.x, clientY: _touchStart.y, bubbles: true, cancelable: true
          });
          clickEvt._fromTouch = true;
          this.interactions.canvas.dispatchEvent(clickEvt);
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
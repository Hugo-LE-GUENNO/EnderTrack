// modules/image/gallery-renderer.js — Applies contrast + LUT to gallery/stack images

class GalleryRenderer {
  constructor() {
    this._rawCanvas = document.createElement('canvas');
    this._rawCtx = this._rawCanvas.getContext('2d', { willReadFrequently: true });
    this._displayCanvas = null;
    this._rawData = null; // ImageData of raw image
    this._lutTable = null;
    this.lutId = 'gray';
    this.min = 0;
    this.max = 255;
  }

  // Load image from URL into raw buffer
  async loadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this._rawCanvas.width = img.width;
        this._rawCanvas.height = img.height;
        this._rawCtx.drawImage(img, 0, 0);
        this._rawData = this._rawCtx.getImageData(0, 0, img.width, img.height);
        this.render();
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  // Set display canvas (the one visible in viewport)
  setDisplayCanvas(canvas) {
    this._displayCanvas = canvas;
  }

  // Update contrast from histogram
  setContrast(min, max) {
    this.min = min;
    this.max = max;
    this.render();
  }

  // Update LUT
  setLut(lutId) {
    this.lutId = lutId;
    const def = window.CameraLUTs?.[lutId];
    this._lutTable = def ? def.generate() : null;
    this.render();
  }

  // Render raw image with contrast + LUT applied
  render() {
    if (!this._rawData || !this._displayCanvas) return;
    const src = this._rawData.data;
    const w = this._rawData.width, h = this._rawData.height;
    this._displayCanvas.width = w;
    this._displayCanvas.height = h;
    const ctx = this._displayCanvas.getContext('2d');
    const out = ctx.createImageData(w, h);
    const dst = out.data;

    const min = this.min, max = this.max;
    const range = Math.max(1, max - min);
    const lut = this._lutTable;

    for (let i = 0; i < src.length; i += 4) {
      // Luminance from raw
      const lum = Math.round(0.299 * src[i] + 0.587 * src[i+1] + 0.114 * src[i+2]);
      // Apply contrast stretch
      const stretched = Math.max(0, Math.min(255, Math.round(((lum - min) / range) * 255)));

      if (lut) {
        const c = lut[stretched];
        dst[i] = c[0]; dst[i+1] = c[1]; dst[i+2] = c[2];
      } else {
        dst[i] = stretched; dst[i+1] = stretched; dst[i+2] = stretched;
      }
      dst[i+3] = 255;
    }

    ctx.putImageData(out, 0, 0);
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.GalleryRenderer = new GalleryRenderer();

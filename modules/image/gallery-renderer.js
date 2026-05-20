// modules/image/gallery-renderer.js — Applies contrast + LUT to gallery/stack images
// Handles 8-bit and 16-bit raw data, grayscale and RGB

class GalleryRenderer {
  constructor() {
    this._displayCanvas = null;
    this._rawPixels = null; // Float32Array or Uint8Array of raw values
    this._width = 0;
    this._height = 0;
    this._channels = 1; // 1=grayscale, 3=RGB
    this._dtype = 'uint8'; // 'uint8' or 'uint16'
    this._maxVal = 255;
    this._lutTable = null;
    this.lutId = 'gray';
    this.min = 0;
    this.max = 255;
    this.rgbMode = false; // true = show as RGB (no LUT), false = grayscale + LUT
  }

  setDisplayCanvas(canvas) {
    this._displayCanvas = canvas;
  }

  // Load from a standard image URL (8-bit PNG/JPG)
  async loadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height).data;
        this._width = img.width;
        this._height = img.height;
        this._dtype = 'uint8';
        this._maxVal = 255;
        // Detect if grayscale (R==G==B for all pixels sample)
        let isGray = true;
        for (let i = 0; i < Math.min(data.length, 400); i += 4) {
          if (data[i] !== data[i+1] || data[i] !== data[i+2]) { isGray = false; break; }
        }
        this._channels = isGray ? 1 : 3;
        // Only set rgbMode if no saved settings are active
        if (this.lutId === 'gray' && this.min === 0 && this.max === 255) {
          this.rgbMode = !isGray;
        }
        // Store raw as float for uniform processing
        this._rawPixels = new Float32Array(this._width * this._height * (isGray ? 1 : 3));
        for (let i = 0; i < this._width * this._height; i++) {
          if (isGray) {
            this._rawPixels[i] = data[i * 4];
          } else {
            this._rawPixels[i * 3] = data[i * 4];
            this._rawPixels[i * 3 + 1] = data[i * 4 + 1];
            this._rawPixels[i * 3 + 2] = data[i * 4 + 2];
          }
        }
        this._dataMin = 0;
        this._dataMax = 255;
        this.min = 0;
        this.max = 255;
        if (!this._skipAutoRender) this.render();
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  // Load from raw data endpoint (16-bit TIFF support)
  async loadRaw(filepath, index) {
    const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
    try {
      const res = await fetch(base + '/api/stack/raw?file=' + encodeURIComponent(filepath) + '&index=' + (index || 0));
      const data = await res.json();
      if (data.error) return false;

      this._width = data.width;
      this._height = data.height;
      this._channels = data.channels;
      this._dtype = data.dtype;
      this._maxVal = data.dtype === 'uint16' ? 65535 : 255;

      // Decode base64 raw data
      const binary = atob(data.data);
      const buffer = new ArrayBuffer(binary.length);
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      if (data.dtype === 'uint16') {
        const u16 = new Uint16Array(buffer);
        this._rawPixels = new Float32Array(u16.length);
        for (let i = 0; i < u16.length; i++) this._rawPixels[i] = u16[i];
      } else {
        this._rawPixels = new Float32Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) this._rawPixels[i] = bytes[i];
      }

      this.rgbMode = this._channels >= 3;
      // For 16-bit: auto-contrast by default (otherwise image is black)
      if (data.dtype === 'uint16') {
        const stats = this.getRawStats();
        this._dataMin = stats.min;
        this._dataMax = stats.max;
        this.min = stats.min;
        this.max = stats.max;
      } else {
        this._dataMin = 0;
        this._dataMax = 255;
        this.min = 0;
        this.max = 255;
      }
      if (!this._skipAutoRender) this.render();
      return true;
    } catch(e) { return false; }
  }

  setContrast(min, max) {
    // min/max from histogram (0-255) mapped to actual data range
    const dataMin = this._dataMin || 0;
    const dataMax = this._dataMax || this._maxVal;
    this.min = dataMin + (min / 255) * (dataMax - dataMin);
    this.max = dataMin + (max / 255) * (dataMax - dataMin);
    if (!this._renderPending) {
      this._renderPending = true;
      requestAnimationFrame(() => { this._renderPending = false; this.render(); });
    }
  }

  setLut(lutId) {
    this.lutId = lutId;
    const def = window.CameraLUTs?.[lutId];
    this._lutTable = def ? def.generate() : null;
    this.rgbMode = false;
    this.render();
  }

  setRgbMode(enabled) {
    this.rgbMode = enabled;
    this.render();
  }

  // Get raw pixel stats for histogram
  getRawStats() {
    if (!this._rawPixels) return { min: 0, max: 255 };
    let mn = Infinity, mx = -Infinity;
    const step = Math.max(1, Math.floor(this._rawPixels.length / 10000));
    for (let i = 0; i < this._rawPixels.length; i += step) {
      if (this._rawPixels[i] < mn) mn = this._rawPixels[i];
      if (this._rawPixels[i] > mx) mx = this._rawPixels[i];
    }
    return { min: mn, max: mx };
  }

  render() {
    if (!this._rawPixels || !this._displayCanvas) return;
    const w = this._width, h = this._height;
    this._displayCanvas.width = w;
    this._displayCanvas.height = h;
    const ctx = this._displayCanvas.getContext('2d');
    const out = ctx.createImageData(w, h);
    const dst = out.data;

    const min = this.min, max = this.max;
    const range = Math.max(1, max - min);
    const lut = this._lutTable;
    const nPx = w * h;

    if (this.rgbMode && this._channels >= 3) {
      // RGB mode: apply contrast per channel, no LUT
      for (let i = 0; i < nPx; i++) {
        const r = Math.max(0, Math.min(255, Math.round(((this._rawPixels[i*3] - min) / range) * 255)));
        const g = Math.max(0, Math.min(255, Math.round(((this._rawPixels[i*3+1] - min) / range) * 255)));
        const b = Math.max(0, Math.min(255, Math.round(((this._rawPixels[i*3+2] - min) / range) * 255)));
        dst[i*4] = r; dst[i*4+1] = g; dst[i*4+2] = b; dst[i*4+3] = 255;
      }
    } else {
      // Grayscale mode: luminance + LUT
      for (let i = 0; i < nPx; i++) {
        let val;
        if (this._channels >= 3) {
          val = 0.299 * this._rawPixels[i*3] + 0.587 * this._rawPixels[i*3+1] + 0.114 * this._rawPixels[i*3+2];
        } else {
          val = this._rawPixels[i];
        }
        const stretched = Math.max(0, Math.min(255, Math.round(((val - min) / range) * 255)));
        if (lut) {
          const c = lut[stretched];
          dst[i*4] = c[0]; dst[i*4+1] = c[1]; dst[i*4+2] = c[2];
        } else {
          dst[i*4] = stretched; dst[i*4+1] = stretched; dst[i*4+2] = stretched;
        }
        dst[i*4+3] = 255;
      }
    }

    ctx.putImageData(out, 0, 0);
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.GalleryRenderer = new GalleryRenderer();

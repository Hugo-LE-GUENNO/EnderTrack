// plugins/enderpicam/luts.js
// Microscopy LUT definitions — each is an array of 256 [r,g,b] values

window.CameraLUTs = {
  // No LUT — grayscale
  gray: { name: 'Grayscale', generate: () => {
    const t = []; for (let i = 0; i < 256; i++) t.push([i, i, i]); return t;
  }},

  // Fire (ImageJ classic) — black → red → yellow → white
  fire: { name: 'Fire', generate: () => {
    const t = [];
    for (let i = 0; i < 256; i++) {
      const r = i < 64 ? i * 4 : 255;
      const g = i < 64 ? 0 : i < 192 ? (i - 64) * 2 : 255;
      const b = i < 192 ? 0 : (i - 192) * 4;
      t.push([Math.min(255, r), Math.min(255, g), Math.min(255, b)]);
    }
    return t;
  }},

  // Ice — black → blue → cyan → white
  ice: { name: 'Ice', generate: () => {
    const t = [];
    for (let i = 0; i < 256; i++) {
      const r = i < 128 ? 0 : (i - 128) * 2;
      const g = i < 64 ? 0 : i < 192 ? (i - 64) * 2 : 255;
      const b = Math.min(255, i * 2);
      t.push([Math.min(255, r), Math.min(255, g), Math.min(255, b)]);
    }
    return t;
  }},

  // Green (fluorescence) — black → green
  green: { name: 'Green', generate: () => {
    const t = []; for (let i = 0; i < 256; i++) t.push([0, i, 0]); return t;
  }},

  // Red (fluorescence) — black → red
  red: { name: 'Red', generate: () => {
    const t = []; for (let i = 0; i < 256; i++) t.push([i, 0, 0]); return t;
  }},

  // Blue (fluorescence) — black → blue
  blue: { name: 'Blue', generate: () => {
    const t = []; for (let i = 0; i < 256; i++) t.push([0, 0, i]); return t;
  }},

  // Cyan — black → cyan
  cyan: { name: 'Cyan', generate: () => {
    const t = []; for (let i = 0; i < 256; i++) t.push([0, i, i]); return t;
  }},

  // Magenta — black → magenta
  magenta: { name: 'Magenta', generate: () => {
    const t = []; for (let i = 0; i < 256; i++) t.push([i, 0, i]); return t;
  }},

  // Yellow — black → yellow
  yellow: { name: 'Yellow', generate: () => {
    const t = []; for (let i = 0; i < 256; i++) t.push([i, i, 0]); return t;
  }},

  // Viridis (matplotlib-inspired) — purple → teal → yellow
  viridis: { name: 'Viridis', generate: () => {
    const t = [];
    for (let i = 0; i < 256; i++) {
      const n = i / 255;
      const r = (68 + n * (253 - 68)) | 0;
      const g = (1 + n * (231 - 1)) | 0;
      const b = n < 0.5 ? (84 + n * 2 * (168 - 84)) | 0 : (168 - (n - 0.5) * 2 * (168 - 37)) | 0;
      t.push([Math.min(255, r), Math.min(255, g), Math.min(255, b)]);
    }
    return t;
  }},

  // Thermal — black → blue → magenta → red → yellow → white
  thermal: { name: 'Thermal', generate: () => {
    const t = [];
    const stops = [
      [0, 0, 0, 0], [0.2, 0, 0, 180], [0.4, 180, 0, 180],
      [0.6, 255, 0, 0], [0.8, 255, 255, 0], [1.0, 255, 255, 255]
    ];
    for (let i = 0; i < 256; i++) {
      const n = i / 255;
      let s0 = stops[0], s1 = stops[1];
      for (let j = 1; j < stops.length; j++) {
        if (n <= stops[j][0]) { s0 = stops[j - 1]; s1 = stops[j]; break; }
      }
      const f = (n - s0[0]) / (s1[0] - s0[0]);
      t.push([
        (s0[1] + f * (s1[1] - s0[1])) | 0,
        (s0[2] + f * (s1[2] - s0[2])) | 0,
        (s0[3] + f * (s1[3] - s0[3])) | 0
      ]);
    }
    return t;
  }},

  // HiLo — saturated pixels in red, minimum pixels in blue, rest grayscale
  hilo: { name: 'HiLo', generate: () => {
    const t = [];
    t.push([0, 0, 255]); // 0 = blue (underexposed)
    for (let i = 1; i < 255; i++) t.push([i, i, i]); // 1-254 = grayscale
    t.push([255, 0, 0]); // 255 = red (saturated)
    return t;
  }}
};

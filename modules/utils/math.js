// modules/utils/math.js - Mathematical utilities
// Pure math functions with no dependencies

class MathUtils {
  // Distance calculations
  static distance2D(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  static distance3D(x1, y1, z1, x2, y2, z2) {
    return Math.sqrt(
      Math.pow(x2 - x1, 2) + 
      Math.pow(y2 - y1, 2) + 
      Math.pow(z2 - z1, 2)
    );
  }

  // Angle calculations
  static angle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
  }

  static angleDegrees(x1, y1, x2, y2) {
    return this.angle(x1, y1, x2, y2) * 180 / Math.PI;
  }

  // Easing functions for smooth animations
  static easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  static easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  static easeInOutQuart(t) {
    return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
  }

  // Near-linear easing for Z axis (leadscrew: minimal accel/decel)
  static easeTrapezoidalZ(t) {
    // 5% smoothstep start, 90% linear, 5% smoothstep stop
    if (t < 0.05) { const s = t / 0.05; return 0.05 * s * s * (3 - 2 * s); }
    if (t > 0.95) { const s = (t - 0.95) / 0.05; return 0.95 + 0.05 * s * s * (3 - 2 * s); }
    return 0.05 + (t - 0.05) * (0.9 / 0.9);
  }

  // Near-linear easing for XY axes (stepper: short accel/decel)
  static easeTrapezoidalXY(t) {
    // Smoothstep transitions - no jerk at phase boundaries
    if (t < 0.1) { const s = t / 0.1; return 0.1 * s * s * (3 - 2 * s); }
    if (t > 0.9) { const s = (t - 0.9) / 0.1; return 0.9 + 0.1 * s * s * (3 - 2 * s); }
    return 0.1 + (t - 0.1) * (0.8 / 0.8);
  }

  // Linear interpolation
  static lerp(start, end, t) {
    return start + (end - start) * t;
  }

  static lerpPoint(start, end, t) {
    return {
      x: this.lerp(start.x, end.x, t),
      y: this.lerp(start.y, end.y, t),
      z: this.lerp(start.z || 0, end.z || 0, t)
    };
  }

  // Clamping and rounding
  static clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  static round(value, decimals = 3) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  static roundPoint(point, decimals = 3) {
    return {
      x: this.round(point.x, decimals),
      y: this.round(point.y, decimals),
      z: this.round(point.z || 0, decimals)
    };
  }

  // Vector operations
  static normalize(x, y) {
    const length = Math.sqrt(x * x + y * y);
    if (length === 0) return { x: 0, y: 0 };
    return { x: x / length, y: y / length };
  }

  static dotProduct(x1, y1, x2, y2) {
    return x1 * x2 + y1 * y2;
  }

  static crossProduct(x1, y1, x2, y2) {
    return x1 * y2 - y1 * x2;
  }

  // Coordinate transformations
  static polarToCartesian(radius, angle) {
    return {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle)
    };
  }

  static cartesianToPolar(x, y) {
    return {
      radius: Math.sqrt(x * x + y * y),
      angle: Math.atan2(y, x)
    };
  }

  // Grid and snapping
  static snapToGrid(value, gridSize) {
    return Math.round(value / gridSize) * gridSize;
  }

  static snapPointToGrid(point, gridSize) {
    return {
      x: this.snapToGrid(point.x, gridSize),
      y: this.snapToGrid(point.y, gridSize),
      z: this.snapToGrid(point.z || 0, gridSize)
    };
  }

  // Bounds checking
  static isPointInBounds(point, bounds) {
    return point.x >= bounds.minX && point.x <= bounds.maxX &&
           point.y >= bounds.minY && point.y <= bounds.maxY &&
           (point.z === undefined || (point.z >= bounds.minZ && point.z <= bounds.maxZ));
  }

  static getBounds(points) {
    if (points.length === 0) return null;
    
    let minX = points[0].x, maxX = points[0].x;
    let minY = points[0].y, maxY = points[0].y;
    let minZ = points[0].z || 0, maxZ = points[0].z || 0;
    
    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
      if (point.z !== undefined) {
        minZ = Math.min(minZ, point.z);
        maxZ = Math.max(maxZ, point.z);
      }
    }
    
    return { minX, maxX, minY, maxY, minZ, maxZ };
  }

  // Statistical functions
  static average(values) {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  static median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  static standardDeviation(values) {
    const avg = this.average(values);
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    return Math.sqrt(this.average(squaredDiffs));
  }

  // Pattern generation
  static generateRasterPattern(cols, rows, spacing, origin = { x: 0, y: 0 }) {
    const points = [];
    const startX = origin.x - (cols - 1) * spacing / 2;
    const startY = origin.y - (rows - 1) * spacing / 2;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        points.push({
          x: startX + col * spacing,
          y: startY + row * spacing,
          z: origin.z || 0
        });
      }
    }
    
    return points;
  }

  static generateSnakePattern(cols, rows, spacing, origin = { x: 0, y: 0 }) {
    const points = [];
    const startX = origin.x - (cols - 1) * spacing / 2;
    const startY = origin.y - (rows - 1) * spacing / 2;
    
    for (let row = 0; row < rows; row++) {
      const isEvenRow = row % 2 === 0;
      
      for (let col = 0; col < cols; col++) {
        const actualCol = isEvenRow ? col : cols - 1 - col;
        points.push({
          x: startX + actualCol * spacing,
          y: startY + row * spacing,
          z: origin.z || 0
        });
      }
    }
    
    return points;
  }

  static generateSpiralPattern(numPoints, radius, origin = { x: 0, y: 0 }) {
    const points = [];
    const angleStep = 2 * Math.PI / numPoints;
    const radiusStep = radius / numPoints;
    
    for (let i = 0; i < numPoints; i++) {
      const angle = i * angleStep;
      const r = i * radiusStep;
      
      points.push({
        x: origin.x + r * Math.cos(angle),
        y: origin.y + r * Math.sin(angle),
        z: origin.z || 0
      });
    }
    
    return points;
  }

  static generateCirclePattern(numPoints, radius, origin = { x: 0, y: 0 }) {
    const points = [];
    const angleStep = 2 * Math.PI / numPoints;
    
    for (let i = 0; i < numPoints; i++) {
      const angle = i * angleStep;
      
      points.push({
        x: origin.x + radius * Math.cos(angle),
        y: origin.y + radius * Math.sin(angle),
        z: origin.z || 0
      });
    }
    
    return points;
  }

  // Random utilities
  static randomFloat(min, max) {
    return Math.random() * (max - min) + min;
  }

  static randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static randomPoint(bounds) {
    return {
      x: this.randomFloat(bounds.minX, bounds.maxX),
      y: this.randomFloat(bounds.minY, bounds.maxY),
      z: bounds.minZ !== undefined ? this.randomFloat(bounds.minZ, bounds.maxZ) : 0
    };
  }

  // Conversion utilities
  static mmToPixels(mm, pxPerMm) {
    return mm * pxPerMm;
  }

  static pixelsToMm(pixels, pxPerMm) {
    return pixels / pxPerMm;
  }

  static degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
  }

  static radiansToDegrees(radians) {
    return radians * 180 / Math.PI;
  }

  // Validation utilities
  static isValidNumber(value) {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
  }

  static isValidPoint(point) {
    return point && 
           this.isValidNumber(point.x) && 
           this.isValidNumber(point.y) &&
           (point.z === undefined || this.isValidNumber(point.z));
  }

  static sanitizeNumber(value, defaultValue = 0) {
    const num = Number(value);
    return this.isValidNumber(num) ? num : defaultValue;
  }

  static sanitizePoint(point, defaultPoint = { x: 0, y: 0, z: 0 }) {
    if (!point) return defaultPoint;
    
    return {
      x: this.sanitizeNumber(point.x, defaultPoint.x),
      y: this.sanitizeNumber(point.y, defaultPoint.y),
      z: this.sanitizeNumber(point.z, defaultPoint.z)
    };
  }
}

// Global registration
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Math = MathUtils;
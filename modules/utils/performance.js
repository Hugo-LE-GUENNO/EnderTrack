// modules/utils/performance.js - Performance monitoring and optimization utilities

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      renderTimes: [],
      frameTimes: [],
      memoryUsage: [],
      eventCounts: new Map()
    };
    this.maxSamples = 100;
    this.isMonitoring = false;
  }

  startMonitoring() {
    this.isMonitoring = true;
    this.startMemoryMonitoring();

  }

  stopMonitoring() {
    this.isMonitoring = false;
  }

  recordRenderTime(startTime, endTime) {
    if (!this.isMonitoring) return;
    
    const renderTime = endTime - startTime;
    this.metrics.renderTimes.push(renderTime);
    
    if (this.metrics.renderTimes.length > this.maxSamples) {
      this.metrics.renderTimes.shift();
    }
  }

  recordFrameTime(frameTime) {
    if (!this.isMonitoring) return;
    
    this.metrics.frameTimes.push(frameTime);
    
    if (this.metrics.frameTimes.length > this.maxSamples) {
      this.metrics.frameTimes.shift();
    }
  }

  recordEvent(eventType) {
    if (!this.isMonitoring) return;
    
    const count = this.metrics.eventCounts.get(eventType) || 0;
    this.metrics.eventCounts.set(eventType, count + 1);
  }

  startMemoryMonitoring() {
    if (!performance.memory) return;
    
    const recordMemory = () => {
      if (!this.isMonitoring) return;
      
      this.metrics.memoryUsage.push({
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        timestamp: Date.now()
      });
      
      if (this.metrics.memoryUsage.length > this.maxSamples) {
        this.metrics.memoryUsage.shift();
      }
      
      setTimeout(recordMemory, 1000);
    };
    
    recordMemory();
  }

  getStats() {
    const renderTimes = this.metrics.renderTimes;
    const frameTimes = this.metrics.frameTimes;
    
    return {
      render: {
        avg: renderTimes.length ? renderTimes.reduce((a, b) => a + b) / renderTimes.length : 0,
        min: renderTimes.length ? Math.min(...renderTimes) : 0,
        max: renderTimes.length ? Math.max(...renderTimes) : 0,
        samples: renderTimes.length
      },
      fps: {
        current: frameTimes.length ? 1000 / frameTimes[frameTimes.length - 1] : 0,
        avg: frameTimes.length ? 1000 / (frameTimes.reduce((a, b) => a + b) / frameTimes.length) : 0
      },
      memory: this.getMemoryStats(),
      events: Object.fromEntries(this.metrics.eventCounts)
    };
  }

  getMemoryStats() {
    if (!performance.memory || !this.metrics.memoryUsage.length) {
      return { available: false };
    }
    
    const latest = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
    return {
      available: true,
      used: Math.round(latest.used / 1024 / 1024),
      total: Math.round(latest.total / 1024 / 1024),
      limit: Math.round(latest.limit / 1024 / 1024)
    };
  }

  printStats() {
    const stats = this.getStats();
    console.group('📊 Performance Stats');
    if (stats.memory.available) {
    }
    console.groupEnd();
  }
}

// Debounce utility
class Debouncer {
  constructor() {
    this.timeouts = new Map();
  }

  debounce(key, func, delay = 100) {
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
    }
    
    const timeout = setTimeout(() => {
      func();
      this.timeouts.delete(key);
    }, delay);
    
    this.timeouts.set(key, timeout);
  }

  cancel(key) {
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
      this.timeouts.delete(key);
    }
  }

  cancelAll() {
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
  }
}

// Throttle utility
class Throttler {
  constructor() {
    this.lastCalls = new Map();
  }

  throttle(key, func, delay = 16) {
    const now = Date.now();
    const lastCall = this.lastCalls.get(key) || 0;
    
    if (now - lastCall >= delay) {
      func();
      this.lastCalls.set(key, now);
      return true;
    }
    
    return false;
  }
}

// Global instances
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Performance = new PerformanceMonitor();
window.EnderTrack.Debouncer = new Debouncer();
window.EnderTrack.Throttler = new Throttler();
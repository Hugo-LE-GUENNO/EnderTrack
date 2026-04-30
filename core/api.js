// core/api.js - External API interface
// Provides a unified API for external access and plugin development

class EnderTrackAPI {
  constructor() {
    this.registeredFunctions = new Map();
    this.middleware = [];
    this.isInitialized = false;
    this.version = '2.0.0';
  }

  static init() {
    
    // Register core API functions
    this.registerCoreFunctions();
    
    // Setup API validation
    this.setupValidation();
    
    this.isInitialized = true;
    
    return true;
  }

  static registerCoreFunctions() {
    // Movement API
    this.register('moveAbsolute', async (x, y, z) => {
      if (!EnderTrack.Movement) {
        throw new Error('Movement system not available');
      }
      return await EnderTrack.Movement.moveAbsolute(x, y, z);
    }, {
      description: 'Move to absolute position',
      parameters: [
        { name: 'x', type: 'number', description: 'X coordinate in mm' },
        { name: 'y', type: 'number', description: 'Y coordinate in mm' },
        { name: 'z', type: 'number', description: 'Z coordinate in mm' }
      ],
      returns: 'Promise<boolean>'
    });

    this.register('moveRelative', async (dx, dy, dz) => {
      if (!EnderTrack.Movement) {
        throw new Error('Movement system not available');
      }
      return await EnderTrack.Movement.moveRelative(dx, dy, dz);
    }, {
      description: 'Move relative to current position',
      parameters: [
        { name: 'dx', type: 'number', description: 'X offset in mm' },
        { name: 'dy', type: 'number', description: 'Y offset in mm' },
        { name: 'dz', type: 'number', description: 'Z offset in mm' }
      ],
      returns: 'Promise<boolean>'
    });

    this.register('moveDirection', async (direction, distance = null) => {
      if (!EnderTrack.Movement) {
        throw new Error('Movement system not available');
      }
      return await EnderTrack.Movement.moveDirection(direction, distance);
    }, {
      description: 'Move in a specific direction',
      parameters: [
        { name: 'direction', type: 'string', description: 'Direction: up, down, left, right, zUp, zDown' },
        { name: 'distance', type: 'number', optional: true, description: 'Distance in mm (uses sensitivity if not provided)' }
      ],
      returns: 'Promise<boolean>'
    });

    this.register('goHome', async (mode = 'xy') => {
      if (!EnderTrack.Movement) {
        throw new Error('Movement system not available');
      }
      return await EnderTrack.Movement.goHome(mode);
    }, {
      description: 'Go to home position',
      parameters: [
        { name: 'mode', type: 'string', optional: true, description: 'Home mode: xy, xyz, z' }
      ],
      returns: 'Promise<boolean>'
    });

    this.register('emergencyStop', () => {
      if (EnderTrack.Movement) {
        EnderTrack.Movement.emergencyStopMovement();
      }
      return true;
    }, {
      description: 'Emergency stop all movements',
      parameters: [],
      returns: 'boolean'
    });

    // State API
    this.register('getCurrentPosition', () => {
      const state = EnderTrack.State?.get?.();
      return state ? { ...state.pos } : { x: 0, y: 0, z: 0 };
    }, {
      description: 'Get current position',
      parameters: [],
      returns: 'Object'
    });



    // Navigation API
    this.register('setInputMode', (mode) => {
      if (!EnderTrack.Navigation) {
        throw new Error('Navigation system not available');
      }
      EnderTrack.Navigation.setInputMode(mode);
      return true;
    }, {
      description: 'Set input mode',
      parameters: [
        { name: 'mode', type: 'string', description: 'Input mode: relative or absolute' }
      ],
      returns: 'boolean'
    });

    this.register('setSensitivity', (axis, value) => {
      if (!EnderTrack.Navigation) {
        throw new Error('Navigation system not available');
      }
      EnderTrack.Navigation.setSensitivity(axis, value);
      return true;
    }, {
      description: 'Set axis sensitivity',
      parameters: [
        { name: 'axis', type: 'string', description: 'Axis: x, y, or z' },
        { name: 'value', type: 'number', description: 'Sensitivity value (0.01-50)' }
      ],
      returns: 'boolean'
    });

    this.register('toggleLock', (axis) => {
      if (!EnderTrack.Navigation) {
        throw new Error('Navigation system not available');
      }
      EnderTrack.Navigation.toggleLock(axis);
      return true;
    }, {
      description: 'Toggle axis lock',
      parameters: [
        { name: 'axis', type: 'string', description: 'Axis: X, Y, or Z' }
      ],
      returns: 'boolean'
    });

    // Canvas API
    this.register('drawCircle', (x, y, radius, color, fill = true) => {
      if (!EnderTrack.Canvas) {
        throw new Error('Canvas system not available');
      }
      EnderTrack.Canvas.drawCircle(x, y, radius, color, fill);
      return true;
    }, {
      description: 'Draw circle on canvas',
      parameters: [
        { name: 'x', type: 'number', description: 'X coordinate in mm' },
        { name: 'y', type: 'number', description: 'Y coordinate in mm' },
        { name: 'radius', type: 'number', description: 'Radius in mm' },
        { name: 'color', type: 'string', description: 'Color' },
        { name: 'fill', type: 'boolean', optional: true, description: 'Fill circle' }
      ],
      returns: 'boolean'
    });

    this.register('drawLine', (x1, y1, x2, y2, color, width = 1) => {
      if (!EnderTrack.Canvas) {
        throw new Error('Canvas system not available');
      }
      EnderTrack.Canvas.drawLine(x1, y1, x2, y2, color, width);
      return true;
    }, {
      description: 'Draw line on canvas',
      parameters: [
        { name: 'x1', type: 'number', description: 'Start X coordinate in mm' },
        { name: 'y1', type: 'number', description: 'Start Y coordinate in mm' },
        { name: 'x2', type: 'number', description: 'End X coordinate in mm' },
        { name: 'y2', type: 'number', description: 'End Y coordinate in mm' },
        { name: 'color', type: 'string', description: 'Color' },
        { name: 'width', type: 'number', optional: true, description: 'Line width' }
      ],
      returns: 'boolean'
    });

    this.register('drawText', (x, y, text, color, font = '12px sans-serif') => {
      if (!EnderTrack.Canvas) {
        throw new Error('Canvas system not available');
      }
      EnderTrack.Canvas.drawText(x, y, text, color, font);
      return true;
    }, {
      description: 'Draw text on canvas',
      parameters: [
        { name: 'x', type: 'number', description: 'X coordinate in mm' },
        { name: 'y', type: 'number', description: 'Y coordinate in mm' },
        { name: 'text', type: 'string', description: 'Text to draw' },
        { name: 'color', type: 'string', description: 'Text color' },
        { name: 'font', type: 'string', optional: true, description: 'Font specification' }
      ],
      returns: 'boolean'
    });

    // UI API
    this.register('showNotification', (message, type = 'info', options = {}) => {
      if (!EnderTrack.UI?.Notifications) {
        throw new Error('Notification system not available');
      }
      return EnderTrack.UI.Notifications.show(message, type, options);
    }, {
      description: 'Show notification',
      parameters: [
        { name: 'message', type: 'string', description: 'Notification message' },
        { name: 'type', type: 'string', optional: true, description: 'Type: info, success, warning, error' },
        { name: 'options', type: 'object', optional: true, description: 'Additional options' }
      ],
      returns: 'string'
    });

    this.register('showModal', (options) => {
      if (!EnderTrack.UI?.Modals) {
        throw new Error('Modal system not available');
      }
      return EnderTrack.UI.Modals.show(options);
    }, {
      description: 'Show modal dialog',
      parameters: [
        { name: 'options', type: 'object', description: 'Modal configuration' }
      ],
      returns: 'string'
    });

    this.register('switchTab', (tabId) => {
      if (!EnderTrack.UI?.Tabs) {
        throw new Error('Tab system not available');
      }
      return EnderTrack.UI.Tabs.switchTab(tabId);
    }, {
      description: 'Switch to tab',
      parameters: [
        { name: 'tabId', type: 'string', description: 'Tab identifier' }
      ],
      returns: 'boolean'
    });

    // Utility API
    this.register('mapToCanvas', (x, y) => {
      if (!EnderTrack.Coordinates) {
        throw new Error('Coordinate system not available');
      }
      return EnderTrack.Coordinates.mapToCanvas(x, y);
    }, {
      description: 'Convert map coordinates to canvas coordinates',
      parameters: [
        { name: 'x', type: 'number', description: 'X coordinate in mm' },
        { name: 'y', type: 'number', description: 'Y coordinate in mm' }
      ],
      returns: 'Object'
    });

    this.register('canvasToMap', (x, y) => {
      if (!EnderTrack.Coordinates) {
        throw new Error('Coordinate system not available');
      }
      return EnderTrack.Coordinates.canvasToMap(x, y);
    }, {
      description: 'Convert canvas coordinates to map coordinates',
      parameters: [
        { name: 'x', type: 'number', description: 'X coordinate in pixels' },
        { name: 'y', type: 'number', description: 'Y coordinate in pixels' }
      ],
      returns: 'Object'
    });

    // Event API
    this.register('on', (event, callback) => {
      if (!EnderTrack.Events) {
        throw new Error('Event system not available');
      }
      EnderTrack.Events.on(event, callback);
      return true;
    }, {
      description: 'Add event listener',
      parameters: [
        { name: 'event', type: 'string', description: 'Event name' },
        { name: 'callback', type: 'function', description: 'Event handler' }
      ],
      returns: 'boolean'
    });

    this.register('emit', (event, ...args) => {
      if (!EnderTrack.Events) {
        throw new Error('Event system not available');
      }
      return EnderTrack.Events.emit(event, ...args);
    }, {
      description: 'Emit event',
      parameters: [
        { name: 'event', type: 'string', description: 'Event name' },
        { name: 'args', type: 'any', optional: true, description: 'Event arguments' }
      ],
      returns: 'boolean'
    });
  }

  static setupValidation() {
    // Add validation middleware
    this.use((functionName, args, metadata) => {
      // Validate required parameters
      if (metadata.parameters) {
        metadata.parameters.forEach((param, index) => {
          if (!param.optional && args[index] === undefined) {
            throw new Error(`Missing required parameter: ${param.name}`);
          }
          
          if (args[index] !== undefined && param.type) {
            const actualType = typeof args[index];
            if (actualType !== param.type && param.type !== 'any') {
              throw new Error(`Parameter ${param.name} expected ${param.type}, got ${actualType}`);
            }
          }
        });
      }
      
      return true; // Continue execution
    });
  }

  // Core API methods
  static register(name, func, metadata = {}) {
    if (typeof func !== 'function') {
      throw new Error('API function must be a function');
    }

    this.registeredFunctions.set(name, {
      func,
      metadata: {
        description: metadata.description || 'No description',
        parameters: metadata.parameters || [],
        returns: metadata.returns || 'any',
        category: metadata.category || 'general',
        version: metadata.version || this.version
      }
    });

  }

  static unregister(name) {
    const removed = this.registeredFunctions.delete(name);
    if (removed) {
    }
    return removed;
  }

  static async call(name, ...args) {
    const registration = this.registeredFunctions.get(name);
    if (!registration) {
      throw new Error(`API function not found: ${name}`);
    }

    try {
      // Run middleware
      for (const middleware of this.middleware) {
        const result = await middleware(name, args, registration.metadata);
        if (result === false) {
          throw new Error(`Middleware blocked execution of ${name}`);
        }
      }

      // Call the function
      const result = await registration.func(...args);
      
      // Emit API call event
      EnderTrack.Events?.emit?.('api:called', {
        function: name,
        args,
        result,
        timestamp: Date.now()
      });
      
      return result;
      
    } catch (error) {
      // Emit API error event
      EnderTrack.Events?.emit?.('api:error', {
        function: name,
        args,
        error: error.message,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  static use(middleware) {
    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function');
    }
    
    this.middleware.push(middleware);
  }

  // API introspection
  static getFunctions() {
    const functions = {};
    
    this.registeredFunctions.forEach((registration, name) => {
      functions[name] = registration.metadata;
    });
    
    return functions;
  }

  static getFunction(name) {
    const registration = this.registeredFunctions.get(name);
    return registration ? registration.metadata : null;
  }

  static getFunctionsByCategory(category) {
    const functions = {};
    
    this.registeredFunctions.forEach((registration, name) => {
      if (registration.metadata.category === category) {
        functions[name] = registration.metadata;
      }
    });
    
    return functions;
  }

  static getCategories() {
    const categories = new Set();
    
    this.registeredFunctions.forEach((registration) => {
      categories.add(registration.metadata.category);
    });
    
    return Array.from(categories);
  }

  // Documentation generation
  static generateDocumentation() {
    const categories = this.getCategories();
    let doc = `# EnderTrack API Documentation\n\nVersion: ${this.version}\n\n`;
    
    categories.forEach(category => {
      doc += `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
      
      const functions = this.getFunctionsByCategory(category);
      
      Object.entries(functions).forEach(([name, metadata]) => {
        doc += `### ${name}\n\n`;
        doc += `${metadata.description}\n\n`;
        
        if (metadata.parameters.length > 0) {
          doc += `**Parameters:**\n`;
          metadata.parameters.forEach(param => {
            const optional = param.optional ? ' (optional)' : '';
            doc += `- \`${param.name}\` (${param.type}${optional}): ${param.description}\n`;
          });
          doc += '\n';
        }
        
        doc += `**Returns:** ${metadata.returns}\n\n`;
        
        // Example usage
        const paramNames = metadata.parameters.map(p => p.name).join(', ');
        doc += `**Example:**\n\`\`\`javascript\nEnderTrack.API.call('${name}'${paramNames ? ', ' + paramNames : ''});\n\`\`\`\n\n`;
      });
    });
    
    return doc;
  }





  // Debug and monitoring
  static getStats() {
    return {
      functionCount: this.registeredFunctions.size,
      middlewareCount: this.middleware.length,
      categories: this.getCategories(),
      version: this.version,
      isInitialized: this.isInitialized
    };
  }

  static getDebugInfo() {
    return {
      ...this.getStats(),
      functions: this.getFunctions(),
      middleware: this.middleware.length
    };
  }


}

// Global registration
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.API = EnderTrackAPI;
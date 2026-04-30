// modules/utils/validation.js - Input validation utilities

class ValidationUtils {
  // Number validation
  static isValidNumber(value, options = {}) {
    const {
      min = -Infinity,
      max = Infinity,
      allowNaN = false,
      allowInfinite = false
    } = options;

    if (typeof value !== 'number') {
      const parsed = Number(value);
      if (isNaN(parsed)) return allowNaN;
      value = parsed;
    }

    if (isNaN(value)) return allowNaN;
    if (!isFinite(value)) return allowInfinite;
    if (value < min || value > max) return false;

    return true;
  }

  static sanitizeNumber(value, defaultValue = 0, options = {}) {
    if (this.isValidNumber(value, options)) {
      return Number(value);
    }
    return defaultValue;
  }

  // Coordinate validation
  static isValidCoordinate(coord, bounds = null) {
    if (!coord || typeof coord !== 'object') return false;
    
    if (!this.isValidNumber(coord.x) || !this.isValidNumber(coord.y)) {
      return false;
    }

    if (coord.z !== undefined && !this.isValidNumber(coord.z)) {
      return false;
    }

    if (bounds) {
      if (coord.x < bounds.minX || coord.x > bounds.maxX) return false;
      if (coord.y < bounds.minY || coord.y > bounds.maxY) return false;
      if (coord.z !== undefined && bounds.minZ !== undefined && bounds.maxZ !== undefined) {
        if (coord.z < bounds.minZ || coord.z > bounds.maxZ) return false;
      }
    }

    return true;
  }

  static sanitizeCoordinate(coord, defaultCoord = { x: 0, y: 0, z: 0 }, bounds = null) {
    if (!coord || typeof coord !== 'object') {
      return { ...defaultCoord };
    }

    let result = {
      x: this.sanitizeNumber(coord.x, defaultCoord.x),
      y: this.sanitizeNumber(coord.y, defaultCoord.y),
      z: this.sanitizeNumber(coord.z, defaultCoord.z || 0)
    };

    if (bounds) {
      result.x = EnderTrack.Math.clamp(result.x, bounds.minX, bounds.maxX);
      result.y = EnderTrack.Math.clamp(result.y, bounds.minY, bounds.maxY);
      if (bounds.minZ !== undefined && bounds.maxZ !== undefined) {
        result.z = EnderTrack.Math.clamp(result.z, bounds.minZ, bounds.maxZ);
      }
    }

    return result;
  }

  // String validation
  static isValidString(value, options = {}) {
    const {
      minLength = 0,
      maxLength = Infinity,
      allowEmpty = true,
      pattern = null
    } = options;

    if (typeof value !== 'string') return false;
    if (!allowEmpty && value.length === 0) return false;
    if (value.length < minLength || value.length > maxLength) return false;
    if (pattern && !pattern.test(value)) return false;

    return true;
  }

  static sanitizeString(value, defaultValue = '', options = {}) {
    if (this.isValidString(value, options)) {
      return value;
    }
    return defaultValue;
  }

  // Array validation
  static isValidArray(value, options = {}) {
    const {
      minLength = 0,
      maxLength = Infinity,
      itemValidator = null
    } = options;

    if (!Array.isArray(value)) return false;
    if (value.length < minLength || value.length > maxLength) return false;

    if (itemValidator) {
      return value.every(item => itemValidator(item));
    }

    return true;
  }

  // Color validation
  static isValidColor(color) {
    if (typeof color !== 'string') return false;
    
    // Hex colors
    if (/^#([0-9A-F]{3}){1,2}$/i.test(color)) return true;
    
    // RGB/RGBA
    if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+)?\s*\)$/i.test(color)) return true;
    
    // HSL/HSLA
    if (/^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(,\s*[\d.]+)?\s*\)$/i.test(color)) return true;
    
    // Named colors (basic set)
    const namedColors = [
      'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown',
      'black', 'white', 'gray', 'grey', 'transparent'
    ];
    
    return namedColors.includes(color.toLowerCase());
  }

  // URL validation
  static isValidURL(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Email validation (basic)
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // File validation
  static isValidFile(file, options = {}) {
    const {
      maxSize = Infinity,
      allowedTypes = null,
      allowedExtensions = null
    } = options;

    if (!(file instanceof File)) return false;
    if (file.size > maxSize) return false;

    if (allowedTypes && !allowedTypes.includes(file.type)) return false;

    if (allowedExtensions) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!extension || !allowedExtensions.includes(extension)) return false;
    }

    return true;
  }

  // Form validation
  static validateForm(formData, rules) {
    const errors = {};
    const sanitized = {};

    for (const [field, rule] of Object.entries(rules)) {
      const value = formData[field];
      
      try {
        // Required check
        if (rule.required && (value === undefined || value === null || value === '')) {
          errors[field] = `${field} is required`;
          continue;
        }

        // Skip validation if not required and empty
        if (!rule.required && (value === undefined || value === null || value === '')) {
          sanitized[field] = rule.default || null;
          continue;
        }

        // Type-specific validation
        let isValid = true;
        let sanitizedValue = value;

        switch (rule.type) {
          case 'number':
            isValid = this.isValidNumber(value, rule.options);
            sanitizedValue = this.sanitizeNumber(value, rule.default, rule.options);
            break;
          
          case 'string':
            isValid = this.isValidString(value, rule.options);
            sanitizedValue = this.sanitizeString(value, rule.default, rule.options);
            break;
          
          case 'coordinate':
            isValid = this.isValidCoordinate(value, rule.bounds);
            sanitizedValue = this.sanitizeCoordinate(value, rule.default, rule.bounds);
            break;
          
          case 'array':
            isValid = this.isValidArray(value, rule.options);
            break;
          
          case 'color':
            isValid = this.isValidColor(value);
            break;
          
          case 'url':
            isValid = this.isValidURL(value);
            break;
          
          case 'email':
            isValid = this.isValidEmail(value);
            break;
          
          case 'file':
            isValid = this.isValidFile(value, rule.options);
            break;
          
          default:
            if (rule.validator) {
              isValid = rule.validator(value);
            }
        }

        if (!isValid) {
          errors[field] = rule.message || `Invalid ${field}`;
        } else {
          sanitized[field] = sanitizedValue;
        }

      } catch (error) {
        errors[field] = `Validation error for ${field}: ${error.message}`;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      sanitized
    };
  }

  // EnderTrack specific validations
  static validateMovementParameters(params) {
    const rules = {
      x: {
        type: 'number',
        required: true,
        options: { min: -1000, max: 1000 },
        message: 'X coordinate must be between -1000 and 1000 mm'
      },
      y: {
        type: 'number',
        required: true,
        options: { min: -1000, max: 1000 },
        message: 'Y coordinate must be between -1000 and 1000 mm'
      },
      z: {
        type: 'number',
        required: false,
        default: 0,
        options: { min: -100, max: 100 },
        message: 'Z coordinate must be between -100 and 100 mm'
      },
      speed: {
        type: 'number',
        required: false,
        default: 50,
        options: { min: 1, max: 1000 },
        message: 'Speed must be between 1 and 1000 mm/s'
      }
    };

    return this.validateForm(params, rules);
  }

  static validateSensitivitySettings(settings) {
    const rules = {
      sensitivityX: {
        type: 'number',
        required: true,
        options: { min: 0.01, max: 50 },
        message: 'X sensitivity must be between 0.01 and 50'
      },
      sensitivityY: {
        type: 'number',
        required: true,
        options: { min: 0.01, max: 50 },
        message: 'Y sensitivity must be between 0.01 and 50'
      },
      sensitivityZ: {
        type: 'number',
        required: true,
        options: { min: 0.01, max: 50 },
        message: 'Z sensitivity must be between 0.01 and 50'
      }
    };

    return this.validateForm(settings, rules);
  }

  static validateCanvasSettings(settings) {
    const rules = {
      mapSizeMm: {
        type: 'number',
        required: true,
        options: { min: 50, max: 1000 },
        message: 'Map size must be between 50 and 1000 mm'
      },
      zoom: {
        type: 'number',
        required: false,
        default: 1,
        options: { min: 0.1, max: 10 },
        message: 'Zoom must be between 0.1 and 10'
      },
      panX: {
        type: 'number',
        required: false,
        default: 0,
        options: { min: -1000, max: 1000 },
        message: 'Pan X must be between -1000 and 1000'
      },
      panY: {
        type: 'number',
        required: false,
        default: 0,
        options: { min: -1000, max: 1000 },
        message: 'Pan Y must be between -1000 and 1000'
      }
    };

    return this.validateForm(settings, rules);
  }

  // Batch validation for arrays of data
  static validateBatch(items, validator) {
    const results = [];
    const errors = [];

    items.forEach((item, index) => {
      try {
        const result = validator(item);
        if (result.isValid) {
          results.push(result.sanitized || item);
        } else {
          errors.push({ index, errors: result.errors });
        }
      } catch (error) {
        errors.push({ index, error: error.message });
      }
    });

    return {
      isValid: errors.length === 0,
      results,
      errors
    };
  }

  // Real-time validation for form inputs
  static createValidator(rules) {
    return (field, value) => {
      const rule = rules[field];
      if (!rule) return { isValid: true, value };

      try {
        const result = this.validateForm({ [field]: value }, { [field]: rule });
        return {
          isValid: result.isValid,
          value: result.sanitized[field],
          error: result.errors[field]
        };
      } catch (error) {
        return {
          isValid: false,
          value,
          error: error.message
        };
      }
    };
  }
}

// Global registration
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Validation = ValidationUtils;
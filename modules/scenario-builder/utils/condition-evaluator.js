// modules/scenario/condition-evaluator.js - Simple Condition Evaluator
class ConditionEvaluator {
  static evaluate(condition, variables) {
    if (!condition || condition.trim() === '') return true;
    
    try {
      let expr = condition;
      
      // Sort keys longest-first to avoid $x matching before $xSlice
      const keys = Object.keys(variables).sort((a, b) => b.length - a.length);

      // First pass: replace object property access ($pos.x, $pos.y, $pos.z)
      for (const key of keys) {
        const value = variables[key];
        if (typeof value === 'object' && value !== null) {
          const varName = key.replace('$', '');
          expr = expr.replace(new RegExp(`\\$${varName}\\.x`, 'g'), value.x || 0);
          expr = expr.replace(new RegExp(`\\$${varName}\\.y`, 'g'), value.y || 0);
          expr = expr.replace(new RegExp(`\\$${varName}\\.z`, 'g'), value.z || 0);
        }
      }

      // Second pass: replace scalar variables
      for (const key of keys) {
        const value = variables[key];
        if (typeof value !== 'object' || value === null) {
          expr = expr.replace(new RegExp(`\\${key}`, 'g'), value);
        }
      }
      
      // French logical operators
      expr = expr.replace(/\s+et\s+/gi, ' && ');
      expr = expr.replace(/\s+ou\s+/gi, ' || ');
      expr = expr.replace(/\s+non\s+/gi, ' ! ');
      
      const result = Function('"use strict"; return (' + expr + ')')();
      return !!result;
    } catch (error) {
      console.error('[ConditionEvaluator] Error evaluating:', condition, error);
      return false;
    }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ConditionEvaluator = ConditionEvaluator;

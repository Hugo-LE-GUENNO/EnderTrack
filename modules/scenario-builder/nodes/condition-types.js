// modules/scenario/condition-types.js - Condition Types Registry
class ConditionTypesRegistry {
  constructor() {
    this.conditionTypes = new Map();
    this.registerCoreConditions();
  }
  
  registerCoreConditions() {
    // 👁️ Condition unique - commence avec juste SI
    this.register({
      id: 'default',
      label: '👁️ Condition',
      icon: '👁️',
      description: 'Condition SI avec branches optionnelles',
      create: () => ({
        type: 'condition',
        conditionType: 'default',
        params: { label: 'Condition' },
        branches: [
          { condition: '$x > 0', actions: [] }  // Just IF at start
        ]
      }),
      addSinon: (node) => {
        if (!node.branches) node.branches = [];
        // Add ELSE at end
        node.branches.push({ condition: null, actions: [] });
      },
      addOuSi: (node) => {
        if (!node.branches) node.branches = [];
        // Insert ELSE IF before ELSE (s'il existe)
        const hasSinon = node.branches[node.branches.length - 1]?.condition === null;
        const insertIndex = hasSinon ? node.branches.length - 1 : node.branches.length;
        node.branches.splice(insertIndex, 0, { condition: '$x > 0', actions: [] });
      },
      removeBranch: (node, branchIndex) => {
        if (!node.branches || branchIndex === 0) return false; // Ne pas supprimer le SI
        node.branches.splice(branchIndex, 1);
        return true;
      },
      hasSinon: (node) => {
        return node.branches?.some(b => b.condition === null) || false;
      }
    });
  }
  
  register(conditionTypeDef) {
    if (!conditionTypeDef.id || !conditionTypeDef.label) {
      console.error('[ConditionTypes] Invalid condition type definition');
      return false;
    }
    
    this.conditionTypes.set(conditionTypeDef.id, conditionTypeDef);
    return true;
  }
  
  get(conditionTypeId) {
    return this.conditionTypes.get(conditionTypeId);
  }
  
  getAll() {
    return Array.from(this.conditionTypes.values());
  }
  
  unregister(conditionTypeId) {
    return this.conditionTypes.delete(conditionTypeId);
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ConditionTypesRegistry = new ConditionTypesRegistry();

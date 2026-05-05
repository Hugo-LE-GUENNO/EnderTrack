// plugins/scenario-builder/src/utils/tree-utils.js — Tree traversal & manipulation

class TreeUtils {
  // Get node by dot-separated path (e.g. "0.children.1")
  static getNodeByPath(tree, pathStr) {
    if (!tree || !pathStr) return tree || null;
    const path = (typeof pathStr === 'string' ? pathStr.split('.') : pathStr).filter(p => p !== '');
    let node = tree;

    for (let i = 0; i < path.length; i++) {
      if (!node) return null;
      const part = path[i];

      if (part === 'children' || part === 'branches' || part === 'actions') continue;

      const index = parseInt(part);
      if (isNaN(index)) {
        // Named branch (then/else — legacy compat)
        if (node[part]) { node = node[part]; continue; }
        return null;
      }

      const prev = i > 0 ? path[i - 1] : null;
      if (prev === 'branches' && node.branches?.[index]) { node = node.branches[index]; }
      else if (prev === 'actions' && node.actions?.[index]) { node = node.actions[index]; }
      else if (Array.isArray(node)) { node = node[index]; }
      else if (node.children?.[index] !== undefined) { node = node.children[index]; }
      else return null;

      if (!node) return null;
    }
    return node;
  }

  // Get parent array + index for a path
  static getParentArray(tree, pathStr) {
    const path = (typeof pathStr === 'string' ? pathStr.split('.') : pathStr).filter(p => p !== '');
    if (path.length === 0) return null;

    const index = parseInt(path[path.length - 1]);
    if (isNaN(index)) return null;

    const parentPath = path.slice(0, -1);
    const parent = parentPath.length === 0 ? tree : this.getNodeByPath(tree, parentPath.join('.'));
    if (!parent) return null;

    // Determine which array
    const prevPart = parentPath[parentPath.length - 1];
    let array;
    if (prevPart === 'branches') array = parent.branches;
    else if (prevPart === 'actions') array = parent.actions;
    else if (Array.isArray(parent)) array = parent;
    else array = parent.children;

    return array ? { array, index, parent } : null;
  }

  // Insert node at path (after selected, or into children if loop/root)
  static insertNode(tree, node, selectedPath) {
    if (!selectedPath) {
      if (!tree.children) tree.children = [];
      tree.children.push(node);
      return;
    }

    // If selected is a branch zone
    if (selectedPath.includes('.branches.')) {
      const path = selectedPath.split('.').filter(p => p);
      const branchesIdx = path.indexOf('branches');
      const condPath = path.slice(0, branchesIdx).join('.');
      const branchIdx = parseInt(path[branchesIdx + 1]);
      const cond = this.getNodeByPath(tree, condPath);
      if (cond?.branches?.[branchIdx]) {
        if (!cond.branches[branchIdx].actions) cond.branches[branchIdx].actions = [];
        cond.branches[branchIdx].actions.push(node);
        return;
      }
    }

    const selected = this.getNodeByPath(tree, selectedPath);
    if (!selected) {
      if (!tree.children) tree.children = [];
      tree.children.push(node);
      return;
    }

    // If loop/root/macro → add inside children
    if (selected.type === 'loop' || selected.type === 'root' || selected.type === 'macro') {
      if (!selected.children) selected.children = [];
      selected.children.push(node);
    }
    // If condition → add to first branch
    else if (selected.type === 'condition') {
      if (!selected.branches?.length) selected.branches = [{ condition: '$x > 0', actions: [] }];
      selected.branches[0].actions.push(node);
    }
    // Otherwise → add after selected in parent array
    else {
      const info = this.getParentArray(tree, selectedPath);
      if (info) info.array.splice(info.index + 1, 0, node);
      else { if (!tree.children) tree.children = []; tree.children.push(node); }
    }
  }

  // Delete node at path
  static deleteNode(tree, pathStr) {
    const info = this.getParentArray(tree, pathStr);
    if (info && info.array.length > 0) {
      info.array.splice(info.index, 1);
      return true;
    }
    return false;
  }

  // Move node up/down within its parent array
  static moveNode(tree, pathStr, direction) {
    const info = this.getParentArray(tree, pathStr);
    if (!info) return false;
    const { array, index } = info;
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= array.length) return false;
    [array[index], array[newIdx]] = [array[newIdx], array[index]];
    return true;
  }

  // Deep clone a subtree
  static clone(node) {
    return JSON.parse(JSON.stringify(node));
  }

  // Extract all move positions from tree (for track preview)
  // Simulates execution: unrolls loops, resolves list indices
  static extractPositions(node, positions = [], pos = { x: 0, y: 0, z: 0 }, vars = {}) {
    if (!node) return positions;

    if (node.type === 'action' && node.actionId === 'move') {
      const p = node.params || {};
      if (p.moveType === 'absolute') {
        const src = p.absSource || 'manual';
        if (src === 'list' && p.listId) {
          const list = window.EnderTrack?.Lists?.manager?.getList?.(p.listId);
          if (p.listPickMode === 'pick') {
            const pt = list?.positions?.[parseInt(p.listPick) || 0];
            if (pt) pos = { x: pt.x, y: pt.y, z: pt.z };
          } else {
            // Resolve index variable ($i, $j...)
            const idxExpr = p.listIndex || '$i';
            let idx = 0;
            const num = Number(idxExpr);
            if (!isNaN(num)) { idx = num; }
            else if (vars[idxExpr] !== undefined) { idx = vars[idxExpr]; }
            const pt = list?.positions?.[Math.floor(idx)];
            if (pt) pos = { x: pt.x, y: pt.y, z: pt.z };
          }
        } else if (src === 'strategic') {
          const state = window.EnderTrack?.State?.get?.();
          const id = p.strategicId || 'homeXY';
          if (id === 'homeXYZ') {
            const h = state?.homePositions?.xyz || { x: 0, y: 0, z: 0 };
            pos = { x: h.x, y: h.y, z: h.z };
          } else {
            const h = state?.homePositions?.xy || { x: 0, y: 0 };
            pos = { x: h.x, y: h.y, z: pos.z };
          }
        } else {
          // Manual — try to resolve variables in expressions
          pos = {
            x: this._resolveNum(p.x, vars) ?? pos.x,
            y: this._resolveNum(p.y, vars) ?? pos.y,
            z: this._resolveNum(p.z, vars) ?? pos.z
          };
        }
      } else if (p.moveType === 'relative') {
        pos = {
          x: pos.x + (this._resolveNum(p.dx, vars) || 0),
          y: pos.y + (this._resolveNum(p.dy, vars) || 0),
          z: pos.z + (this._resolveNum(p.dz, vars) || 0)
        };
      }
      positions.push({ ...pos });
      return positions;
    }

    if (node.type === 'loop') {
      const loopDef = window.EnderTrack?.LoopTypesRegistry?.get(node.loopId);
      const loopVar = node.params?.loopVar || '$i';
      let count = loopDef?.getIterationCount?.(node.params || {}) || 1;
      if (!isFinite(count)) count = 50;
      count = Math.min(count, 200);

      for (let i = 0; i < count; i++) {
        const loopVars = { ...vars, [loopVar]: i };
        for (const child of node.children || []) {
          this.extractPositions(child, positions, pos, loopVars);
          if (positions.length) pos = { ...positions[positions.length - 1] };
        }
      }
      return positions;
    }

    if (node.type === 'macro' && node.children) {
      for (const child of node.children) {
        this.extractPositions(child, positions, pos, vars);
        if (positions.length) pos = { ...positions[positions.length - 1] };
      }
      return positions;
    }

    if (node.children) {
      for (const child of node.children) {
        this.extractPositions(child, positions, pos, vars);
        if (positions.length) pos = { ...positions[positions.length - 1] };
      }
    }
    if (node.branches) {
      for (const b of node.branches) {
        if (b.actions) for (const a of b.actions) {
          this.extractPositions(a, positions, pos, vars);
          if (positions.length) pos = { ...positions[positions.length - 1] };
        }
      }
    }
    return positions;
  }

  // Resolve a param value to a number, substituting variables
  static _resolveNum(expr, vars) {
    if (expr === undefined || expr === null || expr === '') return null;
    const s = String(expr).replace(',', '.');
    const n = Number(s);
    if (!isNaN(n)) return n;
    try {
      let e = s;
      const keys = Object.keys(vars).sort((a, b) => b.length - a.length);
      for (const key of keys) {
        const v = vars[key];
        if (typeof v === 'number') e = e.replace(new RegExp(key.replace(/\$/g, '\\$'), 'g'), v);
      }
      const result = Number(Function('"use strict"; return (' + e + ')')());
      return isNaN(result) ? null : result;
    } catch { return null; }
  }

  // Count total actions in tree
  static countActions(node) {
    if (!node) return 0;
    let count = node.type === 'action' ? 1 : 0;
    if (node.children) for (const c of node.children) count += this.countActions(c);
    if (node.branches) for (const b of node.branches) {
      if (b.actions) for (const a of b.actions) count += this.countActions(a);
    }
    return count;
  }

  // Find first node matching predicate (DFS)
  static findFirst(node, predicate) {
    if (!node) return null;
    if (predicate(node)) return node;
    if (node.children) for (const c of node.children) {
      const found = this.findFirst(c, predicate);
      if (found) return found;
    }
    if (node.branches) for (const b of node.branches) {
      if (b.actions) for (const a of b.actions) {
        const found = this.findFirst(a, predicate);
        if (found) return found;
      }
    }
    return null;
  }

  // Collapse: wrap selected nodes into a macro node
  static collapseToMacro(tree, pathStr, name = 'Macro', icon = '📦') {
    const info = this.getParentArray(tree, pathStr);
    if (!info) return null;

    const node = info.array[info.index];
    const children = node.type === 'root' ? this.clone(node.children || []) : [this.clone(node)];
    const inputs = this.extractMacroInputs(children);

    const macro = {
      type: 'macro',
      macroId: 'macro_' + Date.now(),
      name,
      icon,
      collapsed: true,
      children,
      inputs,       // param definitions [{id, label, type, default, path}]
      inputValues: {} // current values keyed by input id
    };

    // Set default values
    inputs.forEach(inp => { macro.inputValues[inp.id] = inp.default; });

    info.array[info.index] = macro;
    return macro;
  }

  // Auto-detect exposable parameters from children
  static extractMacroInputs(nodes, inputs = []) {
    const walk = (node, path) => {
      if (node.type === 'action' && node.params) {
        const actionDef = window.EnderTrack?.ActionRegistry?.get(node.actionId);
        if (!actionDef?.params) return;
        actionDef.params.forEach(p => {
          const pid = p.id || p.name;
          if (pid === 'label' || pid === 'showInLog' || pid === 'logMessage') return;
          const val = node.params[pid];
          if (val === undefined || val === null) return;
          inputs.push({
            id: `${path}.${pid}`.replace(/\./g, '_'),
            label: `${actionDef.label} → ${p.label}`,
            type: p.type || 'text',
            default: val,
            nodePath: path,
            paramName: pid
          });
        });
      }
      if (node.type === 'loop' && node.params) {
        const loopDef = window.EnderTrack?.LoopTypesRegistry?.get(node.loopId);
        if (loopDef?.params) {
          loopDef.params.forEach(p => {
            if (p.name === 'label' || p.name === 'showInLog' || p.name === 'logMessage' || p.name === 'loopVar') return;
            const val = node.params[p.name];
            if (val === undefined || val === null) return;
            inputs.push({
              id: `${path}.${p.name}`.replace(/\./g, '_'),
              label: `${loopDef.label} → ${p.label}`,
              type: p.type || 'text',
              default: val,
              nodePath: path,
              paramName: p.name
            });
          });
        }
      }
      if (node.children) node.children.forEach((c, i) => walk(c, `${path}.children.${i}`));
      if (node.branches) node.branches.forEach((b, bi) => {
        if (b.actions) b.actions.forEach((a, ai) => walk(a, `${path}.branches.${bi}.actions.${ai}`));
      });
    };
    nodes.forEach((n, i) => walk(n, String(i)));
    return inputs;
  }

  // Expand: replace macro with its children inline
  static expandMacro(tree, pathStr) {
    const info = this.getParentArray(tree, pathStr);
    if (!info) return false;

    const node = info.array[info.index];
    if (node.type !== 'macro') return false;

    info.array.splice(info.index, 1, ...(node.children || []));
    return true;
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.TreeUtils = TreeUtils;

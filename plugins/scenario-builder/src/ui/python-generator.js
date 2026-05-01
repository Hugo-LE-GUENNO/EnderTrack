// plugins/scenario-builder/src/ui/python-generator.js — Generate Python from scenario tree

class PythonGenerator {
  static generate(scenario) {
    if (!scenario?.tree) return '# Aucun scénario';

    let code = `# Scénario: ${scenario.name}\n`;
    code += `from enderscope import Stage\n`;
    code += `import time\n\n`;
    code += `stage = Stage()  # connexion série\n\n`;

    // Custom variables
    const vm = window.EnderTrack?.VariableManager;
    if (vm) {
      const custom = vm.getCustomVariables();
      if (custom.length) {
        custom.forEach(v => {
          const formula = this.pyExpr(v.formula || '0');
          code += `${v.id.replace('$', '')} = ${formula}\n`;
        });
        code += '\n';
      }
    }

    // Lists as Python arrays
    const lists = window.EnderTrack?.Lists?.manager?.getAllLists?.() || [];
    lists.forEach(list => {
      if (list.positions?.length) {
        const name = this.pyName(list.name);
        code += `${name} = [\n`;
        list.positions.forEach(p => {
          code += `    (${p.x}, ${p.y}, ${p.z}),\n`;
        });
        code += `]\n`;
      }
    });
    if (lists.length) code += '\n';

    code += `def run():\n`;
    const body = this.genNode(scenario.tree, 1);
    code += body || '    pass\n';
    code += '\n';

    // Watchers as comments (can't run in parallel in simple Python)
    if (scenario.watchers?.length) {
      code += `# Watchers (à implémenter avec threading si nécessaire)\n`;
      scenario.watchers.forEach((w, wi) => {
        code += `# ${w.label || 'Watcher ' + (wi + 1)}: `;
        (w.branches || []).forEach((b, bi) => {
          if (bi > 0) code += ', ';
          code += b.condition === null ? 'sinon' : b.condition;
        });
        code += '\n';
      });
      code += '\n';
    }

    code += `run()\n`;
    return code;
  }

  static genNode(node, indent = 0) {
    const sp = '    '.repeat(indent);
    let code = '';

    if (node.type === 'root') {
      (node.children || []).forEach(c => { code += this.genNode(c, indent); });
    } else if (node.type === 'loop') {
      const v = (node.params?.loopVar || '$i').replace('$', '');
      const mode = node.params?.countMode || 'number';

      if (node.loopId === 'while') {
        const cond = this.pyCondition(node.params?.condition || 'True');
        code += `${sp}# ${node.params?.label || 'Tant que'}\n`;
        code += `${sp}${v} = 0\n`;
        code += `${sp}while ${cond}:\n`;
      } else if (mode === 'list') {
        const listId = node.params?.countListId;
        const list = window.EnderTrack?.Lists?.manager?.getList?.(listId);
        const name = this.pyName(list?.name || 'liste');
        code += `${sp}# ${node.params?.label || 'Répéter'}\n`;
        code += `${sp}for ${v} in range(len(${name})):\n`;
      } else if (mode === 'infinite') {
        code += `${sp}# ${node.params?.label || 'Répéter'} (infini)\n`;
        code += `${sp}${v} = 0\n`;
        code += `${sp}while True:\n`;
      } else {
        code += `${sp}# ${node.params?.label || 'Répéter'}\n`;
        code += `${sp}for ${v} in range(${node.params?.count || 1}):\n`;
      }

      const children = (node.children || []).map(c => this.genNode(c, indent + 1)).join('');
      code += children || `${sp}    pass\n`;

      if (node.loopId === 'while' || mode === 'infinite') {
        code += `${sp}    ${v} += 1\n`;
      }
    } else if (node.type === 'condition') {
      code += `${sp}# ${node.params?.label || 'Condition'}\n`;
      (node.branches || []).forEach((b, bi) => {
        const kw = bi === 0 ? 'if' : (b.condition === null ? 'else' : 'elif');
        const cond = b.condition ? ` ${this.pyCondition(b.condition)}` : '';
        code += `${sp}${kw}${cond}:\n`;
        const actions = (b.actions || []).map(a => this.genNode(a, indent + 1)).join('');
        code += actions || `${sp}    pass\n`;
      });
    } else if (node.type === 'action') {
      code += this.genAction(node, indent);
    } else if (node.type === 'macro') {
      code += `${sp}# ${node.name || 'Macro'}\n`;
      (node.children || []).forEach(c => { code += this.genNode(c, indent); });
    }

    return code;
  }

  static genAction(action, indent = 0) {
    const sp = '    '.repeat(indent);
    const p = action.params || {};

    switch (action.actionId) {
      case 'move': {
        if (p.moveType === 'relative') {
          return `${sp}stage.move_relative(${this.pyExpr(p.dx || '0')}, ${this.pyExpr(p.dy || '0')}, ${this.pyExpr(p.dz || '0')})\n`;
        }
        const src = p.absSource || 'manual';
        if (src === 'list' && p.listId) {
          const list = window.EnderTrack?.Lists?.manager?.getList?.(p.listId);
          const name = this.pyName(list?.name || 'liste');
          if (p.listPickMode === 'pick') {
            return `${sp}stage.move_absolute(*${name}[${p.listPick || 0}])\n`;
          }
          const idx = (p.listIndex || '$i').replace('$', '');
          return `${sp}stage.move_absolute(*${name}[${idx}])\n`;
        }
        if (src === 'strategic') {
          return `${sp}stage.home()\n`;
        }
        // Manual — may contain variables, read position first
        const hasVar = [p.x, p.y, p.z].some(v => String(v).includes('$'));
        let out = '';
        if (hasVar) {
          out += `${sp}x, y, z = stage.get_position()\n`;
        }
        return out + `${sp}stage.move_absolute(${this.pyExpr(p.x || '0')}, ${this.pyExpr(p.y || '0')}, ${this.pyExpr(p.z || '0')})\n`;
      }
      case 'wait':
        return `${sp}time.sleep(${this.pyExpr(p.duration || '1')})\n`;
      case 'log':
        return `${sp}print(f"${this.pyExpr((p.message || '').replace(/"/g, '\\"'))}")\n`;
      case 'led':
        return `${sp}print("LED: ${p.ledColor || 'green'}")\n`;
      case 'stop':
        if (p.condition) {
          return `${sp}if ${this.pyCondition(p.condition)}:\n${sp}    return  # STOP\n`;
        }
        return `${sp}return  # STOP\n`;
      case 'extruder_advance':
        return `${sp}stage.send_gcode(f"M302 S0\\nG91\\nG1 E${this.pyExpr(p.distance || '5')} F${this.pyExpr(p.speed || '300')}\\nG90")\n`;
      case 'tempobed_set':
        return `${sp}stage.send_gcode("M140 S${this.pyExpr(p.temp || '60')}")\n`;
      case 'tempobed_off':
        return `${sp}stage.send_gcode("M140 S0")\n`;
      case 'tempobed_wait':
        return `${sp}stage.wait_for_bed_temp(${this.pyExpr(p.temp || '60')}, tolerance=${this.pyExpr(p.tolerance || '2')})\n`;
      default: {
        const args = Object.entries(p).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
        return `${sp}# ${action.actionId}(${args})\n`;
      }
    }
  }

  // Convert $var references to Python var names
  static pyExpr(expr) {
    return String(expr).replace(/\$(\w+)/g, '$1');
  }

  // Convert JS-style condition to Python
  static pyCondition(cond) {
    return cond
      .replace(/\$(\w+)/g, '$1')
      .replace(/&&/g, ' and ')
      .replace(/\|\|/g, ' or ')
      .replace(/!/g, 'not ')
      .replace(/\s+et\s+/gi, ' and ')
      .replace(/\s+ou\s+/gi, ' or ')
      .replace(/\s+non\s+/gi, 'not ');
  }

  // Sanitize name for Python variable
  static pyName(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.PythonGenerator = PythonGenerator;

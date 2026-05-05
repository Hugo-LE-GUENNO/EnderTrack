// modules/scenario/code-generator.js - Generate JavaScript code from scenario
class CodeGenerator {
  static generate(scenario) {
    if (!scenario || !scenario.tree) return '// Aucun scénario';
    
    let code = `// Scénario: ${scenario.name}\n`;
    if (scenario.description) {
      code += `// ${scenario.description}\n`;
    }
    code += `\n`;
    
    // Variables
    if (window.EnderTrack?.VariableManager) {
      const customVars = window.EnderTrack.VariableManager.getCustomVariables();
      if (customVars.length > 0) {
        code += `// Variables personnalisées\n`;
        customVars.forEach(v => {
          const value = v.type === 'string' ? `"${v.value}"` : v.value;
          code += `let ${v.name} = ${value}; // ${v.type}\n`;
        });
        code += `\n`;
      }
    }
    
    code += `async function executeScenario() {\n`;
    code += this.generateNode(scenario.tree, 1);
    code += `}\n\n`;
    
    // Watchers
    if (scenario.watchers && scenario.watchers.length > 0) {
      code += `// Surveillants (watchers)\n`;
      scenario.watchers.forEach((w, i) => {
        code += `async function watcher_${i}() {\n`;
        w.branches?.forEach((branch, j) => {
          const keyword = j === 0 ? 'if' : (branch.condition === null ? 'else' : 'else if');
          const condition = branch.condition ? ` (${branch.condition})` : '';
          code += `  ${keyword}${condition} {\n`;
          branch.actions?.forEach(action => {
            code += this.generateAction(action, 2);
          });
          code += `  }\n`;
        });
        code += `}\n\n`;
      });
    }
    
    code += `// Exécution\nexecuteScenario();`;
    
    return code;
  }
  
  static generateNode(node, indent = 0) {
    const spaces = '  '.repeat(indent);
    let code = '';
    
    if (node.type === 'root') {
      node.children?.forEach(child => {
        code += this.generateNode(child, indent);
      });
    } else if (node.type === 'loop') {
      const loopDef = window.EnderTrack?.LoopTypesRegistry?.get(node.loopId);
      const v = (node.params?.loopVar || '$i').replace('$', '');
      const mode = node.params?.countMode || 'number';
      let limit;
      if (mode === 'infinite') limit = '/* infinite */';
      else if (mode === 'list') limit = `list['${node.params?.countListId || '?'}'].length`;
      else limit = node.params?.count || 1;

      if (node.loopId === 'while') {
        code += `${spaces}// ${node.params?.label || 'Tant que'}\n`;
        code += `${spaces}while (${node.params?.condition || 'true'}) {\n`;
      } else {
        code += `${spaces}// ${node.params?.label || 'R\u00e9p\u00e9ter'}\n`;
        code += `${spaces}for (let ${v} = 0; ${v} < ${limit}; ${v}++) {\n`;
      }
      
      node.children?.forEach(child => {
        code += this.generateNode(child, indent + 1);
      });
      code += `${spaces}}\n`;
    } else if (node.type === 'condition') {
      code += `${spaces}// ${node.params?.label || 'Condition'}\n`;
      node.branches?.forEach((branch, i) => {
        const keyword = i === 0 ? 'if' : (branch.condition === null ? 'else' : 'else if');
        const condition = branch.condition ? ` (${branch.condition})` : '';
        code += `${spaces}${keyword}${condition} {\n`;
        branch.actions?.forEach(action => {
          code += this.generateAction(action, indent + 1);
        });
        code += `${spaces}}\n`;
      });
    } else if (node.type === 'action') {
      code += this.generateAction(node, indent);
    }
    
    return code;
  }
  
  static generateAction(action, indent = 0) {
    const spaces = '  '.repeat(indent);
    const actionDef = window.EnderTrack?.ActionRegistry?.get(action.actionId);
    
    if (action.disabled) {
      return `${spaces}// Action désactivée: ${action.params?.label || actionDef?.label}\n`;
    }
    
    let code = '';
    
    switch (action.actionId) {
      case 'move':
        const moveType = action.params?.moveType || 'absolute';
        if (moveType === 'relative') {
          code += `${spaces}await moveRelative(${action.params?.dx ?? 0}, ${action.params?.dy ?? 0}, ${action.params?.dz ?? 0});\n`;
        } else if (action.params?.absSource === 'list' && action.params?.listId) {
          const listObj = window.EnderTrack?.Lists?.manager?.getList?.(action.params.listId);
          const listName = listObj?.name || action.params.listId;
          if (action.params.listPickMode === 'pick') {
            code += `${spaces}await moveAbsolute(list['${listName}'][${action.params.listPick || 0}]);\n`;
          } else {
            const idx = (action.params.listIndex || '$i').replace('$', '');
            code += `${spaces}await moveAbsolute(list['${listName}'][${idx}]);\n`;
          }
        } else if (action.params?.absSource === 'strategic') {
          code += `${spaces}await goHome('${action.params?.strategicId === 'homeXYZ' ? 'xyz' : 'xy'}');\n`;
        } else {
          code += `${spaces}await moveAbsolute(${action.params?.x ?? 0}, ${action.params?.y ?? 0}, ${action.params?.z ?? 0});\n`;
        }
        break;
      case 'wait':
        code += `${spaces}await wait(${action.params?.duration || '1'});\n`;
        break;
      case 'log':
        const msg = action.params?.message || '';
        code += `${spaces}console.log("${msg}");\n`;
        break;
      case 'stop':
        code += `${spaces}return; // STOP\n`;
        break;
      case 'led':
        const color = action.params?.ledColor || 'green';
        code += `${spaces}await setLED('${color}');\n`;
        break;
      case 'extruder_advance':
        code += `${spaces}await extrude(${action.params?.distance || 5}, ${action.params?.speed || 300});\n`;
        break;
      case 'tempobed_set':
        code += `${spaces}await setBedTemp(${action.params?.temp || 60});\n`;
        break;
      case 'tempobed_off':
        code += `${spaces}await setBedTemp(0);\n`;
        break;
      case 'tempobed_wait':
        code += `${spaces}await waitForBedTemp(${action.params?.temp || 60}, ${action.params?.tolerance || 2});\n`;
        break;
      default:
        code += `${spaces}// ${actionDef?.label || action.actionId}(${JSON.stringify(action.params || {})})\n`;
    }
    
    return code;
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.CodeGenerator = CodeGenerator;

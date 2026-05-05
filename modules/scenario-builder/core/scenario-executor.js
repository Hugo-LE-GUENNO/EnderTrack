// modules/scenario/scenario-executor.js - Scenario Execution Logic
class ScenarioExecutor {
  constructor() {
    this.isExecuting = false;
    this.isPaused = false;
    this.executionStartTime = 0;
    this.context = {};
    this.safetyConditions = [];
    this.totalIterations = 0;
    this.lastWatcherState = {}; // Mémoriser le dernier état de chaque watcher
  }

  async executeTree(tree, watchers = []) {
    if (!tree || !tree.children) {
      return;
    }
    
    this.isExecuting = true;
    this.isPaused = false;
    this.executionStartTime = Date.now();
    this.context = { variables: {} };
    this.watchers = watchers || [];
    this.totalIterations = 0;
    this.lastWatcherState = {};
    this.currentLoopIndex = 0;
    
    if (window.EnderTrack?.Scenario) {
      window.EnderTrack.Scenario.isActive = true;
    }
    
    // Use preview positions as the full track, track visited in real-time
    this.allPositions = window.EnderTrack?.Scenario?.scenarioTrack?.preview || [];
    this.currentPositionIndex = 0;
    this._visitedPositions = [];
    
    // Initialize track: nothing visited yet, all remaining
    if (window.EnderTrack?.Scenario) {
      window.EnderTrack.Scenario.updateScenarioTrack(
        [],
        this.allPositions[0] || null,
        this.allPositions.slice(1)
      );
    }
    
    this.startTimingUpdate();
    
    // Écouter les changements de position en temps réel
    this.positionListener = () => {
      if (this.isExecuting && !this.isPaused) {
        this.updateTrackProgressLive();
        this.checkWatchers();
      }
    };
    
    // S'abonner aux événements de changement de position
    if (window.EnderTrack?.Events) {
      window.EnderTrack.Events.on('position:changed', this.positionListener);
    }
    
    // Initialiser les variables avant de vérifier les watchers
    this.updateVariables();
    this.checkWatchers();
    
    try {
      await this.executeNode(tree);
    } catch (error) {
      console.error('[Executor] Error:', error);
      if (window.EnderTrack?.Scenario?.addLog) {
        window.EnderTrack.Scenario.addLog(`❌ Erreur: ${error.message}`, 'error');
      }
    }
    
    this.stop();
  }
  
  updateTrackProgress() {
    const pos = window.EnderTrack?.State?.get?.()?.pos;
    if (!pos) return;

    // Add real position to visited
    if (!this._visitedPositions) this._visitedPositions = [];
    this._visitedPositions.push({ x: pos.x, y: pos.y, z: pos.z });
    this.currentPositionIndex++;

    const remaining = this.allPositions.slice(this.currentPositionIndex);
    const current = remaining.length ? remaining[0] : null;

    if (window.EnderTrack?.Scenario) {
      window.EnderTrack.Scenario.updateScenarioTrack(
        [...this._visitedPositions],
        current,
        remaining.slice(1)
      );
    }

    if (window.EnderTrack?.Canvas?.requestRender) {
      window.EnderTrack.Canvas.requestRender();
    }
  }
  
  updateTrackProgressLive() {
    if (!window.EnderTrack?.State) return;
    const pos = window.EnderTrack.State.get()?.pos;
    if (!pos) return;

    const visited = [...(this._visitedPositions || []), { x: pos.x, y: pos.y, z: pos.z }];
    const remaining = this.allPositions.slice(this.currentPositionIndex);
    const current = remaining.length ? remaining[0] : null;

    if (window.EnderTrack?.Scenario) {
      window.EnderTrack.Scenario.updateScenarioTrack(visited, current, remaining.slice(1));
    }

    if (window.EnderTrack?.Canvas?.requestRender) {
      window.EnderTrack.Canvas.requestRender();
    }
  }
  
  startTimingUpdate() {
    this.timingInterval = setInterval(() => {
      if (!this.isExecuting || this.isPaused) return;
      const elapsed = Math.floor((Date.now() - this.executionStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      const el1 = document.getElementById('sbTimer');
      const el2 = document.getElementById('sbRightTimer');
      if (el1) el1.textContent = timeStr;
      if (el2) el2.textContent = timeStr;
    }, 1000);
  }
  
  getElapsedTime() {
    return this.executionStartTime ? (Date.now() - this.executionStartTime) / 1000 : 0;
  }
  
  updateVariables() {
    if (window.EnderTrack?.VariableManager) {
      const allValues = window.EnderTrack.VariableManager.getAllValues();
      Object.assign(this.context.variables, allValues);
    }
  }

  async executeNode(node) {
    if (!this.isExecuting) {
      return;
    }
    
    // Attendre si en pause
    while (this.isPaused) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!this.isExecuting) return;
    }

    if (node.type === 'root' || node.type === 'loop') {
      if (node.type === 'loop') {
        await this.executeLoop(node);
      } else {
        // Root: exécuter les enfants
        for (const child of node.children || []) {
          if (!this.isExecuting) break;
          await this.executeNode(child);
        }
      }
    } else if (node.type === 'macro') {
      // Macro: exécuter les enfants comme un root
      for (const child of node.children || []) {
        if (!this.isExecuting) break;
        await this.executeNode(child);
      }
    } else if (node.type === 'condition') {
      await this.executeCondition(node);
    } else if (node.type === 'action') {
      await this.executeAction(node);
    }
  }

  async executeCondition(conditionNode) {
    if (!this.isExecuting) return;
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.updateVariables();
    const vars = this.context.variables;
    const branches = conditionNode.branches || [];
    
    // Find first matching branch (SI / OU SI / SINON)
    let matchedBranch = null;
    for (const branch of branches) {
      if (branch.condition === null) {
        matchedBranch = branch;
        break;
      }
      let result = false;
      if (window.EnderTrack?.ConditionEvaluator) {
        try {
          result = window.EnderTrack.ConditionEvaluator.evaluate(branch.condition, vars);
        } catch (error) {
          console.error('[Executor] Condition evaluation error:', error);
          continue;
        }
      }
      if (result) {
        matchedBranch = branch;
        break;
      }
    }
    
    if (window.EnderTrack?.Scenario?.addLog) {
      const label = conditionNode.params?.label || 'Condition';
      const matched = matchedBranch ? (matchedBranch.condition === null ? 'SINON' : matchedBranch.condition) : 'aucune';
      window.EnderTrack.Scenario.addLog(`👁️ ${label}: ${matched}`, 'info');
    }
    
    if (matchedBranch?.actions) {
      for (const child of matchedBranch.actions) {
        if (!this.isExecuting) break;
        await this.executeNode(child);
      }
    }
  }

  async executeLoop(loopNode) {
    const loopDef = window.EnderTrack?.LoopTypesRegistry?.get(loopNode.loopId);
    if (!loopDef) {
      return;
    }

    const iterationCount = loopDef.getIterationCount(loopNode.params, this.context);
    const loopVar = loopNode.params?.loopVar || '$i';
    const startIndex = loopNode.params?.startIndex || 0;
    const increment = loopNode.params?.increment || 1;
    
    if (loopNode.params.showInLog && window.EnderTrack?.Scenario?.addLog) {
      let message = loopNode.params.logMessage || `${loopNode.params.label || loopDef.label} (${iterationCount === Infinity ? '∞' : iterationCount}x)`;
      window.EnderTrack.Scenario.addLog(message, 'info');
    }
    
    // Show loop progress container
    const loopProgressContainer = document.getElementById('loop-progress-container');
    const loopTimingContainer = document.getElementById('loop-timing-container');
    if (loopProgressContainer && iterationCount > 1 && iterationCount !== Infinity) {
      loopProgressContainer.style.display = 'block';
    }
    if (loopTimingContainer && iterationCount > 1 && iterationCount !== Infinity) {
      loopTimingContainer.style.display = 'block';
    }
    
    this.loopStartTime = Date.now();

    // Boucle WHILE spéciale
    if (loopNode.loopId === 'while') {
      let i = 0;
      const maxIter = loopNode.params?.maxIterations || 100;
      const condition = loopNode.params?.condition || '$i < 10';
      
      while (i < maxIter && this.isExecuting) {
        const loopValue = startIndex + (i * increment);
        this.totalIterations++;
        this.currentLoopIndex = loopValue;
        
        while (this.isPaused) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (!this.isExecuting) break;
        }
        
        this.context.iteration = i;
        this.context.variables[loopVar] = loopValue;
        this.updateVariables();
        await this.checkWatchers();
        if (!this.isExecuting) break;
        let conditionResult = false;
        if (window.EnderTrack?.ConditionEvaluator) {
          try {
            conditionResult = window.EnderTrack.ConditionEvaluator.evaluate(condition, this.context.variables);
          } catch (error) {
            console.error('[Executor] While condition error:', error);
            break;
          }
        }
        
        if (!conditionResult) {
          break;
        }
        
        if (loopNode.params.showInLog && loopNode.params.logMessage && window.EnderTrack?.Scenario?.addLog) {
          let message = loopNode.params.logMessage;
          message = message.replace(new RegExp(loopVar.replace(/\$/g, '\\$'), 'g'), loopValue);
          if (this.context.variables) {
            Object.keys(this.context.variables).forEach(key => {
              const value = this.context.variables[key];
              if (typeof value === 'object' && value !== null) {
                message = message.replace(new RegExp(key.replace(/\$/g, '\\$'), 'g'), `(${value.x}, ${value.y}, ${value.z})`);
              } else {
                message = message.replace(new RegExp(key.replace(/\$/g, '\\$'), 'g'), value);
              }
            });
          }
          window.EnderTrack.Scenario.addLog(message, 'info');
        }
        
        for (const child of loopNode.children || []) {
          if (!this.isExecuting) break;
          await this.executeNode(child);
        }
        
        i++;
      }
      
      return;
    }

    // Boucle FOR classique
    for (let i = 0; i < iterationCount; i++) {
      if (!this.isExecuting) break;
      
      const loopValue = startIndex + (i * increment);
      
      this.totalIterations++;
      this.currentLoopIndex = loopValue;
      this.currentLoopIteration = i + 1;
      this.totalLoopIterations = iterationCount;
      
      // Update loop progress
      this.updateLoopProgress(i + 1, iterationCount);
      
      while (this.isPaused) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!this.isExecuting) break;
      }
      
      this.context.iteration = i;
      this.context.variables[loopVar] = loopValue;
      
      if (loopDef.getVariables) {
        const vars = loopDef.getVariables(loopNode.params, i);
        Object.assign(this.context.variables, vars);
      }
      
      this.updateVariables();
      await this.checkWatchers();
      if (!this.isExecuting) break;
      
      if (loopNode.params.showInLog && loopNode.params.logMessage && window.EnderTrack?.Scenario?.addLog) {
        let message = loopNode.params.logMessage;
        message = message.replace(new RegExp(loopVar.replace(/\$/g, '\\$'), 'g'), loopValue);
        if (this.context.variables) {
          Object.keys(this.context.variables).forEach(key => {
            const value = this.context.variables[key];
            if (typeof value === 'object' && value !== null) {
              message = message.replace(new RegExp(key.replace(/\$/g, '\\$'), 'g'), `(${value.x}, ${value.y}, ${value.z})`);
            } else {
              message = message.replace(new RegExp(key.replace(/\$/g, '\\$'), 'g'), value);
              }
          });
        }
        window.EnderTrack.Scenario.addLog(message, 'info');
      }
      
      if (loopDef.beforeIteration) {
        await loopDef.beforeIteration(loopNode.params, this.context);
      }
      
      for (const child of loopNode.children || []) {
        if (!this.isExecuting) break;
        await this.executeNode(child);
      }
      
      // Update loop time
      this.updateLoopTime();
    }
    
    // Hide loop progress after completion
    if (loopProgressContainer) loopProgressContainer.style.display = 'none';
    if (loopTimingContainer) loopTimingContainer.style.display = 'none';
  }

  async executeAction(actionNode) {
    if (!this.isExecuting) return;
    
    const actionDef = window.EnderTrack?.ActionRegistry?.get(actionNode.actionId);
    if (!actionDef) {
      return;
    }
    
    // Ne pas exécuter les actions désactivées (auto)
    if (actionNode.disabled) {
      return;
    }
    
    // Attendre si en pause
    while (this.isPaused) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!this.isExecuting) return;
    }

    try {
      const result = await actionDef.execute(actionNode.params, this.context);
      
      // Mettre à jour le track si c'est un mouvement
      if (actionNode.actionId === 'move') {
        this.updateTrackProgress();
      }
      
      // Si l'action a arrêté l'exécution (STOP)
      if (result?.stopped) {
        this.stop();
      }
    } catch (error) {
      console.error(`[Executor] Error executing ${actionNode.actionId}:`, error);
      if (window.EnderTrack?.Scenario?.addLog) {
        window.EnderTrack.Scenario.addLog(`❌ Erreur: ${error.message}`, 'error');
      }
    }
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    const btn = document.getElementById('pauseBtn');
    if (btn) {
      const icon = btn.querySelector('.btn-icon');
      const label = btn.querySelector('.btn-label');
      if (this.isPaused) {
        icon.textContent = '▶️';
        label.textContent = 'Reprendre';
      } else {
        icon.textContent = '⏸️';
        label.textContent = 'Pause';
      }
    }
  }

  stop() {
    this.isExecuting = false;
    this.isPaused = false;
    
    // Stop timing update
    if (this.timingInterval) {
      clearInterval(this.timingInterval);
      this.timingInterval = null;
    }
    
    // Désabonner de l'événement position
    if (this.positionListener && window.EnderTrack?.Events) {
      window.EnderTrack.Events.off('position:changed', this.positionListener);
      this.positionListener = null;
    }
  }
  
  updateLoopProgress(current, total) {
    const percent = Math.round((current / total) * 100);
    // Right panel progress
    const bar = document.getElementById('sbRightProgress');
    const text = document.getElementById('sbRightProgressText');
    const iter = document.getElementById('sbRightIteration');
    if (bar) bar.style.width = `${percent}%`;
    if (text) text.textContent = `${percent}%`;
    if (iter) iter.textContent = `${current} / ${total}`;
    // Legacy elements
    const loopProgressBar = document.getElementById('loopProgress');
    const loopProgressText = document.getElementById('loopProgressText');
    if (loopProgressBar) loopProgressBar.style.width = `${percent}%`;
    if (loopProgressText) loopProgressText.textContent = `${percent}%`;
  }
  
  updateLoopTime() {
    const loopTimeEl = document.getElementById('loopTime');
    if (!loopTimeEl || !this.loopStartTime) return;
    
    const elapsed = Math.floor((Date.now() - this.loopStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    loopTimeEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  async checkWatchers() {
    if (!this.watchers || this.watchers.length === 0) return;
    
    this.updateVariables();
    const vars = this.context.variables;
    
    for (let watcherIndex = 0; watcherIndex < this.watchers.length; watcherIndex++) {
      const watcher = this.watchers[watcherIndex];
      if (!watcher.enabled || !watcher.branches) continue;
      
      let activeBranchIndex = -1;
      
      for (let i = 0; i < watcher.branches.length; i++) {
        const branch = watcher.branches[i];
        
        if (branch.condition === null) {
          activeBranchIndex = i;
          break;
        }
        
        let triggered = false;
        if (window.EnderTrack?.ConditionEvaluator) {
          try {
            triggered = window.EnderTrack.ConditionEvaluator.evaluate(branch.condition, vars);
          } catch (error) {
            console.error('[Executor] Watcher condition error:', error);
            continue;
          }
        }
        
        if (triggered) {
          activeBranchIndex = i;
          break;
        }
      }
      
      const watcherKey = `watcher_${watcherIndex}`;
      const lastBranch = this.lastWatcherState[watcherKey];
      
      if (activeBranchIndex !== -1) {
        const isNewBranch = lastBranch !== activeBranchIndex;
        this.lastWatcherState[watcherKey] = activeBranchIndex;
        // Execute actions if branch changed, or if branch contains a STOP (always re-check)
        const hasStop = watcher.branches[activeBranchIndex].actions?.some(a => a.actionId === 'stop');
        if (isNewBranch || hasStop) {
          await this.executeWatcherActions(watcher.branches[activeBranchIndex].actions, watcher.label);
        }
      }
    }
  }
  
  async executeWatcherActions(actions, watcherLabel) {
    if (!actions || actions.length === 0) return;
    
    for (const action of actions) {
      await this.executeAction(action);
    }
  }
  
  async checkSafetyConditions() {
    if (!this.safetyConditions || this.safetyConditions.length === 0) return false;
    
    const elapsed = (Date.now() - this.executionStartTime) / 1000;
    const currentPos = window.EnderTrack?.State?.get()?.pos || { x: 0, y: 0, z: 0 };
    
    for (const condition of this.safetyConditions) {
      if (!condition.enabled) continue;
      
      let triggered = false;
      
      switch (condition.type) {
        case 'maxTime':
          triggered = elapsed >= condition.value;
          break;
        case 'maxIterations':
          triggered = this.totalIterations >= condition.value;
          break;
        case 'zMin':
          triggered = currentPos.z <= condition.value;
          break;
        case 'zMax':
          triggered = currentPos.z >= condition.value;
          break;
        case 'custom':
          if (window.EnderTrack?.ConditionEvaluator) {
            const vars = {
              $elapsed: elapsed,
              $iterations: this.totalIterations,
              $x: currentPos.x,
              $y: currentPos.y,
              $z: currentPos.z,
              ...this.context.variables
            };
            triggered = window.EnderTrack.ConditionEvaluator.evaluate(condition.expression, vars);
          }
          break;
      }
      
      if (triggered) {
        if (window.EnderTrack?.Scenario?.addLog) {
          window.EnderTrack.Scenario.addLog(`🛑 Condition de sécurité: ${condition.label || condition.type}`, 'warning');
        }
        return true;
      }
    }
    
    return false;
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ScenarioExecutor = ScenarioExecutor;

// modules/lists/lists-overlay-manager.js - Manage lists display in Navigation tab
class ListsOverlayManager {
  constructor() {
    this.container = null;
  }

  init() {
    this.container = document.getElementById('listsOverlayContainer');
    if (!this.container) return false;
    
    this.updateListsDisplay();
    return true;
  }

  updateListsDisplay() {
    if (!this.container || !window.EnderTrack?.Lists?.manager) return;
    
    const allLists = window.EnderTrack.Lists.manager.getAllLists();
    
    if (allLists.length === 0) {
      this.container.innerHTML = '<div style="font-size: var(--font-xs); color: var(--text-general); padding: var(--spacing-base);">Aucune liste disponible</div>';
      return;
    }
    
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px; background: var(--container-bg); padding: 4px; border-radius: 6px;">
        ${allLists.map(list => {
          const color = list.color || window.EnderTrack.Lists.manager.getListColor(list.id);
          const isVisible = list.showOnNavigation !== false;
          const isLocked = list.locked || false;
          
          return `
            <div style="display: grid; grid-template-columns: 12px 1fr auto auto; gap: 4px; align-items: center; padding: 0;">
              <div style="width: 12px; height: 12px; border-radius: 2px; background: ${color};"></div>
              <button onclick="window.ListsOverlayManager.openLoopModal('${list.id}')" 
                      style="flex: 1; padding: 12px 16px; border: none; background: ${isLocked ? 'transparent' : (isVisible ? 'var(--active-element)' : 'transparent')}; color: ${isLocked ? 'var(--text-general)' : (isVisible ? 'var(--text-selected)' : 'var(--text-secondary)')}; border-radius: 4px; cursor: ${isLocked ? 'not-allowed' : 'pointer'}; font-weight: 500; transition: all 0.2s ease; opacity: ${isLocked ? '0.3' : '1'}; text-align: left; font-size: var(--font-xs);" 
                      onmouseover="if (!${isLocked}) { this.style.background='var(--active-element)'; this.style.color='var(--text-selected)'; }" 
                      onmouseout="if (!${isLocked}) { this.style.background='${isVisible ? 'var(--active-element)' : 'transparent'}'; this.style.color='${isVisible ? 'var(--text-selected)' : 'var(--text-secondary)'}'; }" 
                      title="${isLocked ? 'Liste verrouillée' : 'Ouvrir le scénario'}">
                ${list.name} <span style="color: var(--text-general);">(${list.positions.length})</span>
              </button>
              <button onclick="window.ListsOverlayManager.toggleListLock('${list.id}')" 
                      style="padding: 12px 16px; border: none; background: transparent; color: var(--text-secondary); border-radius: 4px; cursor: pointer; font-weight: 500; transition: all 0.2s ease;" 
                      onmouseover="this.style.background='var(--active-element)'; this.style.color='var(--text-selected)';" 
                      onmouseout="this.style.background='transparent'; this.style.color='var(--text-secondary)';" 
                      title="${isLocked ? 'Déverrouiller' : 'Verrouiller'}">
                ${isLocked ? '🔒' : '🔓'}
              </button>
              <button onclick="window.ListsOverlayManager.toggleListVisibility('${list.id}', ${!isVisible})" 
                      style="padding: 12px 16px; border: none; background: ${isVisible ? 'var(--active-element)' : 'transparent'}; color: ${isVisible ? 'var(--text-selected)' : 'var(--text-secondary)'}; border-radius: 4px; cursor: pointer; font-weight: 500; transition: all 0.2s ease;" 
                      onmouseover="this.style.background='var(--active-element)'; this.style.color='var(--text-selected)';" 
                      onmouseout="this.style.background='${isVisible ? 'var(--active-element)' : 'transparent'}'; this.style.color='${isVisible ? 'var(--text-selected)' : 'var(--text-secondary)'}';" 
                      title="${isVisible ? 'Masquer' : 'Afficher'}">
                👁️
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  toggleListVisibility(listId, isVisible) {
    if (!window.EnderTrack?.Lists?.manager) return;
    
    const list = window.EnderTrack.Lists.manager.lists.get(listId);
    if (list) {
      list.showOnNavigation = isVisible;
      window.EnderTrack.Lists.manager.save();
      this.updateListsDisplay();
      
      if (window.EnderTrack?.Canvas?.requestRender) {
        window.EnderTrack.Canvas.requestRender();
      }
    }
  }

  toggleListLock(listId) {
    if (!window.EnderTrack?.Lists?.manager) return;
    
    const list = window.EnderTrack.Lists.manager.lists.get(listId);
    if (list) {
      list.locked = !list.locked;
      window.EnderTrack.Lists.manager.save();
      this.updateListsDisplay();
    }
  }

  async scanList(listId) {
    if (!window.EnderTrack?.Lists?.manager) return;
    
    const list = window.EnderTrack.Lists.manager.lists.get(listId);
    if (!list || list.positions.length === 0) {
      alert('Liste vide ou introuvable');
      return;
    }

    if (list.locked) {
      alert('Liste verrouillée. Déverrouillez-la avant de scanner.');
      return;
    }

    if (!confirm(`Scanner ${list.positions.length} positions de "${list.name}" ?`)) {
      return;
    }

    // Utiliser l'exécuteur de liste avec les positions de la liste
    if (window.EnderTrack?.Lists?.executor) {
      await window.EnderTrack.Lists.executor.executeList(list.positions);
    }
  }

  openLoopModal(listId) {
    const list = window.EnderTrack.Lists.manager.lists.get(listId);
    if (!list || list.locked) return;

    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    
    modal.innerHTML = `
      <div style="background: var(--panel); border-radius: 8px; padding: 20px; width: 300px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
        <h3 style="margin: 0 0 16px 0; color: var(--text-selected); font-size: 16px;">🎬 Scénario: ${list.name}</h3>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--text);">Nombre de boucles</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="number" id="loopCount" value="1" min="1" style="flex: 1; padding: 8px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text); border-radius: 4px;">
            <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text); white-space: nowrap;">
              <input type="checkbox" id="infiniteLoop" onchange="document.getElementById('loopCount').disabled = this.checked;">
              Infini
            </label>
          </div>
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--text);">Délai entre positions (s)</label>
          <input type="number" id="loopDelay" value="0.5" min="0" step="0.1" style="width: 100%; padding: 8px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text); border-radius: 4px;">
        </div>
        
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button onclick="this.closest('div[style*=fixed]').remove()" style="padding: 8px 16px; border: 1px solid var(--border); background: var(--background); color: var(--text); border-radius: 4px; cursor: pointer;">Annuler</button>
          <button onclick="window.ListsOverlayManager.startLoop('${listId}')" style="padding: 8px 16px; border: none; background: var(--primary); color: white; border-radius: 4px; cursor: pointer;">⚙️ Générer</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  }

  async startLoop(listId) {
    const loopCount = document.getElementById('infiniteLoop').checked ? 'infinite' : parseInt(document.getElementById('loopCount').value);
    const delay = parseFloat(document.getElementById('loopDelay').value) * 1000;
    
    const list = window.EnderTrack.Lists.manager.lists.get(listId);
    if (!list) return;

    // Basculer vers l'onglet Scénario AVANT de fermer le modal
    if (typeof switchTab === 'function') {
      switchTab('acquisition');
    }

    // Préparer le scénario
    if (window.EnderTrack?.Scenario) {
      window.EnderTrack.Scenario.prepareListScenario(list, loopCount, delay);
    }

    // Fermer le modal APRÈS un court délai
    setTimeout(() => {
      const modal = document.querySelector('div[style*="fixed"]');
      if (modal) modal.remove();
    }, 100);
  }
}

window.ListsOverlayManager = new ListsOverlayManager();

// core/plugin-manager.js - Dynamic plugin system
class PluginManager {
  static plugins = new Map();
  static isInitialized = false;
  static basePath = 'plugins';

  static init() {
    this.createAPI();
    this.isInitialized = true;
    return true;
  }

  static createAPI() {
    window.EnderTrackPluginAPI = {
      version: '2.0.0',
      call: (name, ...args) => EnderTrack.API?.call?.(name, ...args),
      getState: () => EnderTrack.State?.get?.(),
      on: (event, callback) => EnderTrack.Events?.on?.(event, callback),
      emit: (event, ...args) => EnderTrack.Events?.emit?.(event, ...args),
      showNotification: (msg, type) => EnderTrack.UI?.showNotification?.(msg, type),
      registerPlugin: (name, plugin) => this.register(name, plugin)
    };
  }

  // === DISCOVERY ===

  /**
   * Discover available plugins.
   * Priority: embedded registry (works in file://) → server scan → empty
   */
  static async discover() {
    const serverUrl = window.ENDERTRACK_SERVER || 'http://localhost:5000';
    
    // Try server discovery first (scans plugins/ folder for plugin.json)
    try {
      const response = await fetch(`${serverUrl}/api/plugins/discover`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        const manifests = await response.json();
        if (manifests.length) {
          manifests.forEach(m => { if (m.id) window.EnderTrackPluginRegistry[m.id] = m; });
          return manifests;
        }
      }
    } catch (e) { /* server not available */ }

    // Fallback: embedded registry
    const registry = window.EnderTrackPluginRegistry || {};
    const entries = Array.isArray(registry) ? [] : Object.entries(registry);
    return entries.filter(([id, m]) => m && m.id).map(([id, m]) => m);
  }

  static getManifest(pluginId) {
    const registry = window.EnderTrackPluginRegistry || {};
    return registry[pluginId] || null;
  }

  // === LOADING ===

  /**
   * Load a plugin's JS/CSS assets and instantiate it
   */
  static async load(pluginId) {
    if (this.plugins.has(pluginId)) {
      console.warn(`🔌 Plugin "${pluginId}" already loaded`);
      return this.plugins.get(pluginId);
    }

    const manifest = this.getManifest(pluginId);
    if (!manifest) throw new Error(`Manifest not found for "${pluginId}"`);

    const folder = manifest.folder || pluginId;
    const base = `${this.basePath}/${folder}`;

    // CSS/JS already loaded via <script>/<link> in index.html for file:// compat
    // Only load dynamically if not already present
    await this.loadCSS(`${base}/ui.css`);
    await this.loadScript(`${base}/bridge.js`);
    await this.loadScript(`${base}/ui.js`);

    // Instantiate bridge + UI using naming convention:
    // Plugin "enderscope" → EnderscopeBridge + EnderscopePluginUI
    // Plugin "controllers" → ControllersBridge + ControllersPluginUI
    const capName = this.capitalize(pluginId);
    const BridgeClass = window[`${capName}Bridge`];
    const UIClass = window[`${capName}PluginUI`];

    if (!BridgeClass || !UIClass) {
      throw new Error(`Missing classes for plugin "${pluginId}": need ${capName}Bridge + ${capName}PluginUI`);
    }

    const bridge = new BridgeClass(pluginId);
    const ui = new UIClass(manifest, bridge);

    const plugin = {
      id: pluginId,
      manifest,
      bridge,
      ui,
      isActive: false,
      loadTime: Date.now()
    };

    this.plugins.set(pluginId, plugin);
    return plugin;
  }

  // === ACTIVATION ===

  static async activate(pluginId) {
    let plugin = this.plugins.get(pluginId);
    if (!plugin) {
      plugin = await this.load(pluginId);
    }
    if (plugin.isActive) return true;

    plugin.ui.init();
    plugin.isActive = true;

    // Expose globally for onclick handlers
    window[`${this.capitalize(pluginId)}Plugin`] = plugin;

    // Notify server to load Python modules
    this.notifyServerPluginActive(pluginId, true);

    // Register plugin widgets in viewport
    this.registerPluginWidgets(plugin);

    EnderTrack.Events?.emit?.('plugin:activated', { id: pluginId });
    return true;
  }

  static async deactivate(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !plugin.isActive) return false;

    plugin.ui.destroy();
    plugin.isActive = false;

    delete window[`${this.capitalize(pluginId)}Plugin`];

    this.notifyServerPluginActive(pluginId, false);
    this.unregisterPluginWidgets(plugin);

    EnderTrack.Events?.emit?.('plugin:deactivated', { id: pluginId });
    return true;
  }

  // === VIEWPORT WIDGETS ===

  static registerPluginWidgets(plugin) {
    if (!plugin.manifest.widgets || !window.ViewportConfig) return;

    for (const w of plugin.manifest.widgets) {
      const exists = window.ViewportConfig.widgets.find(vw => vw.id === w.id);
      if (!exists) {
        window.ViewportConfig.widgets.push({
          id: w.id,
          name: w.name,
          icon: w.icon,
          description: w.description,
          enabled: false,
          required: false,
          pluginId: plugin.id
        });
      }
    }
  }

  static unregisterPluginWidgets(plugin) {
    if (!plugin.manifest.widgets || !window.ViewportConfig) return;

    const widgetIds = plugin.manifest.widgets.map(w => w.id);

    // Deactivate and free slots occupied by plugin widgets
    const vc = window.ViewportConfig;
    for (const [slot, wid] of Object.entries(vc.slotAssignments)) {
      if (widgetIds.includes(wid)) {
        vc.deactivateWidget(wid);
        delete vc.slotAssignments[slot];
      }
    }

    // Remove from widget list
    vc.widgets = vc.widgets.filter(
      w => !widgetIds.includes(w.id) || !w.pluginId
    );

    // Restore stage to slot 0 if no slots assigned
    if (Object.keys(vc.slotAssignments).length === 0) {
      const stageWidget = vc.widgets.find(w => w.id === 'stage');
      if (stageWidget) {
        stageWidget.enabled = true;
        vc.slotAssignments[0] = 'stage';
        vc.activateWidget('stage');
      }
    }

    vc.applyWidgetOrder();
    vc.saveConfig();
  }

  // === SERVER NOTIFICATION ===

  static async notifyServerPluginActive(pluginId, active) {
    try {
      await fetch((window.ENDERTRACK_SERVER || 'http://localhost:5000') + '/api/plugins/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId, active }),
        signal: AbortSignal.timeout(2000)
      });
    } catch {
      // Serveur Flask non disponible — mode simulateur, pas d'erreur
    }
  }

  // === HELPERS ===

  static loadScript(src) {
    return new Promise((resolve, reject) => {
      // Skip if already loaded (by <script> in HTML or previous call)
      if (document.querySelector(`script[src="${src}"]`)) return resolve();

      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load: ${src}`));
      document.head.appendChild(script);
    });
  }

  static loadCSS(href) {
    return new Promise((resolve) => {
      const existing = document.querySelector(`link[href="${href}"]`);
      if (existing) return resolve();

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = resolve;
      link.onerror = resolve; // CSS failure is non-fatal
      document.head.appendChild(link);
    });
  }

  static capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // === PLUGINS TAB UI ===

  /**
   * Render the list of available plugins in the Plugins tab
   */
  static async renderPluginList() {
    const container = document.getElementById('pluginsList');
    if (!container) return;

    const discovered = await this.discover();

    // Sort alphabetically by name
    discovered.sort((a, b) => a.name.localeCompare(b.name));
    this._discoveredPlugins = discovered;

    container.innerHTML = `<input type="text" id="pluginSearchInput" placeholder="🔍 Rechercher un plugin..." oninput="EnderTrack.PluginManager.filterPlugins(this.value)" style="width:100%; padding:6px 8px; margin-bottom:6px; background:var(--app-bg); border:1px solid #444; border-radius:4px; color:var(--text-selected); font-size:11px; box-sizing:border-box;">
      <div id="pluginsCards"></div>
      <div style="display:flex; gap:4px; margin-top:6px;">
        <button onclick="EnderTrack.PluginManager.loadPluginFromFolder()" style="padding:3px 8px; border:none; border-radius:3px; cursor:pointer; font-size:10px; background:var(--app-bg); color:var(--text-general);">Importer</button>
        <button onclick="EnderTrack.PluginManager.openCreateGuide()" style="padding:3px 8px; border:none; border-radius:3px; cursor:pointer; font-size:10px; background:var(--app-bg); color:var(--text-general);" title="Guide de création de plugin">?</button>
      </div>`;

    this.filterPlugins('');
  }

  static filterPlugins(query) {
    const cardsContainer = document.getElementById('pluginsCards');
    if (!cardsContainer || !this._discoveredPlugins) return;

    const q = (query || '').toLowerCase().trim();
    const filtered = q ? this._discoveredPlugins.filter(m =>
      m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
    ) : this._discoveredPlugins;

    cardsContainer.innerHTML = filtered.map(manifest => {
      const isActive = this.plugins.get(manifest.id)?.isActive || false;
      return `
        <div style="display:flex; align-items:center; gap:6px; padding:4px 0; font-size:10px;">
          <span style="color:var(--text-general);">${manifest.icon} ${manifest.name}</span>
          <span style="color:var(--text-general); opacity:0.4; flex:1;">${manifest.version}</span>
          <button style="padding:2px 8px; border:none; border-radius:3px; cursor:pointer; font-size:10px;
            background:${isActive ? 'var(--active-element)' : 'var(--app-bg)'}; color:${isActive ? 'var(--text-selected)' : 'var(--text-general)'};"
            onclick="EnderTrack.PluginManager.togglePlugin('${manifest.id}')">${isActive ? 'Actif' : 'Activer'}</button>
        </div>`;
    }).join('');
  }

  // === PLUGIN CREATION GUIDE ===

  static openCreateGuide() {
    document.getElementById('pluginGuideModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'pluginGuideModal';
    modal.className = 'enderscope-modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
      <div class="enderscope-modal" style="max-width: 560px;">
        <div class="enderscope-modal-header">
          <h3>🔌 Créer un plugin EnderTrack</h3>
          <button onclick="document.getElementById('pluginGuideModal').remove()">✕</button>
        </div>
        <div class="enderscope-modal-body" style="font-size: 12px; color: var(--text-general);">

          <div style="margin-bottom: 14px;">
            <div style="font-weight: 600; color: var(--text-selected); margin-bottom: 6px;">📁 Structure requise</div>
            <pre style="background: var(--app-bg); padding: 10px; border-radius: 4px; font-size: 11px; color: var(--coordinates-color); overflow-x: auto; margin: 0;">plugins/mon-plugin/
├── plugin.json    ← Manifeste (OBLIGATOIRE)
├── bridge.js      ← Communication (serveur ou locale)
├── ui.js          ← Interface (boutons nav + accordéon config)
├── ui.css         ← Styles
└── scripts/       ← (optionnel) Modules Python backend
    └── mon-outil.py</pre>
          </div>

          <div style="margin-bottom: 14px;">
            <div style="font-weight: 600; color: var(--text-selected); margin-bottom: 6px;">⚙️ Convention de nommage</div>
            <div style="background: var(--app-bg); padding: 8px 10px; border-radius: 4px; font-size: 11px;">
              Dossier <code style="color: var(--coordinates-color);">plugins/mon-plugin/</code> (kebab-case)
              <br>ID registry <code style="color: var(--coordinates-color);">"monPlugin"</code> (camelCase) + champ <code style="color: var(--coordinates-color);">"folder": "mon-plugin"</code>
              <br>Classes globales (capitalize de l'ID camelCase) :
              <br>• <code style="color: var(--coordinates-color);">MonPluginBridge</code> dans bridge.js
              <br>• <code style="color: var(--coordinates-color);">MonPluginPluginUI</code> dans ui.js
            </div>
          </div>

          <div style="margin-bottom: 14px;">
            <div style="font-weight: 600; color: var(--text-selected); margin-bottom: 6px;">📝 Installation</div>
            <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>Créer le dossier <code>plugins/mon-plugin/</code> avec plugin.json, bridge.js, ui.js, ui.css</li>
              <li>Cliquer <strong>📂 Charger un plugin</strong> et sélectionner le dossier</li>
            </ol>
            <div style="margin-top: 6px; opacity: 0.7; font-size: 10px;">Le plugin.json est lu automatiquement. Les fichiers JS/CSS sont chargés à l'activation.</div>
          </div>

          <div style="margin-bottom: 14px;">
            <div style="font-weight: 600; color: var(--text-selected); margin-bottom: 6px;">🤖 Méthode rapide : demander à une IA</div>
            <div style="margin-bottom: 8px; opacity: 0.8;">Copiez le prompt ci-dessous et donnez-le à un assistant IA avec votre description de plugin.</div>
            <button class="enderscope-btn-primary" style="width: 100%;" onclick="EnderTrack.PluginManager.copyAIPrompt()">
              📋 Copier le prompt IA
            </button>
            <div id="pluginPromptCopied" style="text-align: center; font-size: 11px; color: #10b981; margin-top: 4px; display: none;">✅ Copié !</div>
          </div>

        </div>
        <div class="enderscope-modal-footer">
          <div></div>
          <button class="enderscope-btn-secondary" onclick="document.getElementById('pluginGuideModal').remove()">Fermer</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  static copyAIPrompt() {
    const prompt = this.generateAIPrompt();
    navigator.clipboard.writeText(prompt).then(() => {
      const el = document.getElementById('pluginPromptCopied');
      if (el) { el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 2000); }
    }).catch(() => {
      // Fallback for file:// mode
      const ta = document.createElement('textarea');
      ta.value = prompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      const el = document.getElementById('pluginPromptCopied');
      if (el) { el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 2000); }
    });
  }

  static generateAIPrompt() {
    return `Tu dois créer un plugin pour EnderTrack, un simulateur de positionnement 3D pour microscope (Electron, vanilla JS, pas de framework).

## Architecture plugin EnderTrack

### Convention de nommage CRITIQUE
- Le **dossier** du plugin utilise le kebab-case : \`plugins/mon-plugin/\`
- L'**ID** dans le registry utilise le camelCase : \`'monPlugin'\`
- Le manifest DOIT contenir un champ **\`"folder"\`** pointant vers le nom réel du dossier : \`"folder": "mon-plugin"\`
- Les **classes JS** utilisent le capitalize de l'ID camelCase : \`MonPluginBridge\` + \`MonPluginPluginUI\`
- La **globale** exposée par le PluginManager est \`window.MonPluginPlugin\` (capitalize(id) + "Plugin")

Exemple complet :
| Dossier | ID registry | folder | Bridge class | UI class | Globale onclick |
|---------|-------------|--------|-------------|----------|----------------|
| plugins/mon-plugin/ | monPlugin | "mon-plugin" | MonPluginBridge | MonPluginPluginUI | window.MonPluginPlugin |
| plugins/random-button/ | randomButton | "random-button" | RandomButtonBridge | RandomButtonPluginUI | window.RandomButtonPlugin |
| plugins/enderscope/ | enderscope | (omis car = id) | EnderscopeBridge | EnderscopePluginUI | window.EnderscopePlugin |

Note : si le dossier a le même nom que l'ID (ex: \`enderscope\`), le champ \`folder\` peut être omis.

Chaque plugin vit dans plugins/<dossier-kebab-case>/ et nécessite 3-4 fichiers :

### 1. bridge.js — Communication
Classe globale \`window.<CapitalizedId>Bridge\` (CapitalizedId = première lettre de l'ID camelCase en majuscule).
- Si le plugin a un backend Python : communique via fetch() vers http://localhost:5000/api/plugins/<id>/<tool>/<action>
- Si le plugin est local (pas de serveur) : wrapper autour de la logique JS
- Méthodes typiques : call(), getStatus(), activate(), deactivate()
- Les méthodes publiques du bridge sont auto-découvertes et peuvent être mappées sur des boutons gamepad/MIDI

Exemple bridge avec serveur :
\`\`\`javascript
class MonPluginBridge {
  constructor(pluginId) {
    this.pluginId = pluginId;
    this.serverUrl = window.ENDERTRACK_SERVER || 'http://localhost:5000';
  }
  async call(toolId, endpoint, params = {}) {
    const url = \`\$\{this.serverUrl}/api/plugins/\$\{this.pluginId}/\$\{toolId}\$\{endpoint}\`;
    try {
      const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(params) });
      return await res.json();
    } catch (e) { return { success: false, error: e.message }; }
  }
  async maFonction() { return this.call('mon-outil', '/action'); }
}
window.MonPluginBridge = MonPluginBridge;
\`\`\`

Exemple bridge local (sans serveur) :
\`\`\`javascript
class MonPluginBridge {
  constructor() { this.state = {}; }
  activate() { /* init */ }
  deactivate() { /* cleanup */ }
  getStatus() { return { connected: true }; }
  maFonction() { /* logique locale */ }
}
window.MonPluginBridge = MonPluginBridge;
\`\`\`

### 2. ui.js — Interface utilisateur
Classe globale \`window.<Id>PluginUI\`.
- Reçoit (manifest, bridge) dans le constructeur
- init() : injecte les éléments UI (boutons nav, accordéon config)
- destroy() : nettoie tout
- Peut injecter des boutons dans l'onglet Navigation (#navigationTabContent)
- Peut injecter un accordéon <details> dans l'onglet Configs (#settingsTabContent)
- Peut ouvrir des modales
- Les onclick doivent référencer window.<Id>Plugin?.ui?.methode() (le PluginManager expose cette globale)

Exemple :
\`\`\`javascript
class MonPluginPluginUI {
  constructor(manifest, bridge) { this.manifest = manifest; this.bridge = bridge; }
  init() { this.injectConfigAccordion(); }
  destroy() { this.configEl?.remove(); }
  injectConfigAccordion() {
    const settings = document.getElementById('settingsTabContent');
    if (!settings) return;
    this.configEl = document.createElement('details');
    this.configEl.id = 'monplugin-config';
    this.configEl.innerHTML = \`
      <summary>\$\{this.manifest.icon} \$\{this.manifest.name}</summary>
      <div class="setting-group">
        <button class="enderscope-settings-btn" onclick="window.MonPluginPlugin?.ui?.maMethode()">Mon Action</button>
      </div>
    \`;
    settings.prepend(this.configEl);
  }
  maMethode() { this.bridge.maFonction(); }
}
window.MonPluginPluginUI = MonPluginPluginUI;
\`\`\`

### 3. ui.css — Styles
Utiliser les variables CSS du thème EnderTrack :
- --coordinates-color: #ffc107 (jaune, valeurs)
- --text-general: #888 (gris, texte)
- --text-selected: #fff (blanc, actif)
- --active-element: #4a5568 (gris-bleu, boutons actifs)
- --container-bg: #2c2c2c / --column-bg: #333 / --app-bg: #181818
- --radius: 8px / --radius-small: 4px
Réutiliser les classes existantes : .enderscope-nav-bar, .enderscope-nav-btn, .enderscope-settings-btn, .enderscope-modal-backdrop, .enderscope-modal, etc.

### 4. scripts/*.py — Backend (optionnel)
Modules Python chargés dynamiquement par le serveur Flask.
Chaque fichier doit exposer un dict ACTIONS :
\`\`\`python
ACTIONS = {
    'mon-action': { 'method': 'POST', 'handler': ma_fonction },
}
def ma_fonction(data):
    return {'success': True, 'result': 'ok'}
\`\`\`

### 5. plugin.json — Manifeste (OBLIGATOIRE)

Chaque plugin DOIT avoir un fichier \`plugin.json\` à la racine de son dossier :
\`\`\`json
{
  "id": "monPlugin",
  "name": "Mon Plugin",
  "version": "1.0.0",
  "description": "Description courte",
  "icon": "🔌",
  "tools": [ { "id": "mon-outil", "name": "Mon Outil", "icon": "🛠️", "type": "custom" } ],
  "widgets": [],
  "navButtons": []
}
\`\`\`

### Installation par l'utilisateur
L'utilisateur place le dossier dans \`plugins/\` puis clique "📂 Charger un plugin" dans l'onglet Plugins.
Le système lit automatiquement le \`plugin.json\`, enregistre le plugin, et persiste dans localStorage.
Pas besoin de modifier index.html ni registry.js.

## API EnderTrack disponible pour les plugins

### État (State)
\`\`\`javascript
EnderTrack.State.get()          // → { pos: {x,y,z}, inputMode, historyMode, positionHistory, ... }
EnderTrack.State.update({...})  // Modifier l'état (ex: {pos: {x:10, y:20, z:0}})
EnderTrack.State.set(key, val)  // Modifier une propriété
EnderTrack.State.getProperty(key)
EnderTrack.State.toggleHistoryMode()
EnderTrack.State.goToPreviousPosition()
EnderTrack.State.goToNextPosition()
EnderTrack.State.goToHistoryPosition(index)
EnderTrack.State.recordFinalPosition({x,y,z})
EnderTrack.State.clearHistory()
EnderTrack.State.saveTrack()
EnderTrack.State.loadTrack()
\`\`\`

### Mouvement
\`\`\`javascript
EnderTrack.Movement.moveAbsolute(x, y, z)   // Déplacement absolu animé
EnderTrack.Movement.moveRelative(dx, dy, dz)
window.moveDirection('up'|'down'|'left'|'right'|'zUp'|'zDown')  // Mouvement directionnel
window.goHome('xy'|'xyz')                   // Retour origine
window.goToAbsolute()                       // Aller aux coordonnées saisies
window.emergencyStop()                      // Arrêt d'urgence
window.toggleCoupling()                     // Couplage XY on/off
window.setAxisPreset('xy'|'z', 'fine'|'coarse')  // Presets sensibilité
\`\`\`

### Canvas
\`\`\`javascript
EnderTrack.Canvas.requestRender()           // Forcer un rafraîchissement
EnderTrack.Canvas.centerView(worldX, worldY)
EnderTrack.Canvas.exportAsImage(filename)
EnderTrack.API.call('mapToCanvas', x, y)    // → {x, y} pixels
EnderTrack.API.call('canvasToMap', x, y)    // → {x, y} mm
EnderTrack.API.call('drawCircle', x, y, r, color, fill)
EnderTrack.API.call('drawLine', x1, y1, x2, y2, color, width)
EnderTrack.API.call('drawText', x, y, text, color)
\`\`\`

### UI
\`\`\`javascript
EnderTrack.UI.showNotification(message, 'info'|'success'|'warning'|'error')
EnderTrack.UI.showSuccess(message)
EnderTrack.UI.showError(message)
switchTab('navigation'|'lists'|'others'|'settings'|'acquisition')
\`\`\`

### Événements
\`\`\`javascript
EnderTrack.Events.on(event, callback)
EnderTrack.Events.off(event, callback)
EnderTrack.Events.emit(event, ...args)
// Événements disponibles :
// 'position:changed', 'movement:started', 'movement:completed', 'movement:emergency_stop'
// 'state:changed', 'state:reset', 'tab:switched'
// 'canvas:clicked', 'canvas:rendered'
// 'history:cleared', 'track:loaded'
// 'plugin:activated', 'plugin:deactivated'
// 'plugin:image-acquired' (émis par le plugin enderscope)
\`\`\`

### Listes
\`\`\`javascript
EnderTrack.Lists.addCurrentPosition()       // Ajouter la position actuelle
EnderTrack.Lists.manager.getCurrentList()   // → { positions: [{x,y,z,name},...] }
EnderTrack.Lists.manager.addPosition(x,y,z,name)
EnderTrack.Lists.executor.executeList(positions)  // Parcourir la liste
EnderTrack.Lists.executor.stopExecution()
EnderTrack.Lists.executor.getExecutionStatus()    // → { isExecuting, currentIndex, progress }
\`\`\`

### Scénario
\`\`\`javascript
EnderTrack.Scenario.executor.togglePause()
EnderTrack.Scenario.executor.stop()
EnderTrack.Scenario.prepareListScenario(list, loopCount, delay)
\`\`\`

### Maths utilitaires
\`\`\`javascript
EnderTrack.Math.distance2D(x1,y1,x2,y2)
EnderTrack.Math.distance3D(x1,y1,z1,x2,y2,z2)
EnderTrack.Math.clamp(value, min, max)
EnderTrack.Math.round(value, decimals)
EnderTrack.Math.lerp(start, end, t)
EnderTrack.Math.isValidNumber(value)
EnderTrack.Math.isValidPoint({x,y,z})
\`\`\`

### Validation
\`\`\`javascript
EnderTrack.Validation.isValidCoordinate(coord, bounds)
EnderTrack.Validation.isValidNumber(value, {min, max})
EnderTrack.Validation.validateMovementParameters(params)
\`\`\`

### Coordonnées et limites
\`\`\`javascript
EnderTrack.Coordinates.getCoordinateBounds()  // → { minX, maxX, minY, maxY, minZ, maxZ }
EnderTrack.Coordinates.getDimensions()        // → { x, y, z }
\`\`\`

### Injection UI — éléments HTML cibles
- #navigationTabContent — onglet Navigation (boutons d'action)
- #settingsTabContent — onglet Configs (accordéons <details>)
- #canvasDisplay — zone viewport (widgets)
- Classes CSS réutilisables : .enderscope-nav-bar, .enderscope-nav-btn, .enderscope-settings-btn, .enderscope-modal-backdrop, .enderscope-modal, .enderscope-modal-header/body/footer, .enderscope-btn-primary, .enderscope-btn-secondary, .enderscope-tool-row

## Contexte technique
- L'app tourne en mode file:// (Electron), pas de fetch() pour fichiers locaux → tout charger via <script>/<link>
- Interface en français
- Tout est vanilla JS, pas de framework
- Les plugins ne s'activent PAS au démarrage, l'utilisateur les active depuis l'onglet Plugins
- Le serveur Flask (optionnel) tourne sur http://localhost:5000 et charge les scripts Python dynamiquement

💡 Pour la référence API complète, l'utilisateur peut aussi fournir le fichier README.md du projet.

## Ma demande
[DÉCRIVEZ ICI VOTRE PLUGIN : nom, ce qu'il fait, quels outils, s'il a besoin d'un backend Python ou pas, quels boutons dans l'interface]

Génère TOUS les fichiers nécessaires :
1. plugins/<dossier>/plugin.json (manifeste avec id, name, version, description, icon, tools)
2. plugins/<dossier>/bridge.js (avec classe window.<CapitalizedCamelId>Bridge)
3. plugins/<dossier>/ui.js (avec classe window.<CapitalizedCamelId>PluginUI)
4. plugins/<dossier>/ui.css
5. plugins/<dossier>/scripts/*.py (si backend nécessaire)

Ne PAS modifier index.html ni registry.js — l'utilisateur charge le plugin via le bouton "📂 Charger un plugin".`;
  }

  // === LOAD FROM FOLDER ===

  /**
   * Open a folder picker, read plugin.json, register the plugin
   */
  static loadPluginFromFolder() {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('webkitdirectory', '');
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;

      // Find plugin.json in selected folder
      const manifestFile = files.find(f => f.name === 'plugin.json');
      if (!manifestFile) {
        EnderTrack.UI?.showError?.('Aucun plugin.json trouvé dans ce dossier');
        return;
      }

      try {
        const text = await manifestFile.text();
        const manifest = JSON.parse(text);

        if (!manifest.id) {
          EnderTrack.UI?.showError?.('plugin.json invalide : champ "id" manquant');
          return;
        }

        // Derive folder name from the file path
        // webkitRelativePath = "folder-name/plugin.json"
        const relPath = manifestFile.webkitRelativePath || '';
        const folderName = relPath.split('/')[0];
        if (folderName && folderName !== manifest.id) {
          manifest.folder = folderName;
        }

        // Register in global registry + persist
        window.EnderTrackPluginRegistry._register(manifest);

        EnderTrack.UI?.showSuccess?.(`Plugin "${manifest.icon} ${manifest.name}" chargé !`);
        this.renderPluginList();
      } catch (e) {
        EnderTrack.UI?.showError?.(`Erreur lecture plugin.json : ${e.message}`);
      }
    };
    input.click();
  }

  /**
   * Remove a plugin from the registry
   */
  static removePlugin(pluginId) {
    // Deactivate first if active
    if (this.plugins.get(pluginId)?.isActive) {
      this.deactivate(pluginId);
    }
    this.plugins.delete(pluginId);
    window.EnderTrackPluginRegistry._unregister(pluginId);
    this.renderPluginList();
  }

  /**
   * Toggle a plugin on/off from the Plugins tab
   */
  static async togglePlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    const wasActive = plugin?.isActive;
    try {
      if (wasActive) {
        await this.deactivate(pluginId);
        EnderTrack.UI?.showNotification?.('Plugin ' + pluginId + ' désactivé', 'info');
      } else {
        await this.activate(pluginId);
        EnderTrack.UI?.showNotification?.('Plugin ' + pluginId + ' activé ✅', 'success');
      }
    } catch(e) {
      EnderTrack.UI?.showNotification?.('Erreur plugin ' + pluginId + ': ' + e.message, 'error');
      console.error('[PluginManager] Toggle error:', e);
    }
    this.renderPluginList();
  }

  // === QUERY ===

  static register(name, plugin) {
    if (this.plugins.has(name)) {
      console.warn(`Plugin ${name} already registered`);
      return false;
    }
    this.plugins.set(name, {
      id: name,
      manifest: { name, icon: '🔌' },
      instance: plugin,
      isActive: false,
      loadTime: Date.now()
    });
    return true;
  }

  static getAll() {
    const result = {};
    this.plugins.forEach((plugin, name) => {
      result[name] = {
        name: plugin.manifest?.name || name,
        icon: plugin.manifest?.icon || '🔌',
        isActive: plugin.isActive,
        loadTime: plugin.loadTime
      };
    });
    return result;
  }

  static getActive() {
    return Array.from(this.plugins.entries())
      .filter(([_, p]) => p.isActive)
      .map(([name]) => name);
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.PluginManager = PluginManager;

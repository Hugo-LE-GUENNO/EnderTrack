// modules/ui/appearance.js - Appearance settings (themes, languages, profiles)
// Reads from themes/registry.js, supports user-added packs

(function() {
  function getRegistry() { return window.EnderTrackAppearanceRegistry || { themes: [], languages: [], profiles: [] }; }

  function getPrefs() {
    try { return JSON.parse(localStorage.getItem('endertrack-theme-preferences') || '{}'); }
    catch { return {}; }
  }

  function savePrefs(prefs) {
    localStorage.setItem('endertrack-theme-preferences', JSON.stringify(prefs));
  }

  function applyTheme(id) {
    document.documentElement.setAttribute('data-theme', id);
    // Load theme CSS if it has a folder
    const reg = getRegistry();
    const theme = reg.themes.find(t => t.id === id);
    if (theme && !theme.builtin) {
      const href = `themes/${theme.folder || theme.id}/theme.css`;
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
      }
    }
    window.EnderTrack?.ThemeManager?.setVisualTheme?.(id);
  }

  function render() {
    const el = document.getElementById('appearanceSettings');
    if (!el) return;

    const reg = getRegistry();
    const prefs = getPrefs();
    const currentTheme = prefs.visualTheme || 'enderscope';
    const currentLang = prefs.language || 'fr';
    const currentProfile = prefs.profile || 'expert';

    const row = (label, id, options, current) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0;">
        <span style="font-size:12px; color:var(--text-general);">${label}</span>
        <select id="${id}" style="padding:4px 8px; background:var(--app-bg); border:1px solid #444; border-radius:4px; color:var(--text-selected); font-size:11px;">
          ${options.map(o => `<option value="${o.id}" ${o.id === current ? 'selected' : ''}>${o.icon ? o.icon + ' ' : ''}${o.name}</option>`).join('')}
        </select>
      </div>`;

    el.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${row('Thème', 'appThemeSelect', reg.themes, currentTheme)}
        ${row('Langue', 'appLangSelect', reg.languages, currentLang)}
        ${row('Profil', 'appProfileSelect', reg.profiles, currentProfile)}
      </div>`;

    document.getElementById('appThemeSelect')?.addEventListener('change', e => {
      const p = getPrefs(); p.visualTheme = e.target.value; savePrefs(p);
      applyTheme(e.target.value);
    });
    document.getElementById('appLangSelect')?.addEventListener('change', e => {
      const p = getPrefs(); p.language = e.target.value; savePrefs(p);
      applyLanguage(e.target.value);
    });
    document.getElementById('appProfileSelect')?.addEventListener('change', e => {
      const p = getPrefs(); p.profile = e.target.value; savePrefs(p);
      applyProfile(e.target.value);
    });
  }

  function applyProfile(id) {
    if (id !== 'expert' && !window.EnderTrackProfiles?.[id]) {
      const reg = getRegistry();
      const prof = reg.profiles.find(p => p.id === id);
      const folder = prof?.folder || id;
      const src = `themes/${folder}/profile.js`;
      if (!document.querySelector(`script[src="${src}"]`)) {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => window.EnderTrack?.ThemeManager?.setProfile?.(id);
        document.head.appendChild(s);
        return;
      }
    }
    window.EnderTrack?.ThemeManager?.setProfile?.(id);
  }

  function loadPack() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const manifest = JSON.parse(text);
        if (!manifest.id || !manifest.type || !manifest.name) {
          alert('Manifest invalide : id, type et name requis');
          return;
        }
        const reg = getRegistry();
        const target = manifest.type === 'theme' ? 'themes' : manifest.type === 'language' ? 'languages' : 'profiles';
        if (!reg[target].find(t => t.id === manifest.id)) {
          const entry = { id: manifest.id, name: manifest.name, icon: manifest.icon || '', folder: manifest.folder || manifest.id };
          reg[target].push(entry);
          // Persist user additions
          const userPacks = JSON.parse(localStorage.getItem('endertrack-appearance-registry') || '{}');
          if (!userPacks[target]) userPacks[target] = [];
          userPacks[target].push(entry);
          localStorage.setItem('endertrack-appearance-registry', JSON.stringify(userPacks));
        }
        render();
      } catch { alert('Erreur de lecture du manifest'); }
    };
    input.click();
  }

  function openGuide(type) {
    document.getElementById('appearanceGuideModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'appearanceGuideModal';
    modal.className = 'enderscope-modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    const sections = {
      theme: {
        title: '🎨 Créer un thème',
        content: `<pre style="background:var(--app-bg); padding:10px; border-radius:4px; font-size:11px; color:var(--coordinates-color); margin:0;">themes/mon-theme/
├── manifest.json
└── theme.css</pre>
<p style="margin:8px 0 4px; font-weight:600; color:var(--text-selected);">manifest.json</p>
<pre style="background:var(--app-bg); padding:10px; border-radius:4px; font-size:11px; color:var(--coordinates-color); margin:0;">{
  "id": "mon-theme", "type": "theme",
  "name": "Mon Thème", "icon": "🎨"
}</pre>
<p style="margin:8px 0 4px; font-weight:600; color:var(--text-selected);">theme.css</p>
<pre style="background:var(--app-bg); padding:10px; border-radius:4px; font-size:11px; color:var(--coordinates-color); margin:0;">[data-theme="mon-theme"] {
  --coordinates-color: #ffc107;
  --text-general: #888888;
  --text-selected: #ffffff;
  --active-element: #4a5568;
  --container-bg: #2c2c2c;
  --column-bg: #333333;
  --app-bg: #181818;
}</pre>`
      },
      profile: {
        title: '👤 Créer un profil',
        content: `<pre style="background:var(--app-bg); padding:10px; border-radius:4px; font-size:11px; color:var(--coordinates-color); margin:0;">themes/mon-profil/
├── manifest.json
└── profile.js</pre>
<p style="margin:8px 0 4px; font-weight:600; color:var(--text-selected);">manifest.json</p>
<pre style="background:var(--app-bg); padding:10px; border-radius:4px; font-size:11px; color:var(--coordinates-color); margin:0;">{
  "id": "student", "type": "profile",
  "name": "Étudiant",
  "desc": "Interface pédagogique simplifiée"
}</pre>
<p style="margin:8px 0 4px; font-weight:600; color:var(--text-selected);">profile.js — Masquer/afficher des éléments</p>
<pre style="background:var(--app-bg); padding:10px; border-radius:4px; font-size:11px; color:var(--coordinates-color); margin:0;">window.EnderTrackProfiles = window.EnderTrackProfiles || {};
window.EnderTrackProfiles['student'] = {
  hideTabs: ['settings', 'others'],
  hideElements: ['.step-controls'],
  defaultPreset: 'coarse'
};</pre>`
      },
      language: {
        title: '🌐 Créer une langue',
        content: `<pre style="background:var(--app-bg); padding:10px; border-radius:4px; font-size:11px; color:var(--coordinates-color); margin:0;">themes/en/
├── manifest.json
└── translations.js</pre>
<p style="margin:8px 0 4px; font-weight:600; color:var(--text-selected);">manifest.json</p>
<pre style="background:var(--app-bg); padding:10px; border-radius:4px; font-size:11px; color:var(--coordinates-color); margin:0;">{
  "id": "en", "type": "language",
  "name": "English"
}</pre>
<p style="margin:8px 0 4px; font-weight:600; color:var(--text-selected);">translations.js</p>
<pre style="background:var(--app-bg); padding:10px; border-radius:4px; font-size:11px; color:var(--coordinates-color); margin:0;">window.EnderTrackTranslations = window.EnderTrackTranslations || {};
window.EnderTrackTranslations['en'] = {
  'Navigation': 'Navigation',
  'Listes': 'Lists',
  'Scénario': 'Scenario',
  'Extensions': 'Extensions',
  'Configs': 'Settings'
};</pre>`
      }
    };

    const s = sections[type] || { title: '🎨 Créer un pack Apparence', content: Object.values(sections).map(s => s.content).join('<hr style="border-color:#333; margin:12px 0;">') };

    modal.innerHTML = `
      <div class="enderscope-modal" style="max-width:520px;">
        <div class="enderscope-modal-header">
          <h3>${s.title}</h3>
          <button onclick="document.getElementById('appearanceGuideModal').remove()">✕</button>
        </div>
        <div class="enderscope-modal-body" style="font-size:12px; color:var(--text-general);">
          ${s.content}
          <div style="margin-top:16px; padding-top:12px; border-top:1px solid #333;">
            <div style="font-weight:600; color:var(--text-selected); margin-bottom:8px;">🤖 Générer avec une IA</div>
            <p style="opacity:0.8; margin-bottom:8px;">Copiez ce prompt et donnez-le à un assistant IA avec votre description.</p>
            <button class="enderscope-btn-primary" style="width:100%;" onclick="EnderTrack.Appearance.copyAIPrompt()">
              📋 Copier le prompt IA
            </button>
            <div id="appearancePromptCopied" style="text-align:center; font-size:11px; color:#10b981; margin-top:4px; display:none;">✅ Copié !</div>
          </div>
        </div>
        <div class="enderscope-modal-footer">
          <div></div>
          <button class="enderscope-btn-secondary" onclick="document.getElementById('appearanceGuideModal').remove()">Fermer</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  function applyLanguage(id) {
    if (id !== 'fr' && !window.EnderTrackTranslations?.[id]) {
      const reg = getRegistry();
      const lang = reg.languages.find(l => l.id === id);
      const folder = lang?.folder || id;
      const src = `themes/${folder}/translations.js`;
      if (!document.querySelector(`script[src="${src}"]`)) {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => window.EnderTrack?.ThemeManager?.setLanguage?.(id);
        document.head.appendChild(s);
        return;
      }
    }
    window.EnderTrack?.ThemeManager?.setLanguage?.(id);
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(render, 300));

  window.EnderTrack = window.EnderTrack || {};
  window.EnderTrack.Appearance = { render, loadPack, openGuide, copyAIPrompt };

  function copyAIPrompt() {
    const prompt = generateAIPrompt();
    const ta = document.createElement('textarea');
    ta.value = prompt;
    ta.style.cssText = 'position:fixed; top:0; left:0; width:1px; height:1px; opacity:0; z-index:99999;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      const el = document.getElementById('appearancePromptCopied');
      if (el) { el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 2000); }
    } catch (e) {
      console.warn('Copy failed:', e);
    }
    ta.remove();
  }
  function generateAIPrompt() {
    return `Tu dois créer un pack d'apparence pour EnderTrack, un simulateur de positionnement 3D pour microscope (Electron, vanilla JS).

## Types de packs

Il existe 3 types : **theme**, **language**, **profile**. Chaque pack vit dans \`themes/<mon-pack>/\` avec un \`manifest.json\` obligatoire.

## 1. Thème

Structure :
\`\`\`
themes/mon-theme/
├── manifest.json
└── theme.css
\`\`\`

manifest.json :
\`\`\`json
{
  "id": "mon-theme",
  "type": "theme",
  "name": "Mon Thème",
  "icon": "🎨",
  "version": "1.0.0",
  "description": "Description du thème",
  "css": "theme.css"
}
\`\`\`

theme.css — Surcharger les variables CSS avec le sélecteur \`[data-theme="mon-theme"]\` :
\`\`\`css
[data-theme="mon-theme"] {
  --coordinates-color: #ffc107;     /* Jaune - Valeurs numériques */
  --text-general: #888888;          /* Gris - Texte standard */
  --text-selected: #ffffff;         /* Blanc - Texte sélectionné */
  --active-element: #4a5568;        /* Gris-bleu - Éléments actifs */
  --container-bg: #2c2c2c;          /* Background conteneurs */
  --column-bg: #333333;             /* Background colonnes */
  --app-bg: #181818;                /* Background application */
  --pos-current: #ffffff;           /* Crosshair position actuelle */
  --pos-potential: #ffc107;         /* Crosshair position future */
  --pos-history: #888888;           /* Points historique */
  --radius: 8px;
  --radius-small: 4px;
  --shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
\`\`\`

Le thème Enderscope (défaut) est sombre. Pour un thème clair, inverser les backgrounds et ajuster les contrastes.

## 2. Langue

Structure :
\`\`\`
themes/ja/
├── manifest.json
└── translations.js
\`\`\`

manifest.json :
\`\`\`json
{
  "id": "ja",
  "type": "language",
  "name": "日本語",
  "version": "1.0.0",
  "translations": "translations.js"
}
\`\`\`

translations.js — Objet clé/valeur (clés = texte français source) :
\`\`\`javascript
window.EnderTrackTranslations = window.EnderTrackTranslations || {};
window.EnderTrackTranslations['ja'] = {
  'Navigation': 'ナビゲーション',
  'Listes': 'リスト',
  'Scénario': 'シナリオ',
  'Extensions': '拡張機能',
  'Configs': '設定',
  'Sensibilité': '感度',
  'Exécuter': '実行',
  'Pause': '一時停止',
  'Stop': '停止',
  // ... toutes les clés françaises à traduire
};
\`\`\`

Le français est la langue source. La fonction \`EnderTrack.ThemeManager.t('clé')\` retourne la traduction ou la clé si absente.

## 3. Profil utilisateur

manifest.json :
\`\`\`json
{
  "id": "student",
  "type": "profile",
  "name": "Étudiant",
  "desc": "Interface pédagogique simplifiée",
  "version": "1.0.0"
}
\`\`\`

## Installation

1. Créer le dossier \`themes/mon-pack/\` avec manifest.json (+ theme.css si thème)
2. Ajouter l'entrée dans \`themes/registry.js\` OU utiliser le bouton "📂 Charger un pack" dans l'interface

## Consignes

- Respecter les variables CSS existantes pour la cohérence
- Tester le contraste texte/background pour la lisibilité
- Le sélecteur CSS DOIT être \`[data-theme="<id>"]\`
- L'id du manifest DOIT correspondre au nom du dossier`;
  }
})();

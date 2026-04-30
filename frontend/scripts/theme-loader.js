/* ============================================
   EnderTrack - Theme Switcher
   Fonction pour changer de thème dynamiquement
   ============================================ */

// Fonction globale pour changer de thème
window.switchTheme = function(themeName) {
  const themeLink = document.getElementById('theme-stylesheet');
  if (themeLink) {
    const newHref = `frontend/assets/themes/${themeName}.css`;
    themeLink.href = newHref;
    localStorage.setItem('endertrack_theme', themeName);
    
    // Mettre à jour le sélecteur si présent
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
      themeSelector.value = themeName;
    }
    
    // Forcer le re-render du canvas après un court délai
    setTimeout(() => {
      if (window.EnderTrack?.Canvas?.requestRender) {
        window.EnderTrack.Canvas.requestRender();
      }
    }, 100);
  }
};

// Fonction pour obtenir le thème actuel
window.getCurrentTheme = function() {
  return localStorage.getItem('endertrack_theme') || 'endertrack-dark';
};

// Fonction pour lister les thèmes disponibles
window.getAvailableThemes = function() {
  return [
    { id: 'endertrack-dark', name: 'Endertrack Dark' },
    { id: 'endertrack-light', name: 'Endertrack Light' }
  ];
};

// Initialiser le sélecteur au chargement
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThemeSelector);
} else {
  initThemeSelector();
}

function initThemeSelector() {
  const themeSelector = document.getElementById('themeSelector');
  
  if (themeSelector) {
    const currentTheme = getCurrentTheme();
    themeSelector.value = currentTheme;
  }
}

// modules/themes/theme-manager.js - Minimal theme/i18n/profile loader (core)

class ThemeManager {
  constructor() {
    this.currentVisualTheme = 'enderscope';
    this.currentLanguage = 'fr';
    this.currentProfile = 'expert';
    this.isInitialized = false;
  }

  async init() {
    try {
      const saved = JSON.parse(localStorage.getItem('endertrack-theme-preferences') || '{}');
      this.currentVisualTheme = saved.visualTheme || 'enderscope';
      this.currentLanguage = saved.language || 'fr';
      this.currentProfile = saved.profile || 'expert';
    } catch { /* default */ }
    document.documentElement.setAttribute('data-theme', this.currentVisualTheme);
    this.applyProfile();
    this.isInitialized = true;
    return true;
  }

  // === THEME ===

  setVisualTheme(name) {
    this.currentVisualTheme = name;
    document.documentElement.setAttribute('data-theme', name);
    this._savePref('visualTheme', name);
    window.EnderTrack?.Events?.emit?.('theme:changed', { visualTheme: name });
  }

  getCurrentTheme() { return this.currentVisualTheme; }

  // === i18n ===

  t(key) {
    if (this.currentLanguage !== 'fr') {
      const dict = window.EnderTrackTranslations?.[this.currentLanguage];
      if (dict?.[key]) return dict[key];
    }
    return key;
  }

  setLanguage(code) {
    this.currentLanguage = code;
    this._savePref('language', code);
    this.applyTranslations();
    window.EnderTrack?.Events?.emit?.('language:changed', { language: code });
  }

  applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = this.t(el.getAttribute('data-i18n'));
    });
  }

  // === PROFILES ===

  setProfile(id) {
    this.currentProfile = id;
    this._savePref('profile', id);
    this.applyProfile();
    window.EnderTrack?.Events?.emit?.('profile:changed', { profile: id });
  }

  applyProfile() {
    const profile = window.EnderTrackProfiles?.[this.currentProfile];
    const levels = profile?.visibility || ['basic', 'advanced', 'expert'];

    // Visibility: show/hide elements based on data-level attribute
    document.querySelectorAll('[data-level]').forEach(el => {
      el.style.display = levels.includes(el.getAttribute('data-level')) ? '' : 'none';
    });

    // Labels: apply profile overrides + language
    this.applyTranslations();
  }

  // === UTILS ===

  _savePref(key, value) {
    try {
      const saved = JSON.parse(localStorage.getItem('endertrack-theme-preferences') || '{}');
      saved[key] = value;
      localStorage.setItem('endertrack-theme-preferences', JSON.stringify(saved));
    } catch { /* ignore */ }
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      currentVisualTheme: this.currentVisualTheme,
      currentLanguage: this.currentLanguage,
      currentProfile: this.currentProfile
    };
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ThemeManager = new ThemeManager();

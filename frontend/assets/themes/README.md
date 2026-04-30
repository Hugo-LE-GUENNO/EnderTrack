# 🎨 Système de Thèmes EnderTrack

## 📁 Structure

```
frontend/assets/themes/
├── endertrack-dark.css    # Thème sombre (défaut)
└── endertrack-light.css   # Thème clair
```

## 🎯 Principe

Chaque thème contient **uniquement les variables de couleurs**. Les dimensions, espacements, typographie, etc. sont définis dans `variables.css` et restent identiques pour tous les thèmes.

## 🔧 Variables de Thème

Chaque fichier de thème doit définir ces variables :

### Backgrounds
- `--app-bg` - Fond principal de l'application
- `--column-bg` - Fond des 3 colonnes
- `--container-bg` - Fond des conteneurs
- `--panel-bg` - Fond des panneaux
- `--panel-light` - Variante claire
- `--panel-dark` - Variante sombre

### Inputs & Buttons
- `--input-bg` - Fond des inputs
- `--input-border` - Bordure des inputs
- `--button-bg` - Fond des boutons
- `--button-hover` - Fond au survol

### Text Colors
- `--text` - Texte principal
- `--text-selected` - Texte sélectionné
- `--text-general` - Texte général
- `--text-secondary` - Texte secondaire
- `--text-muted` - Texte atténué

### Accent Colors
- `--coordinates-color` - Couleur des coordonnées (jaune/orange)
- `--primary` - Couleur primaire
- `--active-element` - Éléments actifs
- `--danger` - Couleur de danger

### Borders
- `--border` - Bordure standard
- `--border-light` - Bordure claire
- `--border-dark` - Bordure sombre
- `--border-darker` - Bordure très sombre

## ➕ Ajouter un Nouveau Thème

1. **Créer le fichier** : `frontend/assets/themes/mon-theme.css`

2. **Copier la structure** d'un thème existant

3. **Modifier les couleurs** selon vos besoins

4. **Mettre à jour** `theme-loader.js` :
```javascript
window.getAvailableThemes = function() {
  return [
    { id: 'endertrack-dark', name: 'Endertrack Dark' },
    { id: 'endertrack-light', name: 'Endertrack Light' },
    { id: 'mon-theme', name: 'Mon Thème' }  // Ajouter ici
  ];
};
```

5. **Ajouter l'option** dans `index.html` :
```html
<option value="mon-theme">Mon Thème</option>
```

## 🔄 Changement de Thème

### Via l'interface
Configs > Personnalisation > Thème visuel

### Via JavaScript
```javascript
switchTheme('endertrack-light');
```

### Via localStorage
```javascript
localStorage.setItem('endertrack_theme', 'endertrack-dark');
```

## 💡 Conseils

- **Contraste** : Assurez-vous d'un bon contraste texte/fond
- **Cohérence** : Gardez une logique claire (light = clair, dark = sombre)
- **Test** : Testez tous les composants avec votre thème
- **Variables** : Ne modifiez QUE les couleurs, pas les dimensions

## 🎨 Palette de Couleurs

### Dark Theme
- Fond principal : `#181818`
- Coordonnées : `#ffc107` (jaune)
- Primaire : `#4f9eff` (bleu)

### Light Theme
- Fond principal : `#f5f5f5`
- Coordonnées : `#f59e0b` (orange)
- Primaire : `#3b82f6` (bleu)

# 🚀 Guide de Démarrage Rapide - Système Viewport/Widgets

## ✅ Installation Complète

Tous les fichiers sont en place et l'intégration est terminée !

## 🎯 Comment Tester

### 1. Démarrer l'application

```bash
cd endertrack_38
python -m http.server 8000
```

### 2. Ouvrir dans le navigateur

```
http://localhost:8000
```

### 3. Accéder à l'interface Viewport

1. Cliquer sur l'onglet **"Configs"** (en haut à gauche)
2. Descendre jusqu'à la section **"Visualisation"** (dernière section)
3. Vous devriez voir :
   - **Layout Mode** : Single View / Grid 2x2
   - **Active Widgets** : Liste des widgets avec toggles
   - **Status** : Informations en temps réel

### 4. Tester les fonctionnalités

#### Changer le Layout
- Cliquer sur **"Grid 2x2"** pour passer en mode grille
- Cliquer sur **"Single View"** pour revenir au mode normal

#### Activer/Désactiver les Widgets
- **Stage** (🎯) : Toujours actif (obligatoire)
- **Camera Live** (📷) : Toggle pour activer le flux vidéo
- **Stack Navigator** (📚) : Toggle pour la navigation T/Pos/Z/Channel
- **Timeline** (📋) : Toggle pour les logs d'événements

## 🧪 Tests Console

Ouvrir la console développeur (F12) et tester :

```javascript
// Vérifier que tout est chargé
console.log(window.EnderTrack.Viewport);
console.log(window.EnderTrack.Widgets);
console.log(window.ViewportConfig);

// Afficher le statut
EnderTrack.Viewport.Manager.printStatus();

// Changer le layout
await EnderTrack.Viewport.Manager.setLayout('grid');
await EnderTrack.Viewport.Manager.setLayout('single');

// Obtenir un widget
const stage = EnderTrack.Viewport.Manager.getWidget('stage');
console.log(stage.getInfo());
```

## 📊 Ce qui devrait fonctionner

### ✅ Layout Single View (Défaut)
- Canvas occupe tout l'espace central
- Comportement identique à avant
- Aucun changement visible

### ✅ Layout Grid 2x2
- Canvas divisé en grille 2x2
- Gap de 8px entre les widgets
- Widgets actifs affichés dans la grille

### ✅ Widget Stage
- Wrapper du canvas XY existant
- Fonctionne exactement comme avant
- Aucune modification du code canvas

### ✅ Widget Camera
- Affiche un placeholder "📷 Caméra non disponible"
- URL par défaut : `http://localhost:5000/video_feed`
- Affichera le flux si serveur caméra actif

### ✅ Widget Stack
- 4 sliders : Time, Position, Z-Stack, Channel
- Affichage current/max pour chaque dimension
- Désactivés par défaut (max = 0)

### ✅ Widget Timeline
- Affiche "No events yet" au démarrage
- Écoute les événements système
- Auto-scroll vers le bas
- Bouton "Clear" pour effacer

## 🐛 Dépannage

### La section Visualisation n'apparaît pas
- Vérifier que vous êtes dans l'onglet **"Configs"**
- Scroller vers le bas (c'est la dernière section)
- Vérifier la console pour les erreurs

### Les widgets ne s'activent pas
- Ouvrir la console (F12)
- Taper : `EnderTrack.Viewport.Manager.printStatus()`
- Vérifier les erreurs

### Le layout Grid ne fonctionne pas
- Vérifier que le canvas container existe
- Console : `document.getElementById('canvasContainer')`
- Devrait retourner un élément HTML

## 📝 Prochaines Étapes

Une fois que tout fonctionne :

1. **Tester le mode Grid** avec plusieurs widgets actifs
2. **Vérifier la persistance** (recharger la page, les préférences doivent être sauvegardées)
3. **Tester les événements** (bouger le stage, vérifier Timeline)
4. **Personnaliser** (modifier les URLs, ajouter des widgets)

## 💡 Astuces

- Les préférences sont sauvegardées dans localStorage
- Le widget Stage est toujours actif (requis)
- Les autres widgets peuvent être activés/désactivés à volonté
- Le mode Single View = 0 overhead (comportement original)

## 🎊 Succès !

Si vous voyez l'interface Visualisation dans Configs, **tout fonctionne** ! 🚀

Le système est prêt pour :
- Ajout de nouveaux widgets
- Layouts personnalisés
- Intégration avec le module Scénario
- Amélioration des fonctionnalités existantes

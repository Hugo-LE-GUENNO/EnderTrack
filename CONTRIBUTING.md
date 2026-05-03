# Contribuer à EnderTrack

Merci de vouloir contribuer ! EnderTrack est un projet ouvert — plugins, versions spécialisées et améliorations sont les bienvenus.

## 🔌 Contribuer un plugin

Un plugin = un dossier avec 3-4 fichiers. Il apparaîtra dans le catalogue d'extensions de tous les utilisateurs.

### Étapes

1. **Fork** ce repo
2. Basculer sur la branche `plugins` :
   ```bash
   git checkout plugins
   ```
3. Créer un dossier pour votre plugin :
   ```
   plugins/mon-plugin/
   ├── plugin.json    # Manifeste (obligatoire)
   ├── bridge.js      # Logique (obligatoire)
   ├── ui.js          # Interface (obligatoire)
   └── ui.css         # Styles (optionnel)
   ```
4. **Tester** localement : copier le dossier dans `plugins/` d'une installation basic, activer dans Réglages → Extensions
5. **Push** et ouvrir une **Pull Request** vers la branche `plugins`

### Structure plugin.json

```json
{
  "id": "monPlugin",
  "folder": "mon-plugin",
  "name": "Mon Plugin",
  "version": "1.0.0",
  "description": "Description courte",
  "author": "Votre Nom",
  "icon": "🔌"
}
```

> **Convention** : `id` en camelCase. Le plugin manager cherche les classes `MonPluginBridge` et `MonPluginPluginUI` (première lettre de l'id en majuscule).

### API disponible

```javascript
EnderTrack.State.get().pos                        // {x, y, z}
EnderTrack.Movement.moveAbsolute(x, y, z)
EnderTrack.Movement.moveRelative(dx, dy, dz)
EnderTrack.UI.showNotification(message, type)     // 'success', 'error', 'info'
EnderTrack.State.on('state:changed', callback)
EnderTrack.Canvas.requestRender()
```

### Checklist avant PR

- [ ] `plugin.json` valide avec `id`, `folder`, `name`, `version`
- [ ] Le plugin s'active et se désactive sans erreur
- [ ] Pas de dépendance externe (tout dans le dossier du plugin)
- [ ] Testé sur la dernière version de la branche `basic`

---

## 🔬 Contribuer une version spécialisée

Une version = une branche avec des modules supplémentaires (onglets, renderers, routes serveur). Exemples : imagerie, spectroscopie, robotique...

### Étapes

1. **Fork** ce repo
2. Créer une branche depuis `basic` :
   ```bash
   git checkout -b ma-version basic
   ```
3. Ajouter vos modules (voir le [guide dans le README](README.md#créer-un-module-nouvelle-version))
4. **Push** votre branche
5. Ouvrir une **Pull Request** ou une **Issue** pour qu'on l'ajoute à la table des versions

### Ce qu'une version peut ajouter

| Élément | Comment |
|---------|---------|
| Onglet | `tab-btn` + `tab-panel` dans `index.html` |
| Module JS | Fichier dans `modules/`, exposé sur `window.EnderTrack` |
| Route serveur | Module Python dans `server/`, importé dans `endertrack-server.py` |
| Renderer canvas | Fichier dans `modules/canvas/renderers/` |
| Widget status | Div dans le panneau droit ou zone plugin |

### Conventions

- Ne pas modifier les fichiers core existants si possible — préférer l'extension
- Utiliser les variables CSS du thème (`--container-bg`, `--text-selected`, etc.)
- Documenter dans un README sur votre branche

---

## 🐛 Signaler un bug / proposer une amélioration

Ouvrir une [Issue](../../issues) avec :
- Ce que vous faisiez
- Ce qui s'est passé
- Ce que vous attendiez
- Navigateur + appareil (PC, tablette, smartphone)

---

## 💡 Générer un plugin ou module avec l'IA

Copiez ce prompt dans ChatGPT, Claude, Amazon Q ou autre :

<details>
<summary>Prompt pour un plugin</summary>

```
Crée un plugin EnderTrack avec les fichiers suivants :
- plugin.json (manifeste avec id en camelCase, folder = nom du dossier)
- bridge.js (classe [Id]Bridge avec activate/deactivate/getStatus, exposée sur window)
- ui.js (classe [Id]PluginUI avec init/destroy, injecte l'UI dans document.getElementById('navPluginZone'))
- ui.css (styles optionnels, utiliser les variables CSS EnderTrack)

Convention : si id = "monPlugin", les classes sont MonPluginBridge et MonPluginPluginUI.

API disponible :
- EnderTrack.State.get().pos → {x, y, z}
- EnderTrack.Movement.moveAbsolute(x, y, z) / moveRelative(dx, dy, dz)
- EnderTrack.UI.showNotification(message, type)
- EnderTrack.State.on('state:changed', (newState, oldState) => {})
- EnderTrack.Canvas.requestRender()

Le plugin doit : [DÉCRIRE CE QUE LE PLUGIN DOIT FAIRE]
```

</details>

<details>
<summary>Prompt pour une version/module</summary>

```
Crée un module EnderTrack à partir de la branche basic
(https://github.com/Hugo-LE-GUENNO/EnderTrack/tree/basic).

Pour ajouter un module :
1. Créer modules/mon-module.js avec classe ayant activate()/deactivate()/createUI()
2. Ajouter un onglet dans index.html (tab-btn + tab-panel)
3. Charger le script dans index.html
4. Ajouter le cas dans switchTab() de main.js
5. Si backend : créer server/mon_module.py avec register_routes(app)

API : EnderTrack.State, EnderTrack.Movement, EnderTrack.Canvas, EnderTrack.UI, EnderTrack.Navigation

Le module doit : [DÉCRIRE CE QUE LE MODULE DOIT FAIRE]
```

</details>

---

## 📜 Licence

Toute contribution est sous licence GPLv3, comme le projet.

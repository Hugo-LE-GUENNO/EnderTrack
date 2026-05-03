# Contribuer à EnderTrack

## 🔌 Plugin

1. Fork → branche `plugins`
2. Ajouter un dossier dans `plugins/`
3. Tester localement (Réglages → Extensions)
4. Pull Request

👉 **[Structure et API](docs/plugins.md)**

### Checklist

- [ ] `plugin.json` avec `id`, `folder`, `name`, `version`
- [ ] S'active et se désactive sans erreur
- [ ] Pas de dépendance externe
- [ ] Testé sur la dernière version `basic`

## 🔬 Version spécialisée

1. Fork → nouvelle branche depuis `basic`
2. Ajouter modules, onglets, routes serveur
3. Pull Request ou Issue

👉 **[Guide modules](docs/modules.md)**

## 🐛 Bug / idée

[Ouvrir une Issue](../../issues) avec : ce que vous faisiez, ce qui s'est passé, navigateur + appareil.

## 📜 Licence

Toute contribution est sous GPLv3.

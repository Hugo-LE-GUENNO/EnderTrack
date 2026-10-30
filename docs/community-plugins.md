# Community Plugins

Plugins are hosted at [EnderTrack-plugins-community](https://github.com/Hugo-LE-GUENNO/EnderTrack-plugins-community/tree/main/plugins-python).

EnderTrack can browse and install them directly from this repository.

---

## Contribute a plugin

### 1. Write your plugin

Follow the [Python Plugin Tutorial](python-plugins.md) to create your plugin.  
Your plugin must be a single `.py` file named after the plugin folder:

```
plugins-python/
└── my-plugin/
    └── my-plugin.py
```

### 2. Fork the repository

Go to [EnderTrack-plugins-community](https://github.com/Hugo-LE-GUENNO/EnderTrack-plugins-community) and click **Fork**.

### 3. Add your plugin folder

In your fork, inside `plugins-python/`, create a folder named after your plugin and upload your `.py` file into it.

### 4. Register in catalog.json

Add an entry to `plugins-python/catalog.json`:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "What it does in one sentence",
  "author": "Your Name",
  "folder": "my-plugin",
  "main": "my-plugin.py"
}
```

### 5. Open a Pull Request

Submit your fork as a Pull Request to the main repository. Once merged, your plugin is available to all EnderTrack users.

---

## Rules

- One `.py` file per plugin — no external dependencies
- `NAME`, `VERSION`, `DESCRIPTION` must be defined at the top of the file
- No emoji in labels (rendering issues on RPi)
- Plugin must return `{'success': True}` or `{'success': False}` from every action

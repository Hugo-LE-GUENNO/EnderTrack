# Community Plugins

Plugins are hosted at [EnderTrack-plugins-community](https://github.com/Hugo-LE-GUENNO/EnderTrack-plugins-community).

EnderTrack can browse and install them directly from this repository.

---

## How to add a plugin

### Step 1 — Write your plugin

- Python plugin → follow the [Python Plugin Tutorial](python-plugins.md)
- Advanced (JS) plugin → follow the [Advanced Plugin Tutorial](advanced-plugins.md)

### Step 2 — Fork the repository

Go to [EnderTrack-plugins-community](https://github.com/Hugo-LE-GUENNO/EnderTrack-plugins-community) and click **Fork**.

### Step 3 — Add your plugin folder

**Python plugin** — inside `plugins-python/`, create a folder and upload your `.py` file:

```
plugins-python/
└── my-plugin/
    └── my-plugin.py
```

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

**Advanced plugin** — inside `plugins-advanced/`, drop your full plugin folder:

```
plugins-advanced/
└── my-plugin/
    ├── plugin.json
    ├── bridge.js
    ├── ui.js
    └── ui.css
```

Add an entry to `plugins-advanced/catalog.json`:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "What it does in one sentence",
  "author": "Your Name",
  "folder": "my-plugin"
}
```

### Step 4 — Open a Pull Request

Submit your fork as a Pull Request. Once merged, your plugin is available to all EnderTrack users.

---

## Rules

- `NAME`, `VERSION`, `DESCRIPTION` must be defined at the top of Python plugins
- No emoji in labels (rendering issues on RPi)
- Python plugins must return `{'success': True}` or `{'success': False}` from every action

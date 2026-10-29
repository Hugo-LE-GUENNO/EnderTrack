# JS Plugin Tutorial

Create a JS plugin for EnderTrack in minutes.

## Structure

```
plugins/my-plugin/
├── plugin.json    ← manifest (required)
├── bridge.js      ← server communication or local logic
├── ui.js          ← UI injection (nav buttons, config accordion)
├── ui.css         ← styles
└── scripts/       ← optional Python backend
    └── my-tool.py
```

## Install

Drop the folder into `plugins/` and enable it from **Settings → Plugins**.

No restart needed. The plugin is loaded dynamically on activation.

## Create with AI

Open the Plugins tab → **?** button → copy the AI prompt and paste it into any AI assistant with your plugin description.

## Full API reference

See the AI prompt in the Plugins tab for the complete EnderTrack API available to plugins:
state, movement, canvas, events, lists, scenario, math, UI injection points and CSS variables.

## Community plugins

👉 [EnderTrack-plugins-community](https://github.com/Hugo-LE-GUENNO/EnderTrack-plugins-community)

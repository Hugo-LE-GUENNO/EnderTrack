# EnderTrack — Plugins

| Plugin | Folder | Description |
|--------|--------|-------------|
| External Controller | `external-controller` | Keyboard + gamepad mapping |
| Extruder | `extruder` | Extruder motor control |
| TempoBed | `tempo-bed` | Heated bed temperature |

## Install

Copy the plugin folder into `plugins/` and enable it in Settings → Extensions.

```bash
git clone -b plugins https://github.com/Hugo-LE-GUENNO/EnderTrack.git /tmp/et-plugins
cp -r /tmp/et-plugins/plugins/<plugin> your-endertrack/plugins/
```

👉 Want to create a plugin? See [plugins.md](https://github.com/Hugo-LE-GUENNO/EnderTrack/blob/main/docs/plugins.md)

# Contributing to EnderTrack

Contributions are welcome! Whether you want to build a plugin, create a new edition, or report a bug — every contribution helps make EnderTrack better for the community.

## Plugin

1. Fork → branch `plugins`
2. Add a folder in `plugins/`
3. Test locally (Settings → Extensions)
4. Open a Pull Request

👉 [plugins.md](docs/plugins.md) · [plugins-advanced.md](docs/plugins-advanced.md) · [api.md](docs/api.md)

### Checklist

- [ ] `plugin.json` with `id`, `folder`, `name`, `version`
- [ ] Activates and deactivates without errors
- [ ] No external dependencies
- [ ] Tested on the latest `basic` version

## New edition

1. Fork → new branch from `basic`
2. Add modules, tabs, server routes
3. Open a Pull Request or Issue

👉 [modules.md](docs/modules.md)

## Bug / idea

[Open an Issue](../../issues) with: what you were doing, what happened, browser + device.

## License

All contributions are under GPLv3.

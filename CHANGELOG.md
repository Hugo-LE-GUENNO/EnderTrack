# Changelog

- **Python plugins** — `ctx.light` HTTP API (GPIO + Arduino), `ctx.bus.publish` for SSE events
- **Plugin extra JS** — `EXTRA_JS` list loads browser-side JS on plugin activation
- **Scenario builder** — `capture` restores exposure/gain; `led` fixed (serverId, zero RGB); dynamic light channel options
- **Light GPIO** — persistence across reloads, toggle/intensity from nav, scenario and Python
- **Histogram** — Auto mode stretches live preview in real-time (hook on `_redraw`)
- **Web Audio** — `plugin:sound` SSE event → synthesized melody via Web Audio API
- **Disco plugin** — random moves + light, scenario action
- **Anniversary plugin** — 🎂 light + movement + Happy Birthday synchronized on 15s
- **Docs** — [Python plugin tutorial](docs/python-plugins.md)

## imaging v1.3.3

 shortcuts modal (⌨ button in header) — 7 shortcuts listed
- `P` shortcut — add current position to list from any tab
- Homing fix — `position:moving` broadcast before G28, `position:homed` event snaps UI to 0,0,0
- Scroll wheel Z direction inverted — scroll up = Z+

## imaging v1.2.3

- Lists UX refactor — Add zone moved to top, Name field added, 📍 fills inputs from current position
- Drag & drop reordering with position number on handle
- Right-click context menu — duplicate, delete, go to position
- Visual separator between Positions and Acquisition tabs

## imaging v1.2.1 — Per-Channel Display, Playback & Persistence

### Added
- **Timelapse playback** — ▶ button on T slider, right-click to set FPS (1–60)
- **Full server persistence** — LUT/contrast/histogram saved for live, gallery and stacks
- **Enriched metadata** — Z step/total, T step/total, XY pixel size, bit depth (table)
- **Per-channel settings** — full rewrite, each channel C has its own LUT/contrast

### Fixed
- LUT stable during fast channel switching (150ms debounce + `_switching` flag)
- Z/T stacks keep their LUT after navigation and refresh
- Histogram frozen during playback (no jitter)
- Min/max bars stable (`dataMin`/`dataMax` not recalculated during Z/T navigation)
- Correct metadata per image type (no TIFF→PNG contamination)
- No debounce for files < 200 MB

### Persistence files
- `.live_settings.json` — LUT, contrast, auto mode for live view
- `.gallery_settings.json` — settings per PNG/JPG image
- `.stack_settings.json` — settings per channel for all TIFFs

## imaging v1.1.0 — Live Renderer & Gallery

- LiveRenderer separated from GalleryRenderer
- Gallery with keyboard navigation, search, multi-dimensional stack viewer
- 16-bit histogram from raw data
- OME/ImageJ metadata (dimensions, pixel size, bit depth)

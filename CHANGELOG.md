# Changelog

## imaging v1.2.5

### Canvas & Tracks
- **Live trail** — continuous track (navigation) and scenario track (green) now draw in real-time behind the cursor during movement, not only on arrival
- **Scenario preview track** — yellow dashed path with arrows rendered on canvas when acquisition tab is active, rebuilt automatically when the scenario or any involved list changes
- **`moveType: list` fix** — `TreeUtils.extractPositions` now correctly resolves list-based moves when computing the preview track
- **Pinned lists visible in all tabs** — pinned lists (points) are now rendered in the acquisition tab and all other tabs, not only in the lists tab
- **Track lines removed** — connecting lines between waypoints removed from canvas (was cluttering all tabs); scenario preview track handles this in acquisition tab
- **Scenario track guard fixed** — `renderListTracks` now always runs before the scenario `isActive` early-return in `track-renderer.js`
- **`activeTab` sync** — `switchTab()` now updates `State.activeTab` so renderers can correctly filter by tab

### Lists
- **Unpin List 1** — removed forced `pinned=true` on first list when loading; lists can now be fully unpinned
- **`lists:changed` event** — emitted on every `save()` so scenario preview rebuilds when a list is modified

### Scenario
- **Preview auto-update** — `updateCanvasOverlay()` called on `activate()` and on `lists:changed` to keep preview in sync
- **`scenarioTrack.visited` live** — executor pushes intermediate positions during movement for real-time green trail

### Server / G-code
- **M503 on refresh removed** — `querySpeedLimits()` calls removed from `autoConnect()`/`connect()`; server already publishes `sync:config` on startup
- **G-code response logging** — `send_gcode()` logs each response line with `< ` prefix (except silent commands)
- **`maxFeedrate`/`maxZSpeed`** — firmware limits published separately in `sync:config`; user feedrate preserved and only clamped if exceeded

## imaging v1.2.4

- Keyboard shortcuts modal (⌨ button in header) — 7 shortcuts listed
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

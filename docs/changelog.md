# Changelog — EnderTrack imaging

### v1.3.5
- **Plugin catalog** — install/uninstall JS and Python plugins from the browser (community repo)
- **Gamepad Advanced** — replaces `external-controller`, available in the community catalog
- **Plugin uninstall** — page reload after JS plugin removal to cleanly unload scripts

### v1.3.3
- **Python plugins** — full API: `ctx.stage`, `ctx.cam`, `ctx.light`, `ctx.lists`, `ctx.bus`
- **Light GPIO** — NeoPixel control from navigation, scenario builder and Python plugins
- **Scenario builder** — `capture` action restores exposure/gain after capture; `led` action fixed
- **Histogram** — Auto mode applies contrast stretch to live preview in real-time
- **Plugin extra JS** — `EXTRA_JS` list in plugin loads browser-side JS on activation
- **Web Audio** — SSE `plugin:sound` event plays synthesized melodies via Web Audio API
- **Disco plugin** — random moves + light choreography, available as scenario action
- **Anniversary plugin** — light + movement + music synchronized

### v1.3.2
- Performance: removed M114 position polling after every move — dead-reckoning only
- Performance: canvas render loop decoupled from state events during animation
- Performance: track recording and mosaic tiles disabled by default, opt-in toggles in Settings
- Stage settings: movement animation synced to real hardware duration
- Camera: mosaic tile appears instantly on canvas
- Camera: connection status text colored green/red
- Camera: double-click on any viewport → fullscreen
- Settings: removed all emoji icons from section headers and Home button

### v1.3.1
- Fast Explore: creates a dedicated scenario (move → wait → capture), configurable sweep patterns
- Fast Explore: optional capture per position, auto-computed wait delay from exposure time
- Live renderer: fixed RGB→grayscale conversion
- Capture button: browser download + parallel server save, right-click menu for filename prefix

### v1.3.0
- Scenario builder — major update: tree-based editor, loop types, action registry, variable manager

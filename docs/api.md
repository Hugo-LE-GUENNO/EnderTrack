# Plugin API Reference

All functions available to plugins via the `EnderTrack` global object.

---

## Movement

Control the XYZ stage position. All movement functions return a `Promise<boolean>`.

| Function | Parameters | Description |
|----------|-----------|-------------|
| `EnderTrack.Movement.moveAbsolute(x, y, z)` | `x, y, z` — mm | Move to absolute position |
| `EnderTrack.Movement.moveRelative(dx, dy, dz)` | `dx, dy, dz` — mm | Move by offset from current position |
| `EnderTrack.Movement.moveDirection(direction, distance?)` | `direction`: `'up'`, `'down'`, `'left'`, `'right'`, `'zUp'`, `'zDown'` · `distance`: mm (optional) | Move in a direction, uses current sensitivity if no distance given |
| `EnderTrack.Movement.goHome(mode?)` | `mode`: `'xy'`, `'xyz'`, `'z'` (default: `'xy'`) | Go to home position |
| `EnderTrack.Movement.emergencyStopMovement()` | — | Stop all movement immediately |

---

## State

Read and react to the application state. Useful for getting the current position or reacting to changes.

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `EnderTrack.State.get()` | — | `Object` | Full state object — use `.pos` for `{x, y, z}` |
| `EnderTrack.State.update(patch)` | `patch`: partial state object | — | Update state (partial merge) |
| `EnderTrack.Events.on(event, callback)` | `event`: string · `callback`: function | — | Listen to a state or system event |
| `EnderTrack.Events.emit(event, ...args)` | `event`: string | — | Emit a custom event |

### Available events

| Event | Callback arguments | Description |
|-------|--------------------|-------------|
| `state:changed` | `(newState, oldState)` | Any state change |
| `movement:started` | `(movement)` | Stage starts moving |
| `movement:completed` | `(result)` | Stage finished moving |

---

## UI

Show notifications and modals to the user.

| Function | Parameters | Description |
|----------|-----------|-------------|
| `EnderTrack.UI.showNotification(message, type?)` | `type`: `'info'`, `'success'`, `'warning'`, `'error'` | Show a toast notification |
| `EnderTrack.UI.showModal(options)` | `options`: modal config object | Show a modal dialog |
| `EnderTrack.UI.Tabs.switchTab(tabId)` | `tabId`: string | Switch to a tab programmatically |

---

## Canvas

Draw custom overlays on the XY canvas. Coordinates are in mm (same as stage coordinates).

| Function | Parameters | Description |
|----------|-----------|-------------|
| `EnderTrack.Canvas.requestRender()` | — | Force a canvas redraw — call after any draw operation |
| `EnderTrack.CanvasUtils.drawCircle(x, y, radius, color, fill?)` | `fill`: boolean (default `true`) | Draw a circle |
| `EnderTrack.CanvasUtils.drawLine(x1, y1, x2, y2, color, width?)` | `width`: px (default `1`) | Draw a line |
| `EnderTrack.CanvasUtils.drawText(x, y, text, color, font?)` | `font`: CSS font string | Draw text |

---

## Coordinates

Convert between stage coordinates (mm) and canvas pixel coordinates.

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `EnderTrack.Coordinates.mapToCanvas(x, y)` | `x, y` — mm | `{x, y}` px | Stage mm → canvas pixels |
| `EnderTrack.Coordinates.canvasToMap(x, y)` | `x, y` — px | `{x, y}` mm | Canvas pixels → stage mm |

---

## Navigation

Read or change navigation settings.

| Function | Parameters | Description |
|----------|-----------|-------------|
| `EnderTrack.Navigation.setInputMode(mode)` | `mode`: `'relative'`, `'absolute'` | Set input mode |
| `EnderTrack.Navigation.setSensitivity(axis, value)` | `axis`: `'x'`, `'y'`, `'z'` · `value`: 0.01–50 | Set step size for an axis |
| `EnderTrack.Navigation.toggleLock(axis)` | `axis`: `'X'`, `'Y'`, `'Z'` | Lock/unlock an axis |

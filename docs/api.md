# Plugin API Reference

| Function | Description |
|----------|-------------|
| `EnderTrack.State.get().pos` | Current position `{x, y, z}` in mm |
| `EnderTrack.State.update(patch)` | Update state (partial merge) |
| `EnderTrack.Events.on(event, callback)` | Listen to an event (`state:changed`, `movement:started`, `movement:completed`) |
| `EnderTrack.Events.emit(event, ...args)` | Emit a custom event |
| `EnderTrack.Movement.moveAbsolute(x, y, z)` | Move to absolute position (mm) |
| `EnderTrack.Movement.moveRelative(dx, dy, dz)` | Move by offset from current position (mm) |
| `EnderTrack.Movement.moveDirection(direction, distance?)` | Move in a direction: `'up'` `'down'` `'left'` `'right'` `'zUp'` `'zDown'` |
| `EnderTrack.Movement.goHome(mode?)` | Go to home — `mode`: `'xy'` `'xyz'` `'z'` (default: `'xy'`) |
| `EnderTrack.Movement.emergencyStopMovement()` | Stop all movement immediately |
| `EnderTrack.UI.showNotification(message, type?)` | Toast notification — `type`: `'info'` `'success'` `'warning'` `'error'` |
| `EnderTrack.UI.showModal(options)` | Show a modal dialog |
| `EnderTrack.UI.Tabs.switchTab(tabId)` | Switch to a tab programmatically |
| `EnderTrack.Canvas.requestRender()` | Force canvas redraw — call after any draw operation |
| `EnderTrack.CanvasUtils.drawCircle(x, y, radius, color, fill?)` | Draw a circle on the canvas (mm coordinates) |
| `EnderTrack.CanvasUtils.drawLine(x1, y1, x2, y2, color, width?)` | Draw a line on the canvas (mm coordinates) |
| `EnderTrack.CanvasUtils.drawText(x, y, text, color, font?)` | Draw text on the canvas (mm coordinates) |
| `EnderTrack.Coordinates.mapToCanvas(x, y)` | Stage mm → canvas pixels |
| `EnderTrack.Coordinates.canvasToMap(x, y)` | Canvas pixels → stage mm |
| `EnderTrack.Navigation.setInputMode(mode)` | Set input mode: `'relative'` or `'absolute'` |
| `EnderTrack.Navigation.setSensitivity(axis, value)` | Set step size — `axis`: `'x'` `'y'` `'z'` · `value`: 0.01–50 mm |
| `EnderTrack.Navigation.toggleLock(axis)` | Lock/unlock an axis: `'X'` `'Y'` `'Z'` |

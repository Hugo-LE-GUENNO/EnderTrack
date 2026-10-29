NAME        = "G-code Sender"
VERSION     = "1.0.0"
DESCRIPTION = "Send a batch of G-code lines to the stage"

_running = False

SECTIONS = {
    "automation": {
        "inputs": [
            {"type": "textarea", "id": "gcode", "label": "G-code", "placeholder": "G28 X Y\nG1 X10 F1000\nM400", "rows": 8},
            {"type": "button", "label": "▶ Run",  "action": "run",  "style": "primary"},
            {"type": "button", "label": "⏹ Stop", "action": "stop"},
        ],
        "outputs": [
            {"type": "text", "id": "status", "label": "Status"},
        ]
    }
}


_MOVE_CMDS = ('G0', 'G1', 'G2', 'G3', 'G28', 'G29')


def _sync_position(stage):
    """Read real position from firmware and broadcast to EnderTrack UI."""
    from server.event_stream import bus
    stage.get_position()
    p = stage.position
    bus.publish('position:arrived', {'x': p['X'], 'y': p['Y'], 'z': p['Z']})


def run(ctx, params):
    global _running
    stage = ctx.stage
    if not stage:
        ctx.update_output('status', '✗ Stage not connected'); return {'success': False}

    raw = params.get('gcode', '')
    lines = [l.strip() for l in raw.splitlines() if l.strip() and not l.strip().startswith(';')]

    if not lines:
        ctx.update_output('status', '✗ Nothing to send'); return {'success': False}

    _running = True
    ctx.update_output('status', f'Running — 0 / {len(lines)}')

    for i, line in enumerate(lines):
        if not _running:
            ctx.update_output('status', f'⏹ Stopped at line {i} / {len(lines)}')
            _sync_position(stage)
            return {'success': False}
        ctx.update_output('status', f'[{i+1}/{len(lines)}] {line}')
        stage.send_gcode(line, wait_ok=True)

    _running = False
    _sync_position(stage)
    ctx.update_output('status', f'✓ Done — {len(lines)} lines sent')
    return {'success': True}


def stop(ctx, params):
    global _running
    _running = False
    return {'success': True}


def on_unload(ctx):
    global _running
    _running = False

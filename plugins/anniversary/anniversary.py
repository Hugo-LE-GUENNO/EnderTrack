"""
plugins/anniversary/anniversary.py
🎂 Happy Anniversary! — 1 an d'EnderTrack avec Hugo & Amazon Q
"""

import time
import random
import math
import threading

NAME        = "🎂 Anniversary"
VERSION     = "1.0.0"
DESCRIPTION = "1 an d'EnderTrack — Bonne anniversaire Hugo ! 🎉"

SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "button", "label": "🎂 Happy Anniversary !", "action": "run", "style": "primary"},
        ],
        "outputs": [
            {"type": "text", "id": "status", "label": ""},
        ]
    }
}

EXTRA_JS = ['/plugins/anniversary/sound.js']

SCENARIO_ACTIONS = [
    {
        'id': 'run',
        'label': '🎂 Happy Anniversary',
        'icon': '🎂',
        'timeout_ms': 60000,
        'params': []
    }
]

_stop_event = threading.Event()
_running    = False

FIREWORKS = [
    (255, 0,   0),
    (255, 165, 0),
    (255, 255, 0),
    (0,   255, 0),
    (0,   200, 255),
    (180, 0,   255),
    (255, 0,   180),
    (255, 255, 255),
]


def _c(light, r, g, b, intensity=1.0):
    light.on(r=r, g=g, b=b, intensity=intensity)


def run(ctx, params):
    global _running, _stop_event

    if _running:
        _stop_event.set()
        time.sleep(0.3)

    stage = ctx.stage
    light = ctx.light
    has_light = bool(light.status().get('lights'))

    if not stage:
        ctx.update_output('status', '✗ Stage non connecté')
        return {'success': False}

    x0 = stage.position['X']
    y0 = stage.position['Y']
    z0 = stage.position['Z']

    _stop_event.clear()
    _running = True

    # Lancer la musique — tout est synchronisé sur ses ~15s
    ctx.bus.publish('plugin:sound', {'melody': 'happy_birthday'})
    ctx.log("🎂 1 an d'EnderTrack — Joyeux anniversaire Hugo !")

    TOTAL = 15.0
    t_start = time.time()

    def elapsed():
        return time.time() - t_start

    try:
        # 0-4s — bougies vacillantes
        ctx.update_output('status', '🕯️ Bougies...')
        while elapsed() < 4.0 and not _stop_event.is_set():
            if has_light:
                _c(light, random.randint(220, 255), random.randint(80, 160), 0, random.uniform(0.7, 1.0))
            stage.move_absolute(
                x0 + random.uniform(-1, 1),
                y0 + random.uniform(-1, 1),
                z0 + random.uniform(-0.5, 0.5),
                feedrate=2000
            )
            time.sleep(0.1)

        # 4-9s — spirale arc-en-ciel
        ctx.update_output('status', '🌀 Spirale !')
        while elapsed() < 9.0 and not _stop_event.is_set():
            t = (elapsed() - 4.0) / 5.0
            angle = t * 4 * math.pi
            h = (t * 6)
            s = int(h) % 6
            f = h - int(h)
            v, p, q = 255, int(f * 255), int((1 - f) * 255)
            cols = [(v,p,0),(q,v,0),(0,v,p),(0,q,v),(p,0,v),(v,0,q)]
            r, g, b = cols[s]
            if has_light:
                _c(light, r, g, b, 0.9)
            stage.move_absolute(
                x0 + 6 * math.sin(angle),
                y0 + 6 * math.sin(angle) * math.cos(angle),
                z0 + 2 * math.sin(angle * 2),
                feedrate=3500
            )
            time.sleep(0.07)

        # 9-15s — feux d'artifice
        ctx.update_output('status', '🎆 Feux d\'artifice !')
        while elapsed() < TOTAL and not _stop_event.is_set():
            r, g, b = random.choice(FIREWORKS)
            if has_light:
                _c(light, r, g, b, 1.0)
            stage.move_absolute(
                x0 + random.uniform(-8, 8),
                y0 + random.uniform(-8, 8),
                z0 + random.uniform(-2, 3),
                feedrate=6000
            )
            time.sleep(0.1)
            if has_light:
                light.off()
            time.sleep(0.08)

    finally:
        _running = False
        stage.move_absolute(x0, y0, z0, feedrate=2000)
        if has_light:
            light.off()
        ctx.update_output('status', '🎂 Joyeux Anniversaire EnderTrack ! 🎉')

    return {'success': True}

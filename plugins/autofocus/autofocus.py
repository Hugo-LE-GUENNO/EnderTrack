"""
plugins/autofocus/autofocus.py
Unified autofocus plugin — Linear, Hill-Climbing, Brent, FFT.
"""

import numpy as np
import time

NAME        = "Autofocus"
VERSION     = "2.0.0"
DESCRIPTION = "Unified autofocus — Linear, Hill-Climbing, Brent, FFT"

SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "dropdown", "id": "method", "label": "Method", "options": [
                {"value": "linear",       "label": "Linear scan"},
                {"value": "hill",         "label": "Hill-Climbing"},
                {"value": "brent",        "label": "Brent"},
                {"value": "fft",          "label": "FFT"},
            ], "default": "linear"},
            {"type": "slider", "id": "range",     "label": "Range (mm)",        "min": 0.1, "max": 20.0, "default": 2.0,  "step": 0.1},
            {"type": "slider", "id": "step_mult", "label": "Step (x px size)",  "min": 1,   "max": 100,  "default": 10,   "step": 1},
            {"type": "button", "label": "Autofocus", "action": "run", "style": "primary"},
        ],
        "outputs": [
            {"type": "text",  "id": "status", "label": "Status"},
            {"type": "graph", "id": "curve",  "label": "Focus curve", "xlabel": "Z (mm)", "ylabel": "Score"},
        ]
    }
}

SCENARIO_ACTIONS = [
    {
        'id': 'run',
        'label': 'Autofocus',
        'timeout_ms': 180000,
        'params': [
            {'id': 'method',    'label': 'Method',          'type': 'select', 'options': [
                {'value': 'linear', 'label': 'Linear scan'},
                {'value': 'hill',   'label': 'Hill-Climbing'},
                {'value': 'brent',  'label': 'Brent'},
                {'value': 'fft',    'label': 'FFT'},
            ], 'default': 'linear'},
            {'id': 'range',     'label': 'Range (mm)',       'type': 'number', 'default': 2.0, 'min': 0.1, 'max': 20.0},
            {'id': 'step_mult', 'label': 'Step (x px size)', 'type': 'number', 'default': 10,  'min': 1,   'max': 100},
        ]
    }
]


# ── Shared helpers ────────────────────────────────────────────────────────────

def _score_lap(picam, n=2):
    scores = []
    for _ in range(n):
        arr  = picam.capture_array("main")
        gray = (0.299*arr[:,:,0] + 0.587*arr[:,:,1] + 0.114*arr[:,:,2]).astype(np.float32)
        mean = gray.mean()
        if mean < 1.0: scores.append(0.0); continue
        lap = (-4*gray[1:-1,1:-1] + gray[:-2,1:-1] + gray[2:,1:-1]
               + gray[1:-1,:-2] + gray[1:-1,2:])
        scores.append(float(lap.var()) / (mean ** 2))
    return float(np.median(scores))


def _score_fft(picam, r_split=0.20, n=2):
    scores = []
    for _ in range(n):
        arr  = picam.capture_array("main")
        gray = (0.299*arr[::4,::4,0] + 0.587*arr[::4,::4,1] + 0.114*arr[::4,::4,2]).astype(np.float32)
        h, w = gray.shape
        spec = np.abs(np.fft.fftshift(np.fft.fft2(gray))) ** 2
        cy, cx = h//2, w//2
        r = np.sqrt(((np.ogrid[:h][0]-cy)/cy)**2 + ((np.ogrid[:w][0]-cx)/cx)**2)
        # broadcast manually
        yr = np.arange(h); xr = np.arange(w)
        rr = np.sqrt(((yr[:,None]-cy)/cy)**2 + ((xr[None,:]-cx)/cx)**2)
        total = spec.sum()
        scores.append(float(spec[rr > r_split].sum() / total) if total > 1e-10 else 0.0)
    return float(np.median(scores))


def _move(stage, x, y, z):
    stage.move_absolute(x, y, round(z, 4), feedrate=3000)
    stage.finish_moves()
    time.sleep(0.05)


# ── Methods ───────────────────────────────────────────────────────────────────

def _linear(ctx, picam, stage, x0, y0, z0, rng, step):
    z_start = round(z0 - rng/2, 4)
    z_end   = round(z0 + rng/2, 4)
    n_steps = int(rng / step)
    ctx.update_output('status', f'Linear: {n_steps} steps x {step:.3f}mm')
    _move(stage, x0, y0, z_start)
    best_z, best_score = z_start, -1.0
    z = z_start
    while z <= z_end + 1e-6:
        s = _score_lap(picam)
        ctx.update_graph('curve', z, s)
        if s > best_score: best_score, best_z = s, z
        z = round(z + step, 4)
        if z <= z_end + 1e-6: _move(stage, x0, y0, z)
    _move(stage, x0, y0, best_z)
    return best_z, best_score, f'{n_steps} steps'


def _hill(ctx, picam, stage, x0, y0, z0, rng, step):
    coarse_step = step * 8
    z_start = round(z0 - rng/2, 4)
    z_end   = round(z0 + rng/2, 4)
    ctx.update_output('status', 'Hill: coarse scan...')
    _move(stage, x0, y0, z_start)
    coarse = []
    z = z_start
    while z <= z_end + 1e-6:
        s = _score_lap(picam)
        coarse.append((z, s))
        ctx.update_graph('curve', z, s)
        z = round(z + coarse_step, 4)
        if z <= z_end + 1e-6: _move(stage, x0, y0, z)
    best_z, _ = max(coarse, key=lambda p: p[1])
    _move(stage, x0, y0, best_z)
    cur = _score_lap(picam)
    direction, n_rev, total = +1, 0, 0
    while total < 60:
        nz = round(best_z + direction * step, 4)
        _move(stage, x0, y0, nz)
        ns = _score_lap(picam)
        ctx.update_graph('curve', nz, ns)
        total += 1
        if ns > cur: cur, best_z = ns, nz
        else:
            direction *= -1; step = round(step/2, 4); n_rev += 1
            if step < 0.001: break
    _move(stage, x0, y0, best_z)
    return best_z, cur, f'{len(coarse)} coarse + {total} fine'


def _brent(ctx, picam, stage, x0, y0, z0, rng, step):
    tol = step / 3
    z_start = z0 - rng/2; z_end = z0 + rng/2
    ctx.update_output('status', 'Brent: coarse scan...')
    _move(stage, x0, y0, z_start)
    coarse = []
    z = z_start
    while z <= z_end + 1e-6:
        s = _score_lap(picam)
        coarse.append((z, s)); ctx.update_graph('curve', z, s)
        z = round(z + step, 4)
        if z <= z_end + 1e-6: _move(stage, x0, y0, z)
    best_i = max(range(len(coarse)), key=lambda i: coarse[i][1])
    a = coarse[max(0, best_i-1)][0]; b = coarse[min(len(coarse)-1, best_i+1)][0]
    if abs(b-a) < tol*2: a = coarse[best_i][0]-step; b = coarse[best_i][0]+step
    ctx.update_output('status', f'Brent: refining [{a:.3f},{b:.3f}]...')
    GOLD = 0.3819660112501051
    def feval(z):
        _move(stage, x0, y0, z); s = _score_lap(picam)
        ctx.update_graph('curve', z, s); return -s
    x = w = v = a + GOLD*(b-a); fx = fw = fv = feval(x)
    d = e = 0.0; n_b = 0
    for _ in range(50):
        mid = 0.5*(a+b); t1 = tol*abs(x)+1e-10; t2 = 2*t1
        if abs(x-mid) <= t2-0.5*(b-a): break
        use_p = False
        if abs(e) > t1:
            r=(x-w)*(fx-fv); q=(x-v)*(fx-fw); p=(x-v)*q-(x-w)*r; q=2*(q-r)
            if q>0: p=-p
            else: q=-q
            r=e; e=d
            if abs(p)<abs(0.5*q*r) and p>q*(a-x) and p<q*(b-x): d=p/q; use_p=True
        if not use_p: e=(b if x<mid else a)-x; d=GOLD*e
        u=x+(d if abs(d)>=t1 else (t1 if d>0 else -t1)); fu=feval(u); n_b+=1
        if fu<=fx:
            if u<x: b=x
            else: a=x
            v,fv=w,fw; w,fw=x,fx; x,fx=u,fu
        else:
            if u<x: a=u
            else: b=u
            if fu<=fw or w==x: v,fv=w,fw; w,fw=u,fu
            elif fu<=fv or v==x or v==w: v,fv=u,fu
    best_z = round(x, 4); best_score = -fx
    _move(stage, x0, y0, best_z)
    return best_z, best_score, f'{len(coarse)} coarse + {n_b} Brent'


def _fft(ctx, picam, stage, x0, y0, z0, rng, step):
    z_start = round(z0 - rng/2, 4); z_end = round(z0 + rng/2, 4)
    n_steps = int(rng / step)
    ctx.update_output('status', f'FFT: {n_steps} steps x {step:.3f}mm')
    _move(stage, x0, y0, z_start)
    best_z, best_score = z_start, -1.0
    z = z_start
    while z <= z_end + 1e-6:
        s = _score_fft(picam)
        ctx.update_graph('curve', z, s)
        if s > best_score: best_score, best_z = s, z
        z = round(z + step, 4)
        if z <= z_end + 1e-6: _move(stage, x0, y0, z)
    _move(stage, x0, y0, best_z)
    return best_z, best_score, f'{n_steps} steps'


# ── Entry point ───────────────────────────────────────────────────────────────

def run(ctx, params):
    stage = ctx.stage; cam = ctx.cam
    if not stage: ctx.update_output('status', 'Stage not connected'); return {'success': False}
    if not cam:   ctx.update_output('status', 'Camera not available'); return {'success': False}
    picam, _ = cam._get_picam()
    if not picam: ctx.update_output('status', 'Camera not started'); return {'success': False}

    pixel_size_um = cam._config.get('pixel_size', 1.0)
    rng       = float(params.get('range', 2.0))
    step_mult = float(params.get('step_mult', 10))
    method    = params.get('method', 'linear')
    step      = max(0.005, min(2.0, pixel_size_um * step_mult / 1000.0))

    x0 = stage.position['X']; y0 = stage.position['Y']; z0 = stage.position['Z']
    ctx.reset_graph('curve')

    fn = {'linear': _linear, 'hill': _hill, 'brent': _brent, 'fft': _fft}.get(method, _linear)
    best_z, best_score, detail = fn(ctx, picam, stage, x0, y0, z0, rng, step)

    ctx.log(f'AF [{method}] -> z={best_z:.3f} score={best_score:.2f} ({detail})', level='ok')
    ctx.update_output('status', f'z={best_z:.3f}mm  [{method}]  ({detail})')
    return {'success': True, 'best_z': best_z, 'score': best_score}

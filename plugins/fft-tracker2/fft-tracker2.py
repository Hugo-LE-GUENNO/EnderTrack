"""
plugins/fft-tracker2/fft-tracker2.py
=====================================
EnderTrack plugin — FFT Phase Correlation Tracker

USAGE
-----
1. Click "Capture" to grab a live frame
2. Click on the object to track
3. Stage moves to keep the object centered
4. Click "Stop" to end

ALGORITHM — Phase correlation (normalized FFT cross-correlation)
-----------------------------------------------------------------
Phase correlation is more robust than raw NCC:

    R = FFT(template) × conj(FFT(frame)) / |FFT(template) × conj(FFT(frame))|

The peak of IFFT(R) gives the sub-pixel shift between frames.
Normalizing by magnitude makes it invariant to brightness changes.

Template is extracted around the click, then the full frame is searched
each iteration — no sliding window, O(N log N) instead of O(N²).
"""

import numpy as np
import time

NAME        = "FFT Tracker 2"
VERSION     = "1.0.0"
DESCRIPTION = "Phase-correlation FFT tracker — robust to brightness changes"

PATCH       = 128   # template size in downsampled pixels
DOWNSAMPLE  = 4     # spatial downsampling factor
MIN_MOVE_MM = 0.05  # ignore moves smaller than this
MAX_MOVE_MM = 3.0   # clamp per-step move
QUALITY_MIN = 3.0   # peak-to-mean ratio below which we skip the move
LOOP_DELAY  = 0.5   # seconds between iterations

_running = False


# ── UI ─────────────────────────────────────────────────────────────────────────

SECTIONS = {
    "tracker": {
        "inputs": [
            {"type": "button", "label": "📷 Capture",      "action": "capture",  "style": ""},
            {"type": "button", "label": "⏹ Stop",          "action": "stop",     "style": "primary"},
        ],
        "outputs": [
            {"type": "text",        "id": "status", "label": "Status"},
            {"type": "image_click", "id": "live",   "label": "← Click on the object to track",
             "action": "on_click"},
            {"type": "image",       "id": "corr",   "label": "Phase correlation map"},
        ]
    }
}


# ── Image helpers ──────────────────────────────────────────────────────────────

def _to_gray(arr):
    """RGB (H,W,3) → float32 grayscale, downsampled DOWNSAMPLE×."""
    d = DOWNSAMPLE
    return (0.299 * arr[::d, ::d, 0]
          + 0.587 * arr[::d, ::d, 1]
          + 0.114 * arr[::d, ::d, 2]).astype(np.float32)


def _normalize(patch):
    """Zero-mean, unit-std normalization — brightness/contrast invariant."""
    m, s = patch.mean(), patch.std()
    return (patch - m) / (s + 1e-6)


def _to_rgb(gray):
    g8 = (gray / (gray.max() + 1e-6) * 255).clip(0, 255).astype(np.uint8)
    return np.stack([g8, g8, g8], axis=-1)


def _draw_cross(rgb, cx, cy, color, size=8):
    h, w = rgb.shape[:2]
    for d in range(-size, size + 1):
        if 0 <= cy + d < h: rgb[cy + d, cx] = color
        if 0 <= cx + d < w: rgb[cy, cx + d] = color


def _draw_box(rgb, cx, cy, half, color):
    h, w = rgb.shape[:2]
    y0, y1 = max(0, cy - half), min(h - 1, cy + half)
    x0, x1 = max(0, cx - half), min(w - 1, cx + half)
    rgb[y0, x0:x1] = color
    rgb[y1, x0:x1] = color
    rgb[y0:y1, x0] = color
    rgb[y0:y1, x1] = color


# ── Phase correlation ──────────────────────────────────────────────────────────

def _phase_correlation(template, frame):
    """
    Find shift of `frame` relative to `template` via phase correlation.
    Both arrays must be the same shape.
    Returns (dy, dx, corr_preview_rgb, quality).
    quality = peak / mean of correlation map (higher = more confident).
    """
    F_t = np.fft.fft2(_normalize(template))
    F_f = np.fft.fft2(_normalize(frame))
    cross = F_t * np.conj(F_f)
    denom = np.abs(cross) + 1e-8
    R = np.fft.ifft2(cross / denom).real
    R = np.fft.fftshift(R)

    peak_idx = np.unravel_index(np.argmax(R), R.shape)
    dy = float(peak_idx[0] - R.shape[0] // 2)
    dx = float(peak_idx[1] - R.shape[1] // 2)
    quality = float(R.max() / (np.abs(R).mean() + 1e-6))

    # Correlation map preview
    c = np.log1p(R - R.min())
    preview = _to_rgb(c)
    py, px = int(peak_idx[0]), int(peak_idx[1])
    cy_c, cx_c = R.shape[0] // 2, R.shape[1] // 2
    _draw_cross(preview, px,   py,   [255, 0, 0])   # red = detected shift
    _draw_cross(preview, cx_c, cy_c, [0, 255, 0])   # green = zero shift

    return dy, dx, preview, quality


# ── Actions ────────────────────────────────────────────────────────────────────

def capture(ctx, params):
    cam = ctx.cam
    if not cam:
        ctx.update_output('status', 'Camera not available')
        return {'success': False}
    picam, _ = cam._get_picam()
    if not picam:
        ctx.update_output('status', 'Camera not started')
        return {'success': False}

    arr = picam.capture_array("main")
    ctx.update_image('live', _to_rgb(_to_gray(arr)))
    ctx.update_output('status', 'Click on the object to track')
    return {'success': True}


def on_click(ctx, params):
    global _running

    cam   = ctx.cam
    stage = ctx.stage
    if not cam or not stage:
        ctx.update_output('status', 'Camera or stage not available')
        return {'success': False}
    picam, _ = cam._get_picam()
    if not picam:
        ctx.update_output('status', 'Camera not started')
        return {'success': False}

    nx = float(params.get('click_x', 0.5))
    ny = float(params.get('click_y', 0.5))

    # Capture reference frame
    arr  = picam.capture_array("main")
    gray = _to_gray(arr)
    h, w = gray.shape

    cx = int(nx * w)
    cy = int(ny * h)
    half = PATCH // 2

    # Clamp click to valid patch area
    cx = max(half, min(w - half - 1, cx))
    cy = max(half, min(h - half - 1, cy))

    template = gray[cy - half : cy + half,
                    cx - half : cx + half].copy()

    # Show selected region
    preview = _to_rgb(gray)
    _draw_box(preview, cx, cy, half, [0, 255, 0])
    _draw_cross(preview, cx, cy, [255, 0, 0])
    ctx.update_image('live', preview)
    ctx.update_output('status', 'Tracking… click ⏹ to stop')

    _running = True
    iteration = 0

    while _running:
        t0 = time.time()

        arr2  = picam.capture_array("main")
        gray2 = _to_gray(arr2)
        h2, w2 = gray2.shape

        # Extract same-size region from new frame (centered)
        fc_y, fc_x = h2 // 2, w2 // 2
        fc_y = max(half, min(h2 - half - 1, fc_y))
        fc_x = max(half, min(w2 - half - 1, fc_x))
        frame_patch = gray2[fc_y - half : fc_y + half,
                            fc_x - half : fc_x + half]

        dy_px, dx_px, corr_preview, quality = _phase_correlation(template, frame_patch)

        ctx.update_image('corr', corr_preview)

        if quality < QUALITY_MIN:
            ctx.update_output('status', f'[{iteration}] Low confidence (q={quality:.1f}) — skipping')
            time.sleep(max(0, LOOP_DELAY - (time.time() - t0)))
            iteration += 1
            continue

        # dx_px/dy_px are in downsampled pixels → undo downsample
        ddx, ddy = ctx.image_to_stage(dx_px * DOWNSAMPLE, dy_px * DOWNSAMPLE)
        ddx = max(-MAX_MOVE_MM, min(MAX_MOVE_MM, ddx))
        ddy = max(-MAX_MOVE_MM, min(MAX_MOVE_MM, ddy))

        ctx.update_output('status',
            f'[{iteration}] shift=({dx_px:.1f},{dy_px:.1f})px → ({ddx:+.2f},{ddy:+.2f})mm  q={quality:.1f}')

        if abs(ddx) > MIN_MOVE_MM or abs(ddy) > MIN_MOVE_MM:
            pos = stage.position
            stage.move_absolute(
                round(pos['X'] + ddx, 3),
                round(pos['Y'] + ddy, 3),
                pos['Z'], feedrate=1500
            )
            stage.finish_moves()

        time.sleep(max(0, LOOP_DELAY - (time.time() - t0)))
        iteration += 1

    ctx.update_output('status', 'Tracking stopped')
    return {'success': True}


def stop(ctx, params):
    global _running
    _running = False
    return {'success': True}


def on_unload(ctx):
    global _running
    _running = False

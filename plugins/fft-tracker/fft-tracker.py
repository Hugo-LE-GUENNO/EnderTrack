"""
plugins/fft-tracker/fft-tracker.py
====================================
EnderTrack plugin — FFT Cross-Correlation Object Tracker

USAGE
-----
1. Click "Capture" to grab a frame
2. Click on the object you want to track
3. The stage moves to keep the object centered
4. Click "Stop" to end tracking

CORE IDEA — FFT cross-correlation
----------------------------------
We want to know how much the object has moved between two frames.
Instead of scanning every possible position (slow), we use the FFT:

    correlation = IFFT( FFT(template) × conj(FFT(frame)) )

The position of the peak in the correlation map = the shift (dx, dy).
This works because a shift in space becomes a phase change in frequency domain.
"""

import numpy as np
import time

NAME        = "FFT Tracker"
VERSION     = "1.0.0"
DESCRIPTION = "Click on an object to track it with FFT cross-correlation"

# Patch size in downsampled pixels (image is 4× smaller after _to_gray)
PATCH = 64

# Stop flag — set to False by stop(), checked in the tracking loop
_running = False

# ── UI ─────────────────────────────────────────────────────────────────────────

SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "button", "label": "📷 Capture",       "action": "capture", "style": ""},
            {"type": "button", "label": "⏹ Stop tracking",  "action": "stop",    "style": "primary"},
        ],
        "outputs": [
            {"type": "text",        "id": "status", "label": "Status"},
            {"type": "image_click", "id": "live",   "label": "← Click on the object to track",
             "action": "on_click"},
            {"type": "image",       "id": "detect", "label": "Correlation peak"},
        ]
    }
}

# ── Image helpers ──────────────────────────────────────────────────────────────

def _to_gray(arr):
    """RGB (H,W,3) → grayscale float32, downsampled 4×."""
    return (0.299 * arr[::4, ::4, 0]
          + 0.587 * arr[::4, ::4, 1]
          + 0.114 * arr[::4, ::4, 2]).astype(np.float32)


def _to_preview(gray):
    """Grayscale float32 → RGB uint8 for display."""
    g8 = (gray / (gray.max() + 1e-6) * 255).clip(0, 255).astype(np.uint8)
    return np.stack([g8, g8, g8], axis=-1)


def _draw_box(rgb, cx, cy, size):
    """Draw a green box and red cross on the image (in-place)."""
    h, w = rgb.shape[:2]
    half = size // 2
    y0, y1 = max(0, cy - half), min(h - 1, cy + half)
    x0, x1 = max(0, cx - half), min(w - 1, cx + half)
    # Green rectangle
    rgb[y0, x0:x1] = [0, 255, 0]
    rgb[y1, x0:x1] = [0, 255, 0]
    rgb[y0:y1, x0] = [0, 255, 0]
    rgb[y0:y1, x1] = [0, 255, 0]
    # Red cross at center
    for d in range(-6, 7):
        if 0 <= cy + d < h: rgb[cy + d, cx] = [255, 0, 0]
        if 0 <= cx + d < w: rgb[cy, cx + d] = [255, 0, 0]


# ── FFT cross-correlation ──────────────────────────────────────────────────────

def _fft_shift(template, frame):
    """
    Find how much `frame` is shifted relative to `template`.
    Both must be the same shape (PATCH x PATCH).
    Returns (dy, dx, preview, quality).
    """
    F_t = np.fft.fft2(template)
    F_f = np.fft.fft2(frame)
    corr = np.fft.ifft2(F_t * np.conj(F_f)).real
    corr = np.fft.fftshift(corr)   # zero-shift at center

    peak = np.unravel_index(np.argmax(corr), corr.shape)
    dy = float(peak[0] - corr.shape[0] // 2)
    dx = float(peak[1] - corr.shape[1] // 2)

    quality = float(corr.max() / (np.abs(corr).mean() + 1e-6))

    # Preview: log scale, red cross at peak, green cross at center
    c = np.log1p(corr - corr.min())
    c_norm = (c / (c.max() + 1e-6) * 255).astype(np.uint8)
    preview = np.stack([c_norm, c_norm, c_norm], axis=-1)
    H, W = preview.shape[:2]
    py, px = int(peak[0]), int(peak[1])
    cy_c, cx_c = H // 2, W // 2
    for d in range(-4, 5):
        if 0 <= py+d < H: preview[py+d, px] = [255, 0, 0]
        if 0 <= px+d < W: preview[py, px+d] = [255, 0, 0]
        if 0 <= cy_c+d < H: preview[cy_c+d, cx_c] = [0, 255, 0]
        if 0 <= cx_c+d < W: preview[cy_c, cx_c+d] = [0, 255, 0]

    return dy, dx, preview, quality


# ── Actions ────────────────────────────────────────────────────────────────────

def capture(ctx, params):
    """Grab one frame and show it — user can then click on the object."""
    cam = ctx.cam
    if not cam:
        ctx.update_output('status', 'Camera not available'); return {'success': False}
    picam, _ = cam._get_picam()
    if not picam:
        ctx.update_output('status', 'Camera not started'); return {'success': False}

    arr = picam.capture_array("main")
    ctx.update_image('live', _to_preview(_to_gray(arr)))
    ctx.update_output('status', 'Click on the object to track')
    return {'success': True}


def on_click(ctx, params):
    """
    Called when the user clicks on the image.
    Extracts the template patch at the click position, then runs the tracking loop.
    """
    global _running

    cam   = ctx.cam
    stage = ctx.stage
    if not cam or not stage:
        ctx.update_output('status', 'Camera or stage not available'); return {'success': False}
    picam, _ = cam._get_picam()
    if not picam:
        ctx.update_output('status', 'Camera not started'); return {'success': False}

    # Normalized click coordinates [0,1] sent by the JS image_click handler
    nx = float(params.get('click_x', 0.5))
    ny = float(params.get('click_y', 0.5))

    # Capture a fresh frame and convert to grayscale
    arr  = picam.capture_array("main")
    gray = _to_gray(arr)
    h, w = gray.shape

    # Convert normalized click → pixel in the downsampled image
    cx = int(nx * w)
    cy = int(ny * h)

    # Extract the template patch (PATCH×PATCH pixels centered on the click)
    half = PATCH // 2
    if cy - half < 0 or cy + half > h or cx - half < 0 or cx + half > w:
        ctx.update_output('status', 'Click closer to the center'); return {'success': False}

    template = gray[cy - half : cy + half,
                    cx - half : cx + half].copy()

    # Show the selected patch on the preview
    preview = _to_preview(gray)
    _draw_box(preview, cx, cy, PATCH)
    ctx.update_image('live', preview)
    ctx.update_output('status', f'Tracking started — click ⏹ to stop')

    # ── Tracking loop ──────────────────────────────────────────────────────────
    _running = True
    iteration = 0

    while _running:
        time.sleep(0.8)

        # Capture new frame
        arr2  = picam.capture_array("main")
        gray2 = _to_gray(arr2)
        h, w  = gray2.shape

        # Search the template across the entire frame using sliding window
        # Step = half patch size for speed (not every pixel)
        best_score = -1
        best_cy, best_cx = h // 2, w // 2
        step = half  # slide by half-patch steps
        for sy in range(half, h - half, step):
            for sx in range(half, w - half, step):
                patch = gray2[sy - half:sy + half, sx - half:sx + half]
                score = float(np.sum(patch * template))  # normalized cross-correlation
                if score > best_score:
                    best_score = score
                    best_cy, best_cx = sy, sx

        # Offset of best match from image center
        dx_px = float(best_cx - w // 2)
        dy_px = float(best_cy - h // 2)
        quality = best_score / (np.sum(np.abs(gray2)) + 1e-6)
        ctx.log(f'found=({best_cx},{best_cy}) offset=({dx_px:.0f},{dy_px:.0f})px q={quality:.4f}', level='info')

        # Convert pixel offset → mm (×4 to undo 4× downsample)
        # gain=0.2: conservative step to avoid overshoot
        GAIN = 0.2
        MAX_STEP_MM = 2.0
        ddx, ddy = ctx.image_to_stage(dx_px * 4 * GAIN, dy_px * 4 * GAIN)
        ddx = max(-MAX_STEP_MM, min(MAX_STEP_MM, ddx))
        ddy = max(-MAX_STEP_MM, min(MAX_STEP_MM, ddy))

        # Draw overlay on detect output only (not live — to keep click stable)
        preview2 = _to_preview(gray2)
        _draw_box(preview2, best_cx, best_cy, PATCH)
        ctx.update_image('detect', preview2)

        # Move if delta > 1mm, stop if within acceptance threshold
        if abs(ddx) > 1.0 or abs(ddy) > 1.0:
            pos = stage.position
            stage.move_absolute(
                round(pos['X'] + ddx, 3),
                round(pos['Y'] + ddy, 3),
                pos['Z'], feedrate=1000
            )
            stage.finish_moves()
        else:
            ctx.update_output('status', f'[{iteration}] ✓ Centered — dx={dx_px:.0f}px dy={dy_px:.0f}px')
            break

        ctx.update_output('status',
            f'[{iteration}] dx={dx_px:.0f}px dy={dy_px:.0f}px → ({ddx:+.2f},{ddy:+.2f})mm')

        iteration += 1

    ctx.update_output('status', 'Tracking stopped')
    return {'success': True}


def stop(ctx, params):
    """Stop the tracking loop."""
    global _running
    _running = False
    return {'success': True}


def on_unload(ctx):
    global _running
    _running = False

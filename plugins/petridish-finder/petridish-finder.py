"""
plugins/petridish-finder/petridish-finder.py
============================================
EnderTrack plugin — Petri Dish Finder
Smart macroscopy: automatically locate and center a Petri dish on the stage.

ALGORITHM OVERVIEW
------------------
1. Move to the center of the stage travel range (starting point)
2. Capture an image and convert it to grayscale
3. Apply Otsu's automatic thresholding → binary mask (object vs background)
4. Find the largest connected blob in the mask (BFS flood-fill)
5a. If the blob touches the image edges → the dish is partially visible,
    move the stage toward the blob centroid (up to 50% of the field of view)
5b. If the blob is fully inside the image → move directly to the centroid,
    then verify the centering error is below 2 mm → save position and stop

COORDINATE SYSTEM
-----------------
- Image pixels: origin at top-left, X right, Y down
- Stage coordinates: X right, Y up  ← Y axis is INVERTED vs image
- ctx.image_to_stage() handles pixel→mm conversion + rotation + flip
  using the calibrated pixel_size stored in the camera config

OUTPUTS (visible in the EnderTrack plugin panel)
------------------------------------------------
- status : current step description (text)
- thresh : binary mask preview (image)
- detect : blob overlay with bounding box and centroid cross (image)
"""

import numpy as np   # array math — the only dependency needed
import time          # for sleep between moves and captures


# ── Plugin metadata (read by the EnderTrack plugin engine) ────────────────────

NAME        = "Petri Dish Finder"
VERSION     = "3.1.0"
DESCRIPTION = "Smart macroscopy — automatically locate and center a Petri dish"


# ── UI definition ─────────────────────────────────────────────────────────────
# SECTIONS defines the plugin panel layout in the EnderTrack web interface.
# Each input becomes a slider or button; each output becomes a live-updated widget.

SECTIONS = {
    "navigation": {
        "inputs": [
            # Minimum blob size as a percentage of the total image area.
            # Filters out small noise blobs (dust, reflections).
            {"type": "slider", "id": "min_area", "label": "Min blob (% img)",
             "min": 1, "max": 50, "default": 10, "step": 1},

            # Maximum number of capture-move iterations before giving up.
            {"type": "slider", "id": "max_iter", "label": "Max iterations",
             "min": 1, "max": 20, "default": 10, "step": 1},

            {"type": "button", "label": "Find Petri Dish", "action": "run", "style": "primary"},
        ],
        "outputs": [
            {"type": "text",  "id": "status", "label": "Status"},
            {"type": "image", "id": "thresh", "label": "1. Threshold"},
            {"type": "image", "id": "detect", "label": "2. Blob detection"},
        ]
    }
}

# SCENARIO_ACTIONS exposes this plugin as a step in the scenario builder.
SCENARIO_ACTIONS = [
    {
        'id': 'run',
        'label': 'Find Petri Dish',
        'timeout_ms': 300000,
        'params': [
            {'id': 'min_area', 'label': 'Min blob (% img)', 'type': 'number', 'default': 10, 'min': 1,  'max': 50},
            {'id': 'max_iter', 'label': 'Max iterations',   'type': 'number', 'default': 10, 'min': 1,  'max': 20},
            {'id': 'threshold_method', 'label': 'Threshold method', 'type': 'select', 'default': 'otsu',
             'options': [
                 {'value': 'otsu',     'label': 'Otsu (auto)'},
                 {'value': 'triangle', 'label': 'Triangle (uniform bg)'},
                 {'value': 'mean',     'label': 'Mean (flat lighting)'},
             ]},
        ]
    }
]


# ── IMAGE PROCESSING HELPERS ──────────────────────────────────────────────────

def _to_gray(arr):
    """
    Convert an RGB image array to grayscale, with 4× downsampling.

    Parameters
    ----------
    arr : np.ndarray, shape (H, W, 3), dtype uint8
        Raw RGB frame from the camera.

    Returns
    -------
    gray : np.ndarray, shape (H//4, W//4), dtype uint8

    Notes
    -----
    - arr[::4, ::4] keeps every 4th pixel in both dimensions → 16× fewer pixels.
      This makes all subsequent processing (BFS, threshold) much faster.
    - The luminance formula (0.299 R + 0.587 G + 0.114 B) matches human
      perception: green contributes most, blue the least.
    """
    return (0.299 * arr[::4, ::4, 0]   # red channel, weighted
          + 0.587 * arr[::4, ::4, 1]   # green channel, weighted
          + 0.114 * arr[::4, ::4, 2]   # blue channel, weighted
           ).astype(np.uint8)


def _otsu_threshold(gray):
    """
    Compute the optimal threshold using Otsu's method.

    Otsu's method finds the threshold T that maximizes the
    *between-class variance* of the two pixel populations:
      - background (pixels ≤ T)
      - foreground (pixels > T)

    Parameters
    ----------
    gray : np.ndarray, shape (H, W), dtype uint8

    Returns
    -------
    best_t : int
        Threshold value in [0, 255].

    How it works
    ------------
    For each candidate threshold t (0 → 255):
      w0, w1   = fraction of pixels below / above t
      m0, m1   = mean intensity below / above t
      var(t)   = w0 * w1 * (m0 - m1)²   ← between-class variance

    The threshold that maximises var(t) best separates the two classes.
    This is equivalent to minimising the total within-class variance.
    """
    # Build a 256-bin histogram of pixel intensities
    hist = np.bincount(gray.ravel(), minlength=256).astype(np.float64)
    total = hist.sum()                          # total number of pixels
    sum_all = np.dot(np.arange(256), hist)      # sum of all intensity values

    w0, sum0 = 0.0, 0.0    # running weight and intensity sum for class 0
    best_t, best_var = 128, 0.0

    for t in range(256):
        w0 += hist[t]               # add pixels at intensity t to class 0
        if w0 == 0: continue        # no pixels below t yet
        w1 = total - w0             # class 1 = everything above t
        if w1 == 0: break           # all pixels are in class 0

        sum0 += t * hist[t]
        m0 = sum0 / w0              # mean of class 0 (background)
        m1 = (sum_all - sum0) / w1  # mean of class 1 (foreground)

        # Between-class variance — maximise this
        var = w0 * w1 * (m0 - m1) ** 2
        if var > best_var:
            best_var, best_t = var, t

    return best_t


def _triangle_threshold(gray):
    hist = np.bincount(gray.ravel(), minlength=256).astype(np.float64)
    peak = int(np.argmax(hist))
    end = 255
    d = np.array([abs((hist[end] - hist[peak]) * i - (end - peak) * hist[i] + end * hist[peak] - hist[end] * peak)
                  for i in range(peak, end + 1)])
    return peak + int(np.argmax(d))


def _mean_threshold(gray):
    return int(gray.mean())


def _largest_blob(mask):
    """
    Find the largest connected region (blob) in a binary mask using BFS.

    Parameters
    ----------
    mask : np.ndarray, shape (H, W), dtype bool

    Returns
    -------
    (ys, xs) : tuple of np.ndarray, or None if mask is empty
        Row and column indices of all pixels belonging to the largest blob.

    Algorithm — Breadth-First Search (flood fill)
    ---------------------------------------------
    We scan every pixel. When we find an unlabelled foreground pixel,
    we start a BFS from it, labelling all connected foreground pixels
    with the same label and counting them. After scanning the whole image,
    we return the pixel coordinates of the largest labelled region.

    4-connectivity is used (up, down, left, right — no diagonals).
    """
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)   # 0 = unlabelled
    label  = 0
    sizes  = {}   # label → number of pixels

    for sy in range(h):
        for sx in range(w):
            # Start a new BFS only on unlabelled foreground pixels
            if mask[sy, sx] and labels[sy, sx] == 0:
                label += 1
                stack = [(sy, sx)]
                labels[sy, sx] = label
                size = 0

                while stack:
                    y, x = stack.pop()
                    size += 1
                    # Explore 4 neighbours
                    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        ny, nx = y + dy, x + dx
                        if (0 <= ny < h and 0 <= nx < w
                                and mask[ny, nx]
                                and labels[ny, nx] == 0):
                            labels[ny, nx] = label
                            stack.append((ny, nx))

                sizes[label] = size

    if not sizes:
        return None   # no foreground pixels at all

    # Return pixel coordinates of the largest blob
    best = max(sizes, key=sizes.get)
    ys, xs = np.where(labels == best)
    return ys, xs


def _touches_edge(ys, xs, h, w, margin=3):
    """
    Return True if the blob reaches within `margin` pixels of any image edge.

    A blob touching the edge means the object extends beyond the field of view
    → we cannot see the full dish yet, so we must keep moving.
    """
    return (ys.min() <= margin or ys.max() >= h - margin or
            xs.min() <= margin or xs.max() >= w - margin)


# ── PREVIEW HELPERS ───────────────────────────────────────────────────────────

def _preview_thresh(gray, mask):
    """
    Build an RGB preview image showing the threshold result.
    Background is darkened; thresholded pixels are shown in white.
    """
    out = np.stack([gray // 4] * 3, axis=-1).astype(np.uint8)  # dim background
    out[mask] = [255, 255, 255]                                  # white foreground
    return out


def _preview_detect(gray, mask, ys, xs, cy, cx, touches):
    """
    Build an RGB overlay showing the detected blob.

    - Blob pixels: green (fully visible) or orange (touches edge)
    - Bounding box: yellow rectangle
    - Centroid: red cross
    """
    out = np.stack([gray // 4] * 3, axis=-1).astype(np.uint8)

    # Color the blob — orange if it touches the edge, green if fully inside
    color = [255, 140, 0] if touches else [0, 220, 80]
    out[mask] = color

    # Draw bounding box in yellow
    h, w = gray.shape
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    for x in range(x0, x1 + 1):
        if 0 <= y0 < h: out[y0, x] = [255, 255, 0]
        if 0 <= y1 < h: out[y1, x] = [255, 255, 0]
    for y in range(y0, y1 + 1):
        if 0 <= x0 < w: out[y, x0] = [255, 255, 0]
        if 0 <= x1 < w: out[y, x1] = [255, 255, 0]

    # Draw centroid cross in red
    cy_i, cx_i = int(cy), int(cx)
    arm = 8
    for d in range(-arm, arm + 1):
        if 0 <= cy_i + d < h: out[cy_i + d, cx_i] = [255, 0, 0]
        if 0 <= cx_i + d < w: out[cy_i, cx_i + d] = [255, 0, 0]

    return out


# ── MAIN ACTION ───────────────────────────────────────────────────────────────

def run(ctx, params):
    """
    Main plugin entry point — called when the user clicks "Find Petri Dish".

    Parameters
    ----------
    ctx : PluginContext
        Injected by the EnderTrack plugin engine. Provides access to:
          ctx.stage              — XYZ stage controller
          ctx.cam                — camera handler (picamera2)
          ctx.config             — data/config.json as a dict
          ctx.image_to_stage()   — pixel offset → mm delta on stage
          ctx.fov_mm()           — current field of view in mm
          ctx.update_output()    — update a text output in the UI
          ctx.update_image()     — update an image output in the UI
          ctx.log()              — write to the server log
          ctx.lists.add()        — add a position to the position list

    params : dict
        Values from the UI sliders / scenario builder.
    """

    # ── 1. Check hardware availability ────────────────────────────────────────
    stage = ctx.stage
    cam   = ctx.cam
    if not stage:
        ctx.update_output('status', 'Stage not connected')
        return {'success': False}
    if not cam:
        ctx.update_output('status', 'Camera not available')
        return {'success': False}

    picam, _ = cam._get_picam()   # get the underlying picamera2 instance
    if not picam:
        ctx.update_output('status', 'Camera not started')
        return {'success': False}

    # ── 2. Read parameters ────────────────────────────────────────────────────
    # min_area: slider gives a percentage (e.g. 10) → convert to fraction (0.10)
    min_area = float(params.get('min_area', 10)) / 100.0
    max_iter = int(params.get('max_iter', 10))

    # ── 3. Read stage travel bounds from config ───────────────────────────────
    # coordinateBounds can be stored in two formats depending on the config version:
    #   flat:   { xMin, xMax, yMin, yMax }
    #   nested: { x: { min, max }, y: { min, max } }
    cfg    = ctx.config
    bounds = cfg.get('coordinateBounds', {})
    x_min  = float(bounds.get('xMin', bounds.get('x', {}).get('min', 0)))
    x_max  = float(bounds.get('xMax', bounds.get('x', {}).get('max', 220)))
    y_min  = float(bounds.get('yMin', bounds.get('y', {}).get('min', 0)))
    y_max  = float(bounds.get('yMax', bounds.get('y', {}).get('max', 220)))
    z0     = stage.position['Z']   # keep Z constant throughout

    # ── 4. Move to the center of the stage travel range ───────────────────────
    # Starting from the center maximises the chance of seeing the dish
    # on the first capture, regardless of where it was placed.
    cx0 = round((x_min + x_max) / 2, 2)
    cy0 = round((y_min + y_max) / 2, 2)
    ctx.update_output('status', f'Moving to center ({cx0}, {cy0})...')
    stage.move_absolute(cx0, cy0, z0, feedrate=6000)
    stage.finish_moves()
    time.sleep(1.0)   # wait for vibrations to settle before capturing

    # ── 5. Iterative search loop ──────────────────────────────────────────────
    for i in range(max_iter):
        ctx.update_output('status', f'[{i+1}/{max_iter}] Capturing...')
        time.sleep(0.8)   # short delay to ensure a fresh frame

        # Capture a raw RGBA frame from the camera (shape: H × W × 4)
        arr  = picam.capture_array("main")

        # Convert to grayscale with 4× downsampling for faster processing
        # After this, gray has shape (H//4, W//4)
        gray = _to_gray(arr)
        h, w = gray.shape

        # ── 5a. Thresholding ──────────────────────────────────────────────────
        method = params.get('threshold_method', 'otsu')
        if method == 'triangle':
            threshold = _triangle_threshold(gray)
        elif method == 'mean':
            threshold = _mean_threshold(gray)
        else:
            threshold = _otsu_threshold(gray)
        mask = gray > threshold   # True = foreground (bright = dish)
        fill = mask.sum() / (h * w)
        ctx.log(
            f'pos=({stage.position["X"]:.1f},{stage.position["Y"]:.1f}) '
            f'{method}={threshold} fill={fill:.3f}',
            level='info'
        )
        ctx.update_image('thresh', _preview_thresh(gray, mask))

        # ── 5b. Find the largest connected blob ───────────────────────────────
        # The Petri dish should be the dominant bright object in the scene.
        blob = _largest_blob(mask)

        # Reject if no blob found, or if it is too small (noise / dust)
        if blob is None or (len(blob[0]) / (h * w)) < min_area:
            ctx.update_output('status', f'[{i+1}/{max_iter}] No blob detected')
            ctx.update_image('detect', _preview_thresh(gray, mask))
            continue

        ys, xs = blob

        # Centroid of the bounding box (faster than true centroid, good enough)
        cy_img = (float(ys.min()) + float(ys.max())) / 2.0
        cx_img = (float(xs.min()) + float(xs.max())) / 2.0

        # Does the blob reach the image border?
        touches = _touches_edge(ys, xs, h, w)

        ctx.update_image('detect', _preview_detect(gray, mask, ys, xs, cy_img, cx_img, touches))

        # ── 5c. Convert centroid offset (pixels) → stage delta (mm) ──────────
        # cx_img - w/2 : pixel offset from image center (positive = right)
        # cy_img - h/2 : pixel offset from image center (positive = down in image)
        # × 4          : undo the 4× downsampling to get native pixel offset
        # ctx.image_to_stage() then applies:
        #   - effective pixel size (µm/px, accounting for resolution scaling)
        #   - Y axis inversion (image Y↓ → stage Y↑)
        #   - camera rotation and flip from the calibration config
        ddx, ddy = ctx.image_to_stage((cx_img - w / 2) * 4,
                                       (cy_img - h / 2) * 4)

        if touches:
            # ── Case A: dish is partially outside the field of view ───────────
            # Move toward the centroid, but cap the step at 50% of the FOV
            # to avoid overshooting when only a small arc is visible.
            fov_x, fov_y = ctx.fov_mm()
            step_x = max(-fov_x * 0.5, min(fov_x * 0.5, ddx))
            step_y = max(-fov_y * 0.5, min(fov_y * 0.5, ddy))
            tx = round(max(x_min, min(x_max, stage.position['X'] + step_x)), 3)
            ty = round(max(y_min, min(y_max, stage.position['Y'] + step_y)), 3)
            ctx.update_output('status', f'[{i+1}/{max_iter}] Dish on edge → ({tx:.1f}, {ty:.1f})')
            stage.move_absolute(tx, ty, z0, feedrate=3000)
            stage.finish_moves()

        else:
            # ── Case B: dish is fully visible ─────────────────────────────────
            # Move the stage so that the dish centroid lands at the image center.
            # ddx, ddy is already the exact correction needed.
            tx = round(max(x_min, min(x_max, stage.position['X'] + ddx)), 3)
            ty = round(max(y_min, min(y_max, stage.position['Y'] + ddy)), 3)
            ctx.update_output('status', f'[{i+1}/{max_iter}] Centering → ({tx:.1f}, {ty:.1f})')
            stage.move_absolute(tx, ty, z0, feedrate=3000)
            stage.finish_moves()
            time.sleep(0.5)

            # ── 5d. Verification capture ──────────────────────────────────────
            # After moving, recapture and recompute the centroid.
            # If the residual error is below 2 mm, the dish is centered → done.
            arr2  = picam.capture_array("main")
            gray2 = _to_gray(arr2)
            h2, w2 = gray2.shape
            mask2 = gray2 > _otsu_threshold(gray2)
            blob2 = _largest_blob(mask2)

            if blob2 is not None:
                ys2, xs2 = blob2
                cy2 = (float(ys2.min()) + float(ys2.max())) / 2.0
                cx2 = (float(xs2.min()) + float(xs2.max())) / 2.0
                ctx.update_image('detect', _preview_detect(gray2, mask2, ys2, xs2, cy2, cx2, False))

                # Residual error in mm
                ddx2, ddy2 = ctx.image_to_stage((cx2 - w2 / 2) * 4,
                                                 (cy2 - h2 / 2) * 4)
                delta_mm = (ddx2 ** 2 + ddy2 ** 2) ** 0.5
                ctx.log(f'Residual error = {delta_mm:.2f} mm', level='info')

                if delta_mm < 2.0:
                    # ── Success: save position and exit ───────────────────────
                    ctx.lists.add(tx, ty, z0, name='Petri Dish')
                    ctx.log(f'Petri dish centered at ({tx:.2f}, {ty:.2f})', level='ok')
                    ctx.update_output('status',
                        f'✓ Centered at ({tx:.2f}, {ty:.2f})  Δ={delta_mm:.1f} mm')
                    return {'success': True, 'x': tx, 'y': ty}
                # Residual > 2 mm → loop continues for another correction pass

    # ── 6. Timeout ────────────────────────────────────────────────────────────
    ctx.update_output('status', f'Not converged after {max_iter} iterations')
    return {'success': False}

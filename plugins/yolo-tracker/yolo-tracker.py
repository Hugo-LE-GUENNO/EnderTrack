import threading
import time
import traceback

NAME = "YOLO Tracker"
VERSION = "1.1.0"
DESCRIPTION = "Live YOLO/ByteTrack — select target, stage follows."

SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "file",   "id": "model_path",   "label": "Model (.pt)",      "accept": ".pt"},
            {"type": "input",  "id": "confidence",   "label": "Min confidence",   "default": "0.30"},
            {"type": "button", "label": "Start live", "action": "start_live",     "style": "primary"},
            {"type": "button", "label": "Stop live",  "action": "stop_live"},
            {"type": "input",  "id": "target_id",    "label": "Track ID",         "default": ""},
            {"type": "input",  "id": "lost_timeout", "label": "Lost timeout (s)", "default": "4"},
            {"type": "button", "label": "Track",      "action": "select_target",  "style": "primary"},
            {"type": "button", "label": "Stop track", "action": "stop_track"},
        ],
        "outputs": [
            {"type": "text",  "id": "status",      "label": "Status"},
            {"type": "text",  "id": "ids",         "label": "Detected IDs"},
            {"type": "text",  "id": "target",      "label": "Target"},
            {"type": "text",  "id": "coordinates", "label": "Coordinates"},
            {"type": "image", "id": "live_image",  "label": "Live"},
        ],
    }
}

_lock        = threading.RLock()
_stop_event  = threading.Event()
_worker      = None
_selected_id = None
_last_seen   = 0.0
_tracking    = False

MOVE_THRESHOLD_PX = 15


def _safe_float(v, default):
    try:    return float(v)
    except: return default


def start_live(ctx, params):
    global _worker, _selected_id, _last_seen, _tracking

    with _lock:
        if _worker is not None and _worker.is_alive():
            ctx.update_output("status", "Live already running.")
            return {"success": True}

        cam = ctx.cam
        if cam is None:
            ctx.update_output("status", "Camera unavailable.")
            return {"success": False}

        try:
            picam, _ = cam._get_picam()
        except Exception as e:
            ctx.update_output("status", "Camera error: %s" % e)
            return {"success": False}

        if picam is None:
            ctx.update_output("status", "Camera not started.")
            return {"success": False}

        model_path = str(params.get("model_path") or "").strip()
        if not model_path:
            ctx.update_output("status", "No model selected.")
            return {"success": False}

        confidence   = max(0.01, min(0.99, _safe_float(params.get("confidence"), 0.30)))
        lost_timeout = max(0.5,  min(60.0, _safe_float(params.get("lost_timeout"), 4.0)))

        _stop_event.clear()
        _selected_id = None
        _last_seen   = 0.0
        _tracking    = False

        _worker = threading.Thread(
            target=_loop,
            args=(ctx, picam, model_path, confidence, lost_timeout),
            daemon=True,
        )
        _worker.start()

    ctx.update_output("status", "Loading model...")
    return {"success": True}


def stop_live(ctx, params=None):
    global _worker, _selected_id, _tracking

    _stop_event.set()
    with _lock:
        worker       = _worker
        _selected_id = None
        _tracking    = False

    if worker and worker.is_alive() and worker is not threading.current_thread():
        worker.join(timeout=3.0)

    with _lock:
        if _worker is worker:
            _worker = None

    ctx.update_output("status",      "Stopped.")
    ctx.update_output("target",      "—")
    ctx.update_output("coordinates", "—")
    return {"success": True}


def select_target(ctx, params):
    global _selected_id, _last_seen, _tracking

    raw = params.get("target_id")
    if not raw or str(raw).strip() == "":
        ctx.update_output("status", "Enter a ByteTrack ID first.")
        return {"success": False}

    try:
        tid = int(float(raw))
    except (TypeError, ValueError):
        return {"success": False, "error": "ID must be an integer"}

    with _lock:
        _selected_id = tid
        _last_seen   = time.monotonic()
        _tracking    = True

    ctx.update_output("target", "ID %d — searching..." % tid)
    ctx.update_output("status", "Tracking ID %d." % tid)
    return {"success": True}


def stop_track(ctx, params=None):
    global _selected_id, _tracking

    with _lock:
        _selected_id = None
        _tracking    = False

    ctx.update_output("target",      "—")
    ctx.update_output("coordinates", "—")
    ctx.update_output("status",      "Stage follow stopped.")
    return {"success": True}


def on_unload(ctx):
    _stop_event.set()
    with _lock:
        worker = _worker
    if worker and worker.is_alive():
        worker.join(timeout=3.0)


def _loop(ctx, picam, model_path, confidence, lost_timeout):
    global _worker, _selected_id, _last_seen, _tracking

    try:
        import cv2
        import numpy as np
        from ultralytics import YOLO

        model = YOLO(model_path)
        ctx.update_output("status", "Live — waiting for target.")
        ctx.update_output("ids",    "No detections yet.")
        last_ui = 0.0

        while not _stop_event.is_set():
            frame_raw = picam.capture_array("main")
            if frame_raw is None:
                time.sleep(0.03)
                continue

            frame_raw = np.asarray(frame_raw)
            if frame_raw.ndim == 2:
                bgr = cv2.cvtColor(frame_raw, cv2.COLOR_GRAY2BGR)
            elif frame_raw.shape[2] == 4:
                bgr = cv2.cvtColor(frame_raw, cv2.COLOR_RGBA2BGR)
            else:
                bgr = cv2.cvtColor(frame_raw[:, :, :3], cv2.COLOR_RGB2BGR)

            results   = model.track(source=bgr, persist=True, tracker="bytetrack.yaml",
                                    conf=confidence, iou=0.7, verbose=False)
            result    = results[0]
            annotated = result.plot()
            h, w      = bgr.shape[:2]

            dets = []
            if result.boxes is not None and result.boxes.id is not None:
                for box, tid, conf, cls in zip(
                    result.boxes.xyxy.cpu().numpy(),
                    result.boxes.id.int().cpu().numpy(),
                    result.boxes.conf.cpu().numpy(),
                    result.boxes.cls.int().cpu().numpy(),
                ):
                    dets.append({
                        "id":  int(tid),
                        "box": box.tolist(),
                        "conf": float(conf),
                        "cls": result.names.get(int(cls), str(cls)),
                    })

            now = time.monotonic()
            with _lock:
                target_id = _selected_id
                tracking  = _tracking

            selected = next((d for d in dets if d["id"] == target_id), None) \
                       if target_id is not None else None

            if selected is not None:
                with _lock:
                    _last_seen = now

                x1, y1, x2, y2 = selected["box"]
                cx = (x1 + x2) / 2.0
                cy = (y1 + y2) / 2.0
                ex = cx - w / 2.0
                ey = cy - h / 2.0

                cv2.rectangle(annotated, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 3)
                cv2.drawMarker(annotated, (int(cx), int(cy)), (0, 255, 0), cv2.MARKER_CROSS, 18, 2)
                cv2.putText(annotated, "TRACKING ID %d" % target_id,
                            (max(8, int(x1)), max(25, int(y1) - 10)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

                if tracking:
                    err_px = (ex ** 2 + ey ** 2) ** 0.5
                    if err_px > MOVE_THRESHOLD_PX:
                        try:
                            dx_mm, dy_mm = ctx.image_to_stage(ex, ey)
                            stage = ctx.stage
                            if stage is not None:
                                speeds = getattr(stage, 'speeds', {})
                                max_feed = int(speeds.get('xy_mms', 50) * 60)
                                min_feed = max(100, max_feed // 10)
                                feed = int(min_feed + (max_feed - min_feed) *
                                           min(err_px / (w / 2.0), 1.0))
                                stage.move_relative(dx=dx_mm, dy=dy_mm, dz=0.0, feedrate=feed)
                                pos = stage.position
                                ctx.update_output(
                                    "coordinates",
                                    "ID %d | err %.0f px | dX %+.3f mm dY %+.3f mm | X %.3f Y %.3f" % (
                                        target_id, err_px, dx_mm, dy_mm,
                                        float(pos["X"]), float(pos["Y"]))
                                )
                        except Exception as e:
                            ctx.update_output("coordinates", "Move error: %s" % e)
                    else:
                        ctx.update_output("coordinates",
                                          "ID %d — centered (err %.0f px)" % (target_id, err_px))

                ctx.update_output("target", "ID %d — VISIBLE" % target_id)

            elif target_id is not None:
                with _lock:
                    last_seen = _last_seen
                elapsed   = now - last_seen if last_seen else 0.0
                remaining = max(0.0, lost_timeout - elapsed)
                if elapsed >= lost_timeout:
                    with _lock:
                        if _selected_id == target_id:
                            _selected_id = None
                            _tracking    = False
                    ctx.update_output("target",      "ID %d — lost" % target_id)
                    ctx.update_output("status",      "Target lost. Select a new ID.")
                    ctx.update_output("coordinates", "—")
                else:
                    ctx.update_output("target",
                                      "ID %d — lost (%.1f s)" % (target_id, remaining))
                    cv2.putText(annotated, "ID %d LOST %.1fs" % (target_id, remaining),
                                (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 165, 255), 2)

            if now - last_ui >= 0.20:
                ids_text = "   ".join(
                    "ID %d %s %.0f%%" % (d["id"], d["cls"], d["conf"] * 100) for d in dets
                ) if dets else "No detections"
                ctx.update_output("ids", ids_text)
                ctx.update_image("live_image", cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB))
                last_ui = now

            _stop_event.wait(0.005)

    except Exception as e:
        traceback.print_exc()
        ctx.update_output("status", "Error: %s" % e)
        ctx.log("yolo-tracker error: %s" % e, "error")
    finally:
        with _lock:
            if _worker is threading.current_thread():
                _worker = None
        ctx.update_output("status", "Stopped." if _stop_event.is_set() else "Stopped (error).")

"""
Autofocus for EnderPiCam — 3-phase coarse-to-fine with backlash compensation.
  Phase 1: Very coarse (1mm) — find the zone
  Phase 2: Coarse (0.1mm) — narrow down  
  Phase 3: Fine descent only (0.01mm) — precise, backlash-free
"""
import numpy as np
import sys
import time

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False


class Autofocus:
    def __init__(self, na=0.25, settle_ms=150, min_step_mm=0.01):
        self.dof_mm = (0.55 / (na ** 2)) / 1000.0
        self.fine_step = max(min_step_mm, self.dof_mm / 3.0)
        self.coarse_step = self.fine_step * 10   # 0.1mm
        self.vcoarse_step = self.fine_step * 100  # 1mm
        self.backlash_mm = 0.15
        self.is_locked = False
        self.best_z = None
        self.max_score = 0.0
        self.settle_ms = settle_ms

    def _log(self, msg):
        sys.stderr.write(f"autofocus: {msg}\n")
        sys.stderr.flush()

    @staticmethod
    def focus_metric(frame_rgb):
        if HAS_CV2:
            gray = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
            return float(cv2.Laplacian(gray, cv2.CV_32F).var())
        gray = (0.299 * frame_rgb[:,:,0] + 0.587 * frame_rgb[:,:,1] + 0.114 * frame_rgb[:,:,2]).astype(np.float32)
        lap = -4*gray[1:-1,1:-1] + gray[:-2,1:-1] + gray[2:,1:-1] + gray[1:-1,:-2] + gray[1:-1,2:]
        return float(lap.var())

    def _measure(self, capture_func):
        frame = capture_func()
        return self.focus_metric(frame) if frame is not None else 0.0

    def _move(self, move_func, dz):
        move_func(dz)
        time.sleep(self.settle_ms / 1000.0)

    def _scan(self, capture_func, move_func, z, step, z_min, z_max, label, max_steps=50):
        """
        Scan in best direction. Continues as long as improving.
        Stops after 3 consecutive non-improvements OR max_steps OR out of range.
        Returns (z_current, best_z, best_score).
        If neither direction improves: returns with 'lost' flag (best_score=0 sentinel).
        """
        best_score = self._measure(capture_func)
        best_z = z
        self._log(f"{label} z={z:.3f} step={step} score={best_score:.4f}")

        # Probe: try +step
        self._move(move_func, step)
        z += step
        score_up = self._measure(capture_func)

        if score_up > best_score:
            best_score = score_up
            best_z = z
            direction = 1
        else:
            # Try -step (go back -2*step from current)
            self._move(move_func, -2 * step)
            z -= 2 * step
            score_down = self._measure(capture_func)
            if score_down > best_score:
                best_score = score_down
                best_z = z
                direction = -1
            else:
                # Neither direction improves — lost
                move_func(step)
                z += step
                time.sleep(self.settle_ms / 1000.0)
                self._log(f"{label} -> LOST, no improvement in either direction z={z:.3f}")
                return z, best_z, best_score

        # Continue in best direction as long as improving
        n = 0
        stale = 0
        prev_score = best_score
        while z_min < z < z_max and n < max_steps:
            self._move(move_func, direction * step)
            z += direction * step
            score = self._measure(capture_func)
            n += 1
            if score > best_score:
                best_score = score
                best_z = z
                stale = 0
            elif score < prev_score * 0.95:
                # Significant drop — stop
                stale += 1
                if stale >= 3:
                    break
            else:
                stale += 1
                if stale >= 3:
                    break
            prev_score = score

        self._log(f"{label} -> best_z={best_z:.3f} score={best_score:.4f} ({n} steps, now at z={z:.3f})")
        return z, best_z, best_score

    def search(self, capture_func, move_z_func, z_min_mm, z_max_mm, current_z_mm):
        self._log(f"search z={current_z_mm:.3f} range=[{z_min_mm},{z_max_mm}]")
        self.is_locked = False

        # ── Phase 1: Very coarse (1mm) ───────────────────
        z, best1_z, _ = self._scan(
            capture_func, move_z_func, current_z_mm,
            self.vcoarse_step, z_min_mm, z_max_mm, "P1"
        )
        # Go to best1 zone
        if abs(z - best1_z) > 0.001:
            move_z_func(best1_z - z)
            z = best1_z
            time.sleep(self.settle_ms / 1000.0)

        # ── Phase 2: Coarse (0.1mm) ─────────────────────
        c_min = max(z_min_mm, z - self.vcoarse_step)
        c_max = min(z_max_mm, z + self.vcoarse_step)
        z, best2_z, _ = self._scan(
            capture_func, move_z_func, z,
            self.coarse_step, c_min, c_max, "P2"
        )
        # Go to best2 zone
        if abs(z - best2_z) > 0.001:
            move_z_func(best2_z - z)
            z = best2_z
            time.sleep(self.settle_ms / 1000.0)

        # ── Phase 3: Fine descent (backlash-free) ────────
        # Go above, then descend only
        overshoot = self.backlash_mm
        move_z_func(overshoot)
        z += overshoot
        time.sleep(self.settle_ms / 1000.0)
        self._log(f"P3 descend from z={z:.3f}")

        best_score = 0.0
        best_z = z
        n_fine = int((overshoot * 2) / self.fine_step)
        drops = 0
        prev_score = 0.0

        for _ in range(n_fine):
            self._move(move_z_func, -self.fine_step)
            z -= self.fine_step
            score = self._measure(capture_func)
            if score > best_score:
                best_score = score
                best_z = z
                drops = 0
            elif score < prev_score:
                drops += 1
                if drops >= 3:
                    break
            else:
                drops = 0
            prev_score = score

        self._log(f"P3 -> best_z={best_z:.4f} score={best_score:.4f}")

        # Go to best — approach from above
        delta = best_z - z
        if delta > 0:
            move_z_func(delta)
        elif delta < 0:
            move_z_func(-delta + self.backlash_mm)
            time.sleep(self.settle_ms / 1000.0)
            move_z_func(delta - self.backlash_mm)
        time.sleep(self.settle_ms / 1000.0)

        self.is_locked = True
        self.best_z = best_z
        self.max_score = best_score
        self._log(f"locked z={best_z:.4f} score={best_score:.4f}")
        return True, best_z, best_score

    def check_and_correct(self, capture_func, move_z_func):
        if not self.is_locked:
            return False
        score = self._measure(capture_func)
        if self.max_score <= 0:
            return True
        drop = (self.max_score - score) / self.max_score
        if drop < 0.05:
            return True

        step = self.fine_step
        move_z_func(step + self.backlash_mm)
        time.sleep(self.settle_ms / 1000.0)
        move_z_func(-self.backlash_mm)
        time.sleep(self.settle_ms / 1000.0)

        best_s, best_dz = score, 0
        for offset in [step, 0, -step]:
            if offset != step:
                move_z_func(-step)
                time.sleep(self.settle_ms / 1000.0)
            s = self._measure(capture_func)
            if s > best_s:
                best_s = s
                best_dz = offset

        move_z_func(step + best_dz)
        self.best_z += best_dz
        self.max_score = best_s
        time.sleep(self.settle_ms / 1000.0)
        return True

    def get_status(self):
        return {
            'is_locked': self.is_locked,
            'best_z': self.best_z,
            'max_score': self.max_score,
            'dof_mm': self.dof_mm,
            'fine_step': self.fine_step,
            'coarse_step': self.coarse_step,
            'vcoarse_step': self.vcoarse_step,
        }

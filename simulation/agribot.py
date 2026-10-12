"""Simulation core: robot controller, simulated sensors and the survey mission.

Used by run.py (interactive viewer) and record.py (headless video + results).
"""

import math
import random

import mujoco
import numpy as np

from gait import Trot, leg_ik, stance_angles
from model import DISEASE_CENTRE, FIELD, FOOT_R, LEGS, ROW_X, ROW_Y, SERVO_TORQUE, build_xml

CTRL_DT = 0.01               # controller rate: 100 Hz
CROUCH, STAND = 0.10, 0.180  # body heights (hip to foot centre, m)
STAND_UP_S = 2.0
GAP_Y = [(a + b) / 2 for a, b in zip(ROW_Y, ROW_Y[1:])]   # the walkable gaps between rows
ROW_END_X = ROW_X[1] + 0.55                                # turn-around line in the headland
ROW_END_SONAR = 0.55                                       # hedge closer than this = end of row


# ------------------------------------------------------------------ simulated environment
# Stressed and diseased plants emit volatile organic compounds - the reason a
# gas sensor belongs on a crop robot. TVOC peaks over the diseased patch; dust
# rises over the dry headland track at the east end of the field.
def env_tvoc(x, y):
    dx, dy = x - DISEASE_CENTRE[0], y - DISEASE_CENTRE[1]
    return 16 + 640 * math.exp(-(dx * dx + 2.2 * dy * dy) / (2 * 0.42 ** 2))


def env_dust(x, y):
    return 3100 + 11500 * math.exp(-((x - (FIELD[0] - 0.55)) ** 2) / (2 * 0.32 ** 2))


def env_temp(x, y):
    return 30.6 + 0.9 * (y + FIELD[1]) / (2 * FIELD[1]) + 0.25 * math.sin(x * 1.3)


def level(v, moderate, high):
    return "high" if v >= high else "moderate" if v >= moderate else "good"


def quat_to_rpy(q):
    w, x, y, z = q
    roll = math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y))
    pitch = math.asin(max(-1.0, min(1.0, 2 * (w * y - z * x))))
    yaw = math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))
    return roll, pitch, yaw


class AgriBot:
    def __init__(self, speed=0.14, seed=3):
        self.m = mujoco.MjModel.from_xml_string(build_xml())
        self.d = mujoco.MjData(self.m)
        self.rng = random.Random(seed)
        self.gait = Trot(height=CROUCH, freq=2.0, duty=0.6, step_height=0.03, level_gain=0.5)
        self.speed = speed
        self.substeps = round(CTRL_DT / self.m.opt.timestep)
        self.act = {f"{leg}_{j}": self.m.actuator(f"{leg}_{j}").id for leg in LEGS for j in ("abd", "hip", "knee")}
        # mission: serpentine survey, one pass down each gap between crop rows
        self.waypoints = []
        for i, gy in enumerate(GAP_Y):
            xs = (-ROW_END_X, ROW_END_X) if i % 2 == 0 else (ROW_END_X, -ROW_END_X)
            self.waypoints += [(xs[0], gy), (xs[1], gy)]
        self.wp = 1
        self.state = "standing up"
        self.events = []
        self.trail = []            # (x, y, tvoc) samples for the heat-map trail
        self.log = []              # telemetry rows for results
        self.distance = 0.0
        self._last_xy = None
        self._tvoc = 16.0
        self._dust = 3100.0
        self.reset()

    # -------------------------------------------------------------- setup
    def reset(self):
        mujoco.mj_resetData(self.m, self.d)
        x0, y0 = self.waypoints[0]
        self.d.qpos[0:3] = (x0, y0, CROUCH + FOOT_R + 0.004)
        self.d.qpos[3:7] = (1, 0, 0, 0)
        for leg, angles in stance_angles(CROUCH).items():
            for j, q in zip(("abd", "hip", "knee"), angles):
                jid = self.m.joint(f"{leg}_{j}").id
                self.d.qpos[self.m.jnt_qposadr[jid]] = q
                self.d.ctrl[self.act[f"{leg}_{j}"]] = q
        mujoco.mj_forward(self.m, self.d)
        self.t0 = self.d.time

    # -------------------------------------------------------------- state
    @property
    def pose(self):
        x, y, z = self.d.qpos[0:3]
        roll, pitch, yaw = quat_to_rpy(self.d.qpos[3:7])
        return x, y, z, roll, pitch, yaw

    def com_offset(self):
        """Whole-robot centre of mass in the torso frame (x, y), smoothed."""
        torso = self.m.body("torso").id
        rel = self.d.subtree_com[torso] - self.d.xpos[torso]
        local = self.d.xmat[torso].reshape(3, 3).T @ rel
        prev = getattr(self, "_com", local[:2])
        self._com = 0.9 * prev + 0.1 * local[:2]
        return float(self._com[0]), float(self._com[1])

    def sonar(self, name):
        v = float(self.d.sensor(name).data[0])
        return v if 0 <= v <= 4.0 else None   # HC-SR04 range is ~4 m; -1 = no echo

    @property
    def fallen(self):
        _, _, z, roll, pitch, _ = self.pose
        return z < 0.07 or abs(roll) > 0.8 or abs(pitch) > 0.8

    # -------------------------------------------------------------- mission
    def _command(self):
        """Forward speed and yaw rate for this control tick."""
        t = self.d.time - self.t0
        if self.state == "standing up":
            if t >= STAND_UP_S + 0.5:
                self.state = "surveying"
                self.events.append((t, "Standing - starting row survey"))
            return 0.0, 0.0, False
        if self.state in ("done", "fallen"):
            return 0.0, 0.0, False

        x, y, _, _, _, yaw = self.pose
        tx, ty = self.waypoints[self.wp]
        dist = math.hypot(tx - x, ty - y)
        heading = math.atan2(ty - y, tx - x)
        err = (heading - yaw + math.pi) % (2 * math.pi) - math.pi
        front = self.sonar("sonar_front")
        along_row = self.wp % 2 == 1                     # odd waypoints end a pass down a gap
        if along_row and abs(err) < 0.5 and front is not None and front < ROW_END_SONAR:
            self.events.append((t, f"Row end detected by front ultrasonic at {front * 100:.0f} cm"))
            dist = 0.0
        if dist < 0.12:
            self.wp += 1
            if self.wp >= len(self.waypoints):
                self.state = "done"
                self.events.append((t, "Survey complete - all rows covered"))
                return 0.0, 0.0, False
            if not along_row:
                self.events.append((t, f"Entering row gap {self.wp // 2 + 1} of {len(GAP_Y)}"))
            return 0.0, 0.0, True
        w = max(-0.55, min(0.55, 1.6 * err))
        v = self.speed * max(0.0, math.cos(err)) ** 3 * min(1.0, dist / 0.25 + 0.3)
        if abs(err) > 0.6:
            v = 0.0                                       # turn on the spot first
        return v, w, True

    # -------------------------------------------------------------- one control tick
    def step(self):
        t = self.d.time - self.t0
        v, w, active = self._command()
        _, _, _, roll, pitch, _ = self.pose
        if self.state == "standing up":
            s = min(1.0, t / STAND_UP_S)
            self.gait.height = CROUCH + (STAND - CROUCH) * (3 * s * s - 2 * s * s * s)
        self.gait.com_shift = self.com_offset()
        targets = self.gait.foot_targets(CTRL_DT, v, w, roll, pitch, active)
        for leg, (fore, side) in LEGS.items():
            for j, q in zip(("abd", "hip", "knee"), leg_ik(*targets[leg], side)):
                self.d.ctrl[self.act[f"{leg}_{j}"]] = q
        for _ in range(self.substeps):
            mujoco.mj_step(self.m, self.d)
        self._sense(t + CTRL_DT)
        if self.state not in ("fallen",) and self.fallen:
            self.state = "fallen"
            self.events.append((t, "Robot fell over"))

    # -------------------------------------------------------------- simulated sensors
    def _sense(self, t):
        gx, gy, _ = self.d.site("gas_inlet").xpos
        a = CTRL_DT / 2.5                                 # SGP30 responds over ~2.5 s
        self._tvoc += a * (env_tvoc(gx, gy) - self._tvoc)
        b = CTRL_DT / 6.0                                 # PPD42 averages over a long window
        self._dust += b * (env_dust(gx, gy) - self._dust)
        x, y = self.d.qpos[0], self.d.qpos[1]
        if self._last_xy is not None:
            step = math.hypot(x - self._last_xy[0], y - self._last_xy[1])
            self.distance += step
            if not self.trail or math.hypot(x - self.trail[-1][0], y - self.trail[-1][1]) > 0.1:
                self.trail.append((x, y, self._tvoc))
        self._last_xy = (x, y)
        if round(t / CTRL_DT) % 10 == 0:                  # 10 Hz telemetry log
            tel = self.telemetry()
            self.log.append({"t": t, "x": x, "y": y, **tel})

    def telemetry(self):
        x, y, z, roll, pitch, yaw = self.pose
        tvoc = max(0.0, self._tvoc + self.rng.gauss(0, 2.5))
        eco2 = 400 + 1.55 * max(0.0, tvoc - 15)
        dust = max(0.0, self._dust + self.rng.gauss(0, 80))
        front, side = self.sonar("sonar_front"), self.sonar("sonar_side")
        torque = np.abs(self.d.actuator_force) / SERVO_TORQUE
        return {
            "tvoc_ppb": tvoc, "eco2_ppm": eco2,
            "air_level": "warmup" if self.state == "standing up" else
                         ("high" if tvoc >= 660 or eco2 >= 2000 else "moderate" if tvoc >= 220 or eco2 >= 1000 else "good"),
            "dust": dust, "dust_level": level(dust, 10000, 20000),
            "temp_c": env_temp(x, y) + self.rng.gauss(0, 0.03),
            "front_cm": None if front is None else front * 100,
            "side_cm": None if side is None else side * 100,
            "body_h": z, "roll": roll, "pitch": pitch, "yaw": yaw,
            "speed": float(np.linalg.norm(self.d.qvel[0:2])),
            "torque_peak": float(torque.max()), "torque_mean": float(torque.mean()),
            "knee_peak": float(max(torque[self.act[f"{leg}_knee"]] for leg in LEGS)),
        }

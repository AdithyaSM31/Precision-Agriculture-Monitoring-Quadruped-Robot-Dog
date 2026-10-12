"""Leg inverse kinematics and the trot gait generator.

Frames: body x forward, y left, z up. Each foot target is given relative to
its leg's abduction joint. Joint conventions match model.py: positive hip
swings the foot backward, knees bend to negative angles (knee behind the foot,
as on SpotMicro and Spot).
"""

import math

from model import HIP_X, HIP_Y, L0, L1, L2, LEGS


def wrap(a):
    return (a + math.pi) % (2 * math.pi) - math.pi


def leg_ik(px, py, pz, side):
    """Joint angles (abduction, hip, knee) that put the foot at (px, py, pz)."""
    d2 = py * py + pz * pz
    h = math.sqrt(max(d2 - L0 * L0, 1e-9))           # leg length projected on the y-z plane
    abd = wrap(math.atan2(pz, py) - math.atan2(-h, side * L0))
    r2 = px * px + h * h
    c = max(-1.0, min(1.0, (r2 - L1 * L1 - L2 * L2) / (2 * L1 * L2)))
    knee = -math.acos(c)
    hip = math.atan2(-px, h) - math.atan2(L2 * math.sin(knee), L1 + L2 * math.cos(knee))
    return abd, hip, knee


class Trot:
    """Diagonal-pair trot. Feet trace a flat stance stroke and a raised-cosine swing."""

    PHASE = {"FL": 0.0, "RR": 0.0, "FR": 0.5, "RL": 0.5}

    def __init__(self, height=0.180, step_height=0.035, freq=2.0, duty=0.5, level_gain=0.5):
        self.height = height
        self.step_height = step_height
        self.freq = freq
        self.duty = duty
        self.level_gain = level_gain
        self.phase = 0.0
        self.amp = 0.0          # 0 = feet planted, 1 = full stepping; ramps for smooth starts/stops
        # Body-frame (x, y) of the centre of mass. The knees-back legs put it
        # behind the body centre, so every foot is placed relative to it - a
        # diagonal support line through the body centre would tip the robot.
        self.com_shift = (0.0, 0.0)

    def foot_targets(self, dt, v, w, roll=0.0, pitch=0.0, active=True):
        """Advance the gait by dt and return {leg: (x, y, z)} foot targets.

        v: forward speed (m/s), w: yaw rate (rad/s). roll/pitch from the IMU
        feed a small levelling correction to each leg's height.
        """
        self.amp += (1.0 if active else -1.0) * dt / 0.4
        self.amp = min(1.0, max(0.0, self.amp))
        self.phase = (self.phase + self.freq * dt) % 1.0
        t_stance = self.duty / self.freq
        targets = {}
        for leg, (fore, side) in LEGS.items():
            fx, fy = fore * HIP_X, side * (HIP_Y + L0)        # foot's nominal spot under the body
            vx, vy = v - w * fy, w * fx                       # ground velocity seen at that foot
            sx, sy = vx * t_stance * self.amp, vy * t_stance * self.amp
            p = (self.phase + self.PHASE[leg]) % 1.0
            if p < self.duty:                                 # stance: foot slides back under the body
                u = p / self.duty
                dx, dy, dz = sx * (0.5 - u), sy * (0.5 - u), 0.0
            else:                                             # swing: lift and reach forward
                u = (p - self.duty) / (1 - self.duty)
                k = (1 - math.cos(math.pi * u)) / 2
                dx, dy = sx * (k - 0.5), sy * (k - 0.5)
                dz = self.step_height * self.amp * math.sin(math.pi * u)
            # levelling: a body tilted by (roll, pitch) moves this foot's hip by
            # (fy*roll - fx*pitch) vertically; cancel a fraction of that.
            level = self.level_gain * (fy * roll - fx * pitch)
            cx, cy = self.com_shift
            targets[leg] = (dx + cx, side * L0 + dy + cy, -self.height + dz + max(-0.02, min(0.02, level)))
        return targets


def stance_angles(height):
    return {leg: leg_ik(0.0, side * L0, -height, side) for leg, (_, side) in LEGS.items()}

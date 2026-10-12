"""Gait stability sweep: runs the trot headless and reports falls, tilt and progress."""

import itertools
import math
import sys

import mujoco
import numpy as np

from agribot import CTRL_DT, AgriBot
from gait import leg_ik
from model import LEGS


def trial(v, w=0.0, secs=10.0, freq=2.0, duty=0.5, sh=0.035, level=0.5, kp=None, kv=None, height=None):
    bot = AgriBot()
    if kp is not None:
        for a in range(bot.m.nu):
            bot.m.actuator_gainprm[a, 0] = kp
            bot.m.actuator_biasprm[a, 1] = -kp
    if kv is not None:
        bot.m.actuator_biasprm[:, 2] = -kv
    for _ in range(250):
        bot.step()
    g = bot.gait
    g.freq, g.duty, g.step_height, g.level_gain = freq, duty, sh, level
    if height:
        g.height = height
    x0, y0 = bot.pose[0:2]
    tilt = peak = 0.0
    sat = n = 0
    for _ in range(int(secs / CTRL_DT)):
        _, _, _, roll, pitch, _ = bot.pose
        g.com_shift = bot.com_offset()
        tg = g.foot_targets(CTRL_DT, v, w, roll, pitch, True)
        for leg, (_, s) in LEGS.items():
            for j, q in zip(("abd", "hip", "knee"), leg_ik(*tg[leg], s)):
                bot.d.ctrl[bot.act[f"{leg}_{j}"]] = q
        for _ in range(bot.substeps):
            mujoco.mj_step(bot.m, bot.d)
        _, _, _, r, p, _ = bot.pose
        f = np.abs(bot.d.actuator_force)
        tilt, peak = max(tilt, abs(r), abs(p)), max(peak, f.max())
        sat += int((f > 0.98).any()); n += 1
        if bot.fallen:
            break
    x, y, z, r, p, yaw = bot.pose
    return dict(fallen=bot.fallen, t=bot.d.time - 2.5, dx=x - x0, dy=y - y0, yaw=math.degrees(yaw),
                tilt=math.degrees(tilt), peak=peak, sat=sat / max(n, 1))


def show(label, r):
    print(f"{label:44s} {'FELL' if r['fallen'] else 'ok  '} t={r['t']:4.1f}s dx={r['dx']:+.2f} dy={r['dy']:+.2f} "
          f"yaw={r['yaw']:+6.1f} tilt={r['tilt']:4.1f}deg peak={r['peak']:.2f}Nm sat={r['sat'] * 100:3.0f}%", flush=True)


if __name__ == "__main__":
    v = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
    for freq, duty, kp, level in itertools.product((2.0, 2.5, 3.0), (0.5, 0.6), (15.0, 30.0), (0.0, 0.5)):
        show(f"v={v} f={freq} duty={duty} kp={kp} level={level}",
             trial(v, freq=freq, duty=duty, kp=kp, level=level, sh=0.03, secs=8))

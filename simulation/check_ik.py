"""Checks gait.leg_ik against MuJoCo's own forward kinematics.

Sets the joints to the IK solution, lets MuJoCo place the foot, and compares
with the target - across the whole working volume of every leg.
"""

import itertools

import mujoco
import numpy as np

from gait import leg_ik
from model import HIP_X, HIP_Y, LEGS, L0, build_xml

m = mujoco.MjModel.from_xml_string(build_xml())
d = mujoco.MjData(m)
worst, n = 0.0, 0
for leg, (fore, side) in LEGS.items():
    abd_q = m.jnt_qposadr[m.joint(f"{leg}_abd").id]
    shoulder = np.array([fore * HIP_X, side * HIP_Y, 0.0])
    for x, dy, z in itertools.product(np.linspace(-0.07, 0.07, 8), np.linspace(-0.03, 0.03, 5),
                                      np.linspace(-0.21, -0.10, 8)):
        target = np.array([x, side * L0 + dy, z])
        a, h, k = leg_ik(*target, side)
        d.qpos[:] = 0
        d.qpos[3] = 1.0                       # torso at origin, identity orientation
        d.qpos[abd_q:abd_q + 3] = (a, h, k)
        mujoco.mj_kinematics(m, d)
        foot = d.site(f"{leg}_foot").xpos - d.body("torso").xpos
        err = np.linalg.norm(foot - (shoulder + target))
        worst, n = max(worst, err), n + 1
print(f"{n} targets across 4 legs - worst foot position error {worst * 1000:.4f} mm")
assert worst < 1e-6, "IK disagrees with MuJoCo forward kinematics"

"""Builds the MuJoCo model: the AgriBot quadruped in a tomato field.

Robot dimensions are the ones measured from the printed SpotMicro chassis:
hip spacing 140 x 78 mm, 60 mm shoulder offset, 111 mm femur, 125 mm tibia.
Every joint is driven by a position servo limited to the MG996R's torque.
"""

import math
import random

# ------------------------------------------------------------------ robot geometry (m, kg)
HIP_X, HIP_Y = 0.070, 0.039        # abduction joints: 140 x 78 mm spacing
L0, L1, L2 = 0.060, 0.111, 0.125   # shoulder offset, femur, tibia
FOOT_R = 0.013
LEGS = {"FL": (1, 1), "FR": (1, -1), "RL": (-1, 1), "RR": (-1, -1)}  # (fore, side)

SERVO_TORQUE = 1.0   # N*m - MG996R is 0.92 (4.8 V) to 1.08 (6 V) at stall
SERVO_KP = 15.0      # N*m/rad - full torque at ~4 deg of position error
SERVO_KV = 0.15      # N*m*s/rad

# ------------------------------------------------------------------ field layout (m)
ROW_Y = (-1.05, -0.35, 0.35, 1.05)   # crop rows run along x
ROW_X = (-2.0, 2.0)
PLANT_SPACING = 0.32
FIELD = (3.2, 1.9)                   # hedge sits at +-x, +-y
DISEASE_CENTRE = (0.8, 0.0)          # stressed plants - and the VOC source
DISEASE_RADIUS = 0.55


def _v(*xs):
    return " ".join(f"{x:.4f}" for x in xs)


def _leg(name, fore, side):
    s = side
    return f"""
      <body name="{name}_shoulder" pos="{_v(fore * HIP_X, s * HIP_Y, 0)}">
        <joint name="{name}_abd" class="abd"/>
        <geom class="robot" type="box" pos="{_v(0, s * 0.032, 0)}" size="0.030 0.030 0.026" material="black" mass="0.08"/>
        <geom class="deco" type="cylinder" pos="{_v(0, s * 0.063, 0)}" zaxis="0 1 0" size="0.016 0.004" material="steel"/>
        <body name="{name}_thigh" pos="{_v(0, s * L0, 0)}">
          <joint name="{name}_hip" class="hip"/>
          <geom class="robot" type="box" pos="{_v(0, s * 0.012, -L1 / 2)}" size="0.020 0.011 {L1 / 2 + 0.01:.4f}" material="yellow" mass="0.08"/>
          <geom class="deco" type="cylinder" pos="{_v(0, s * 0.026, -L1)}" zaxis="0 1 0" size="0.015 0.004" material="steel"/>
          <body name="{name}_shank" pos="{_v(0, 0, -L1)}">
            <joint name="{name}_knee" class="knee"/>
            <geom class="robot" type="capsule" fromto="{_v(0, 0, 0, 0, 0, -L2 + 0.01)}" size="0.010" material="black" mass="0.03"/>
            <geom name="{name}_foot" class="foot" type="sphere" pos="{_v(0, 0, -L2)}" size="{FOOT_R}" mass="0.005"/>
            <site name="{name}_foot" pos="{_v(0, 0, -L2)}" size="0.005"/>
          </body>
        </body>
      </body>"""


def robot_xml():
    legs = "".join(_leg(n, f, s) for n, (f, s) in LEGS.items())
    return f"""
    <body name="torso" pos="-2.55 -0.70 0.115">
      <freejoint name="root"/>
      <!-- chassis shell, top cover and sensor deck (abduction servos inside: 0.55 kg total) -->
      <geom name="chassis" class="robot" type="box" size="0.120 0.050 0.030" material="yellow" mass="0.40"/>
      <geom class="robot" type="box" pos="0 0 0.034" size="0.105 0.046 0.006" material="black" mass="0.06"/>
      <geom class="deco" type="box" pos="0.128 0 0.005" size="0.010 0.048 0.026" material="black" mass="0.01"/>
      <!-- face: the two HC-SR04 'eyes', as on the real SpotMicro head -->
      <geom class="deco" type="cylinder" pos="0.139 0.020 0.008" zaxis="1 0 0" size="0.008 0.004" material="steel" mass="0.002"/>
      <geom class="deco" type="cylinder" pos="0.139 -0.020 0.008" zaxis="1 0 0" size="0.008 0.004" material="steel" mass="0.002"/>
      <!-- ESP32-CAM on the nose, SGP30 and PPD42 on the deck, XIAO with its OLED -->
      <geom class="deco" type="box" pos="0.112 0 0.050" size="0.012 0.020 0.010" material="pcb" mass="0.01"/>
      <geom class="deco" type="cylinder" pos="0.125 0 0.052" zaxis="1 0 0" size="0.006 0.003" material="lens" mass="0.001"/>
      <geom class="deco" type="box" pos="0.040 0.022 0.052" size="0.012 0.012 0.012" material="purple" mass="0.005"/>
      <geom class="deco" type="box" pos="-0.020 -0.018 0.062" size="0.030 0.022 0.022" material="sensorgrey" mass="0.02"/>
      <geom class="deco" type="box" pos="-0.075 0.015 0.046" size="0.022 0.016 0.006" material="pcb" mass="0.01"/>
      <geom class="deco" type="box" pos="-0.075 0.015 0.0525" size="0.014 0.010 0.0005" material="oled" mass="0"/>
      <site name="imu" pos="0 0 0"/>
      <site name="sonar_front" pos="0.142 0 0.008" zaxis="1 0 0" size="0.004"/>
      <site name="sonar_side" pos="0 -0.052 0.0" zaxis="0 -1 0" size="0.004"/>
      <site name="gas_inlet" pos="0.040 0.022 0.066" size="0.004"/>
      <camera name="onboard" pos="0.132 0 0.052" xyaxes="0 -1 0 0.26 0 0.966" fovy="62"/>
      <camera name="chase" pos="-0.75 -0.55 0.40" xyaxes="0.59 -0.81 0 0.30 0.22 0.93" mode="trackcom" fovy="50"/>
      {legs}
    </body>"""


def _plant(rng, x, y, sick):
    h = rng.uniform(0.24, 0.38)
    parts = [f'<geom class="plant" type="capsule" fromto="{_v(x, y, 0.0, x, y, h)}" size="0.0075" material="stem"/>']
    leaf = "leafsick" if sick else "leaf"
    n = rng.randint(5, 7)
    for i in range(n):
        z = h * (0.30 + 0.62 * i / (n - 1))
        a = rng.uniform(0, 2 * math.pi) + i * 2.4
        reach = 0.055 * (1.15 - 0.45 * i / n)
        lx, ly = x + reach * math.cos(a), y + reach * math.sin(a)
        mat = leaf if (sick and rng.random() < 0.75) or (not sick and rng.random() < 0.97) else "leafsick"
        parts.append(
            f'<geom class="plant" type="ellipsoid" pos="{_v(lx, ly, z)}" size="{_v(reach * 1.1, 0.022, 0.006)}" '
            f'euler="{_v(rng.uniform(-0.35, 0.35), rng.uniform(-0.5, -0.15), a)}" material="{mat}"/>')
    if not sick:
        for _ in range(rng.randint(0, 3)):
            a = rng.uniform(0, 2 * math.pi)
            ripe = rng.random() < 0.6
            parts.append(
                f'<geom class="plant" type="sphere" pos="{_v(x + 0.03 * math.cos(a), y + 0.03 * math.sin(a), rng.uniform(0.12, h * 0.75))}" '
                f'size="{rng.uniform(0.014, 0.02):.4f}" material="{"fruit" if ripe else "fruitgreen"}"/>')
    return "".join(parts)


def field_xml(seed=7):
    rng = random.Random(seed)
    parts = []
    fx, fy = FIELD
    # tilled soil and the raised beds under each row
    parts.append(f'<geom class="decoworld" type="box" pos="0 0 0.0006" size="{_v(fx, fy, 0.0006)}" material="soil"/>')
    for y in ROW_Y:
        parts.append(f'<geom class="decoworld" type="box" pos="{_v(0, y, 0.012)}" size="{_v(ROW_X[1] + 0.25, 0.13, 0.012)}" material="bed"/>')
        parts.append(f'<geom class="decoworld" type="capsule" fromto="{_v(ROW_X[0] - 0.2, y - 0.07, 0.027, ROW_X[1] + 0.2, y - 0.07, 0.027)}" size="0.006" material="drip"/>')
        n = int((ROW_X[1] - ROW_X[0]) / PLANT_SPACING) + 1
        for i in range(n):
            x = ROW_X[0] + i * PLANT_SPACING + rng.uniform(-0.03, 0.03)
            yy = y + rng.uniform(-0.02, 0.02)
            sick = math.hypot(x - DISEASE_CENTRE[0], yy - DISEASE_CENTRE[1]) < DISEASE_RADIUS + 0.25 * rng.random()
            parts.append(_plant(rng, x, yy, sick))
    # hedge around the field: solid, so the front ultrasonic sees the row end
    t, hh = 0.12, 0.36
    for x in (-fx, fx):
        parts.append(f'<geom class="hedge" type="box" pos="{_v(x, 0, hh / 2)}" size="{_v(t, fy + t, hh / 2)}"/>')
    for y in (-fy, fy):
        parts.append(f'<geom class="hedge" type="box" pos="{_v(0, y, hh / 2)}" size="{_v(fx - t, t, hh / 2)}"/>')
    # gate posts and a water tank at the field edge
    parts.append(f'<geom class="decoworld" type="cylinder" pos="{_v(-fx - 0.6, 1.2, 0.35)}" size="0.32 0.35" material="tank"/>')
    for y in (-0.35, 0.35):
        parts.append(f'<geom class="decoworld" type="box" pos="{_v(-fx - 0.05, y, 0.25)}" size="0.04 0.04 0.25" material="wood"/>')
    return "".join(parts)


def build_xml(seed=7):
    return f"""<mujoco model="agribot_field">
  <compiler angle="radian" autolimits="true"/>
  <option timestep="0.002" integrator="implicitfast"/>
  <size memory="64M"/>
  <visual>
    <headlight ambient="0.32 0.32 0.32" diffuse="0.55 0.55 0.55" specular="0.05 0.05 0.05"/>
    <map znear="0.01" zfar="50" shadowclip="5"/>
    <quality shadowsize="4096" offsamples="8"/>
    <global offwidth="1600" offheight="900" azimuth="150" elevation="-24"/>
    <rgba haze="0.75 0.84 0.95 1"/>
  </visual>
  <asset>
    <texture name="sky" type="skybox" builtin="gradient" rgb1="0.50 0.68 0.90" rgb2="0.93 0.96 1" width="512" height="512"/>
    <texture name="grass" type="2d" builtin="flat" rgb1="0.33 0.50 0.20" mark="random" markrgb="0.42 0.60 0.26" random="0.35" width="512" height="512"/>
    <texture name="soil" type="2d" builtin="flat" rgb1="0.40 0.29 0.19" mark="random" markrgb="0.30 0.21 0.13" random="0.30" width="512" height="512"/>
    <texture name="bed" type="2d" builtin="flat" rgb1="0.31 0.22 0.14" mark="random" markrgb="0.24 0.16 0.10" random="0.30" width="256" height="256"/>
    <texture name="hedge" type="2d" builtin="flat" rgb1="0.16 0.33 0.12" mark="random" markrgb="0.24 0.44 0.16" random="0.45" width="256" height="256"/>
    <material name="grass" texture="grass" texrepeat="30 30"/>
    <material name="soil" texture="soil" texrepeat="14 9"/>
    <material name="bed" texture="bed" texrepeat="12 1"/>
    <material name="hedge" texture="hedge" texrepeat="10 2"/>
    <material name="stem" rgba="0.28 0.47 0.18 1"/>
    <material name="leaf" rgba="0.20 0.52 0.16 1" specular="0.2"/>
    <material name="leafsick" rgba="0.70 0.62 0.20 1"/>
    <material name="fruit" rgba="0.86 0.15 0.10 1" specular="0.5" shininess="0.6"/>
    <material name="fruitgreen" rgba="0.45 0.66 0.22 1" specular="0.4"/>
    <material name="drip" rgba="0.08 0.08 0.08 1"/>
    <material name="tank" rgba="0.25 0.42 0.62 1" specular="0.3"/>
    <material name="wood" rgba="0.45 0.31 0.18 1"/>
    <material name="yellow" rgba="0.96 0.76 0.10 1" specular="0.35" shininess="0.5"/>
    <material name="black" rgba="0.10 0.10 0.11 1" specular="0.3"/>
    <material name="steel" rgba="0.72 0.74 0.76 1" specular="0.7" shininess="0.8"/>
    <material name="pcb" rgba="0.07 0.30 0.20 1"/>
    <material name="lens" rgba="0.02 0.02 0.03 1" specular="1" shininess="1"/>
    <material name="purple" rgba="0.42 0.22 0.62 1"/>
    <material name="sensorgrey" rgba="0.80 0.80 0.78 1"/>
    <material name="oled" rgba="0.15 0.55 0.95 1" emission="0.6"/>
    <material name="rubber" rgba="0.05 0.05 0.05 1"/>
  </asset>
  <default>
    <default class="robot">
      <geom contype="2" conaffinity="1" condim="3" friction="0.9 0.02 0.002"/>
      <default class="foot">
        <geom material="rubber" friction="1.2 0.02 0.002" solref="0.006 1" solimp="0.9 0.98 0.001"/>
      </default>
      <default class="deco"><geom contype="0" conaffinity="0" group="2"/></default>
      <default class="abd"><joint axis="1 0 0" range="-0.6 0.6" damping="0.04" armature="0.005" frictionloss="0.01"/></default>
      <default class="hip"><joint axis="0 1 0" range="-1.7 1.7" damping="0.04" armature="0.005" frictionloss="0.01"/></default>
      <default class="knee"><joint axis="0 1 0" range="-2.75 0" damping="0.04" armature="0.005" frictionloss="0.01"/></default>
      <default class="servo"><position kp="{SERVO_KP}" kv="{SERVO_KV}" forcerange="-{SERVO_TORQUE} {SERVO_TORQUE}"/></default>
    </default>
    <default class="plant"><geom contype="0" conaffinity="0" group="1" mass="0"/></default>
    <default class="decoworld"><geom contype="0" conaffinity="0" group="1" mass="0"/></default>
    <default class="hedge"><geom contype="1" conaffinity="2" material="hedge"/></default>
  </default>
  <worldbody>
    <light name="sun" directional="true" pos="3 -4 8" dir="-0.35 0.45 -1" diffuse="0.85 0.82 0.74" specular="0.2 0.2 0.2" castshadow="true"/>
    <geom name="ground" type="plane" size="14 14 0.1" material="grass" contype="1" conaffinity="2" friction="1.0 0.02 0.002"/>
    {field_xml(seed)}
    {robot_xml()}
  </worldbody>
  <actuator>
    {"".join(f'<position name="{n}_{j}" class="servo" joint="{n}_{j}"/>' for n in LEGS for j in ("abd", "hip", "knee"))}
  </actuator>
  <sensor>
    <framequat name="imu_quat" objtype="site" objname="imu"/>
    <gyro name="imu_gyro" site="imu"/>
    <accelerometer name="imu_acc" site="imu"/>
    <rangefinder name="sonar_front" site="sonar_front"/>
    <rangefinder name="sonar_side" site="sonar_side"/>
  </sensor>
</mujoco>"""


if __name__ == "__main__":
    import mujoco
    xml = build_xml()
    m = mujoco.MjModel.from_xml_string(xml)
    print(f"bodies {m.nbody}  geoms {m.ngeom}  joints {m.njnt}  actuators {m.nu}")
    import numpy as np
    torso = m.body("torso").id
    robot_mass = sum(m.body_mass[b] for b in range(m.nbody) if b == torso or m.body_rootid[b] == torso)
    print(f"robot mass {robot_mass:.3f} kg")

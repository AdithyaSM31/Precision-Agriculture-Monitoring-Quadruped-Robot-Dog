# Precision Agriculture Monitoring Quadruped Robot Dog

A 12-DOF printed quadruped that walks crop rows and logs air quality on the move,
with an NVIDIA Jetson Orin Nano carrying onboard inference.

B.Tech CSE (AI & Robotics), 2025–26 · Adithya · Rachit · Siddhesh

---

## Status

| Module | State |
|---|---|
| Mechanical chassis — 35 printed parts | **Complete** |
| Custom mounts and brackets (4 team-designed parts) | **Complete** |
| Gas + dust sensing — SGP30, PPD42 | Procured and characterised |
| Kinematics and gait — closed-form IK | **Complete, validated** |
| Quasi-static physics simulator | **Complete** |
| Gazebo / ROS 2 package | Partial — see below |
| Assembly and walking trials | Pending |

The Gazebo package builds, spawns, activates its controllers and publishes live
sensor topics. It does **not** yet balance free-standing or sustain locomotion;
that is controller tuning, documented in
[`ros2_ws/src/spotmicro_ag_sim/README.md`](ros2_ws/src/spotmicro_ag_sim/README.md).

---

## Measured specifications

Every figure below was measured from the printed geometry or taken from vendor
documentation — none are estimates.

| Parameter | Value | Source |
|---|---|---|
| Hip spacing (longitudinal × lateral) | 140 × 78 mm | Belly-wall span; Ø16.3 mm F625zz bearing seats |
| Femur / tibia | 111 / 125 mm | Printed link geometry |
| Total mass | 1.7574 kg | Print volumes at 40 % infill + component weights |
| Actuation | 12 × MG996R | 11 kg·cm @ 6 V rated |
| Compute | Jetson Orin Nano 8 GB | 9–19 V input, externally deck-mounted |
| Battery | 3S LiPo 2200 mAh 30C | 66 A continuous vs ~11 A power-on spike |
| Ride height | 150 mm | |

### Joint torque — the binding constraint

| Condition | Foot load | Knee torque | vs MG996R (11 kg·cm) |
|---|---|---|---|
| Four-foot stance | 0.44 kgf | 4.0 kg·cm | 36 % |
| Four-foot, stride offset | 0.44 kgf | 5.7 kg·cm | 52 % |
| Three-foot crawl support | 0.59 kgf | **7.65 kg·cm** | 70 % — saturates clone units |

The knee is the critical joint throughout; hip torque approaches zero when the
foot sits beneath the hip. Simulated peak (4.8 kg·cm) agrees with the analytical
prediction, validating the model against independent hand calculation.

---

## Repository layout

```
3D_PRINT_READY/        35 print-ready STLs, quantities in filenames
  01_BODY/             chassis shell, side plates, ultrasonic mounts
  02_LEGS_MG996R/      all four legs
  03_JETSON_MOUNT/     modified cover, Jetson deck, sensor brackets
custom_parts/          parametric generators for the team-designed parts
ros2_ws/src/           spotmicro_ag_sim — ROS 2 Humble + Gazebo Classic package
quadruped-sim.html     browser gait simulator (open directly, no install)
wiring-map.html        power chain, 40-pin map, level shifting, bring-up order
```

---

## Running the simulators

**Browser simulator** — no install. Open `quadruped-sim.html` in any WebGL browser.
Closed-form IK, live centre of mass, support polygon, foot-load distribution and
per-joint torque against an adjustable servo limit.

**Gazebo** — ROS 2 Humble and Gazebo Classic 11:

```bash
cd ros2_ws && colcon build --symlink-install && source install/setup.bash
ros2 launch spotmicro_ag_sim gazebo.launch.py
```

On WSL, export `ROS_LOCALHOST_ONLY=1` first — Fast-DDS cannot lock its
shared-memory files there and discovery fails intermittently without it.

---

## Team-designed parts

The chassis is SpotMicro (see attribution). These four parts were designed for
this project to carry a payload the original never anticipated:

| Part | Purpose |
|---|---|
| `jetson_deck` | External deck carrying the Orin Nano in open air |
| `T_cover_jetson_mg` | Modified top cover — CSI, harness and vent slots |
| `ppd42_bracket` | Holds the dust sensor upright for convection airflow |
| `sgp30_bracket` | Raises the gas sensor 22 mm into clear air |

The Orin Nano Dev Kit is 103 × 90.5 × 34.7 mm and dissipates 7–25 W. The original
internal bay is 107 × 95 mm and must also hold the battery, PCA9685 and two
regulators — and PLA softens around 60 °C. External mounting resolves both.

All four are watertight manifolds with zero bad edges, verified at **0.0000 cm³**
interference against the deck and the Jetson envelope. Regenerate with
`python custom_parts/make_jetson_parts.py` and `make_sensor_brackets.py`.

---

## Attribution

The base chassis is **SpotMicro** by Thingiverse user **KDY0523**
([thing:3445283](https://www.thingiverse.com/thing:3445283)), licensed
**Creative Commons — Attribution**. The STLs under `3D_PRINT_READY/01_BODY/` and
`02_LEGS_MG996R/` are that work, redistributed under those terms.

Parts under `3D_PRINT_READY/03_JETSON_MOUNT/` and `custom_parts/`, the ROS 2
package, both simulators and all documentation are original to this project.

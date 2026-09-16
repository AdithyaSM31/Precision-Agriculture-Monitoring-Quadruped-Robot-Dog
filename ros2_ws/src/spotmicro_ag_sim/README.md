# spotmicro_ag_sim — Gazebo simulation

ROS 2 **Humble** + **Gazebo Classic 11**. Built and test-run under WSL Ubuntu 22.04.

## Status, honestly

| Part | State |
|---|---|
| Package builds | **Working** |
| URDF / mass model | **Working** — 21 links, valid tree, 1.7574 kg |
| Crop-field world | **Working** — 68 plants, textured soil, preset camera |
| Robot visuals | **Working** — Jetson deck, Orin Nano, both sensor brackets, servo blocks |
| IMU (`/imu/data`) | **Working** — verified publishing live quaternions |
| Controllers load + activate | **Working** — zero errors |
| Chassis stable under gravity | **Working** — x,y pinned at ~0, roll −0.003 over 20 s |
| **Holding a stance under servo control** | **Not working** — inverts within ~20 s |

The robot spawns, the controllers activate, sensors publish, and the body is
stable as a rigid body. What is not solved is the closed-loop leg control: the
PD servo model does not hold the robot upright for more than a few seconds.

**For a demonstration, use the browser simulator.** This package is worth showing
as evidence of ROS 2 integration, a correct URDF with a measured mass model, and
live sensor topics — not as a walking demo.

## What is modelled from the real robot

| | Value | Source |
|---|---|---|
| Hip spacing | 140 × 78 mm | belly-wall span; F625zz bearing seats |
| Femur / tibia | 111 / 125 mm | printed part geometry |
| Total mass | **1.7574 kg** | print volumes at 40 % infill + component weights |
| Joint effort limit | 1.08 N·m | MG996R 11 kg·cm @ 6 V |
| Joint velocity limit | 8.0 rad/s | 0.13 s/60° @ 6 V |

## Build and run

```bash
export ROS_LOCALHOST_ONLY=1          # WSL: Fast-DDS shared memory cannot lock files
rm -f /dev/shm/fastrtps_* /dev/shm/sem.fastrtps_*
source /opt/ros/humble/setup.bash
cd ros2_ws && colcon build --symlink-install && source install/setup.bash
ros2 launch spotmicro_ag_sim gazebo.launch.py            # GUI
ros2 launch spotmicro_ag_sim gazebo.launch.py gui:=false # headless
ros2 launch spotmicro_ag_sim rviz.launch.py              # second terminal
```

`gait:=` accepts `crawl`, `trot`, `stand`. Regenerate the URDF with
`python3 gen_model.py` after editing geometry or masses.

## The control problem, and what to try next

An RC servo is a position device, which invites a position command interface.
**That does not work here.** `gazebo_ros2_control` drives a position interface with
`SetPosition`, which teleports the link every cycle. On a fixed-base arm that is
fine; on a floating base with feet in contact it injects energy without bound —
measured result was the robot 493 m from the origin. Three separate sources of a
step change were removed (spawn-height mismatch, the stance step at controller
activation, and `initial_value` at hardware init) and it still launched. The
interface itself is the problem.

So the joints use an **effort** interface with the servo modelled explicitly:

```
tau = clamp(KP*(target - actual) - KD*velocity, ±1.08 N·m)
GAINS = {abd: (60, 2.0), hip: (30, 1.2), knee: (30, 1.2)}
```

Abduction is deliberately stiffest: the foot sits 60 mm outboard of its axis, so
droop there grows the lateral moment, which grows the droop — at soft gains the
legs splay until the body drops.

This stands briefly and then inverts. Things to try, in order:

1. **Run the PD inside ros2_control, not in a Python node.** The loop currently
   runs at 200 Hz in `gait_controller.py` against a 500 Hz controller manager and
   1000 Hz physics. `pid_controller` from `ros2_controllers` is installed and
   would close the loop at the manager rate.
2. **Add an integral term with anti-windup.** The loop is pure PD and leaves a
   steady-state droop; at KP=8 the body sagged to 0.103 m against a 0.150 m target.
3. **Gravity feed-forward.** Add the static torque from the quasi-static model as
   a feed-forward term so the PD only has to correct the error.
4. **Widen the stance** (raise `L0`, or command a standing abduction angle) for
   more roll margin.
5. Contact `<kp>` is 2e5. Too stiff chatters, too soft sinks; 1e5–1e6 is the range.

## Things that were fixed getting this far

Each of these fails silently or with a misleading symptom:

- `Command(['xacro ', path])` splits a path containing spaces — the workspace
  path must be quoted, since "Final Year Proj New" has them.
- `gazebo_ros/gazebo.launch.py` does not load `libgazebo_ros_factory.so`, so
  `/spawn_entity` is never advertised. gzserver is launched directly with the
  plugin as an **absolute path**, because `GAZEBO_PLUGIN_PATH` is empty.
- `model://sun` stalls gzserver when `GAZEBO_MODEL_PATH` is unset — the world
  defines the sun and ground inline instead.
- Python files edited on the Windows mount get CRLF; the shebang resolves to
  `python3\r` and the node dies with exit code 127.
- **`--` is illegal inside an XML comment** and silently breaks URDF parsing.
- **XML comments break `gazebo_ros2_control`.** It forwards the robot description
  as a `--param` override, and the parser fails on it. `gen_model.py` therefore
  strips the XML declaration and all comments from the emitted URDF; the
  documentation lives in `gen_model.py` instead.
- A link with only inertia and no geometry is **lumped into its parent** during
  URDF→SDF conversion, taking any attached sensor with it. That is why
  `/imu/data` never appeared; the IMU now sits on `base_link`.
- `Command()` output is YAML-parsed by launch and dies on the first colon — it
  needs `ParameterValue(..., value_type=str)`.
- `spawn_entity.py` takes **`-timeout`**, one dash. `--timeout` exits with code 2.
- `gz model` defaults to `world[default]`; this world is `crop_field`, so every
  pose query silently returned nothing and made a working sim look dead.
- Controllers **cannot be activated while Gazebo is paused** — the controller
  manager is ticked by the world update, so the switch times out.

## Layout

```
gen_model.py                generates the URDF and controllers.yaml
urdf/spotmicro.urdf.xacro   generated; edit gen_model.py instead
config/controllers.yaml     generated
config/view.rviz            RViz layout
launch/gazebo.launch.py     gzserver, spawn, controllers, gait node
launch/rviz.launch.py       RViz on the running sim
worlds/crop_field.world     self-contained ground, sun and 68 crop plants
scripts/gait_controller.py  IK, gait, servo model
```

The IK in `gait_controller.py` is verified against forward kinematics to machine
precision (worst round-trip error 5.7e-17 m across the workspace). That test
caught a real bug: the solver picked the wrong `acos` branch and placed the foot
above the hip instead of on the ground.

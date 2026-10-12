# AgriBot field simulation (MuJoCo)

A physics simulation of the AgriBot quadruped surveying a tomato field on its
own: it stands up, trots down each gap between the crop rows, uses its front
ultrasonic to detect the end of each row, turns in the headland, and logs gas,
dust and temperature as it goes. A coloured trail marks where the gas readings
rose - over a patch of diseased plants.

```
run_sim.bat                 double-click: opens the 3D simulation (installs MuJoCo on first run)
run_sim.bat --speedup 2     twice real time
```

Mouse in the window: left-drag rotates, right-drag pans, scroll zooms. The
camera follows the robot. The survey takes about 130 s at real time.

To show the simulated robot's readings on the live dashboard too, start the
dashboard (`agri_monitor/dashboard/run.bat`), then:

```
run_sim.bat --dashboard http://localhost:5000
```

## What is physically modelled

| | Value | Source |
|---|---|---|
| Hip spacing | 140 × 78 mm | measured from the printed chassis |
| Shoulder offset / femur / tibia | 60 / 111 / 125 mm | measured |
| Mass | 1.35 kg | prints + 12 servos + electronics, no Jetson or battery |
| Servos | position-controlled, **torque-limited to 1.0 N·m** | MG996R stall: 0.92 N·m at 4.8 V, 1.08 N·m at 6 V |
| Foot contact | rubber, friction 1.2 | |
| Physics | MuJoCo 3, 2 ms step, implicit integrator | |

The leg inverse kinematics are checked against MuJoCo's own forward kinematics
(`python check_ik.py`): 1,280 foot targets, worst error 0.0000 mm.

## Results (`python record.py --sweep` regenerates all of these)

| Metric | Result |
|---|---|
| Survey outcome | All 3 row gaps covered, no falls |
| Distance / time | 16.7 m in 129 s (mean 0.13 m/s) |
| Body tilt | ≤ 2.7° throughout |
| Servo load | median peak 63 % of stall; at the limit 1.3 % of the time |
| Row ends detected by ultrasonic | 3 of 3, at 55 cm from the hedge |
| TVOC peak | 535 ppb, 0.2 m from the true source (SGP30 response lag) |

**Trot speed is limited by the MG996R.** Below 0.18 m/s the robot tracks the
commanded speed to within 7 %. At 0.20 m/s the servos sit at their torque limit
68 % of the time and tilt grows to 12°; at 0.22 m/s it falls. The survey runs at
0.14 m/s for margin. See `results/speed_sweep.png`.

**Centre of mass correction.** All four knees point backward, as on SpotMicro,
which puts the robot's centre of mass 12 mm behind the body centre. With
footholds centred on the body, the trot tipped the robot backward within 1-3 s
in every gait setting tried. Placing the feet around the measured centre of
mass made it stable - the same correction applies to the physical robot.

`results/` contains the video (`agribot_field_survey.mp4`), key frames, the
survey map, sensor time series, locomotion plots and `summary.json`.

## What is simulated rather than measured

- Gas, dust and temperature come from modelled fields: a VOC plume over the
  diseased plants (stressed plants do emit VOCs), dust over the dry headland, a
  mild temperature gradient. The sensor dynamics are modelled (SGP30 ~2.5 s
  response, PPD42 long averaging) but the values are not field data.
- The ultrasonics are exact ray casts; real HC-SR04s have a ~15° beam and miss
  thin stems.
- The servo model is an ideal torque-limited position loop; real MG996Rs add a
  deadband and gear backlash.
- Plants are visual and sensor targets only; the robot cannot brush against them.

## Files

```
model.py      robot + field (MJCF built in Python from the measured dimensions)
gait.py       leg inverse kinematics and the trot generator
agribot.py    controller, centre-of-mass correction, simulated sensors, survey mission
run.py        interactive 3D viewer with live sensor panels and onboard camera view
record.py     headless run: video, plots, summary, speed sweep
hud.py        overlay text, trail colours, dashboard bridge
check_ik.py   inverse kinematics vs MuJoCo forward kinematics
tune.py       gait stability sweep used to choose 2 Hz trot, 60 % duty
```

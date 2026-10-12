"""AgriBot field simulation - interactive viewer.

    python run.py                      real time
    python run.py --speedup 2          twice real time
    python run.py --dashboard http://localhost:5000   also feed the live dashboard

Mouse: left-drag rotates, right-drag pans, scroll zooms. The camera follows
the robot. Close the window to stop.
"""

import argparse
import time

import mujoco
import mujoco.viewer
import numpy as np

from agribot import CTRL_DT, AgriBot
from hud import DashboardBridge, hud_lines, tvoc_rgba

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--speedup", type=float, default=1.0, help="simulation speed relative to real time")
ap.add_argument("--speed", type=float, default=0.14, help="walking speed, m/s (servo limit ~0.16)")
ap.add_argument("--dashboard", default="", help="dashboard URL to post simulated readings to")
ap.add_argument("--no-camera", action="store_true", help="hide the onboard camera inset")
ap.add_argument("--max-seconds", type=float, default=0, help="close automatically after this many wall seconds")
args = ap.parse_args()

bot = AgriBot(speed=args.speed)
m, d = bot.m, bot.d
bridge = DashboardBridge(args.dashboard) if args.dashboard else None
cam_renderer = None if args.no_camera else mujoco.Renderer(m, 240, 320)
cam_opt = mujoco.MjvOption()
cam_opt.flags[mujoco.mjtVisFlag.mjVIS_RANGEFINDER] = 0   # keep sonar beams out of the camera view
cam_image = None
trail_drawn = 0

with mujoco.viewer.launch_passive(m, d, show_left_ui=False, show_right_ui=False) as viewer:
    viewer.cam.type = mujoco.mjtCamera.mjCAMERA_TRACKING
    viewer.cam.trackbodyid = m.body("torso").id
    viewer.cam.distance, viewer.cam.elevation, viewer.cam.azimuth = 1.7, -24, 140
    viewer.opt.geomgroup[:] = 1

    wall0, sim0 = time.time(), d.time
    last_cam = 0.0
    while viewer.is_running():
        if args.max_seconds and time.time() - wall0 > args.max_seconds:
            break
        # advance physics until simulated time catches up with the wall clock
        target = sim0 + (time.time() - wall0) * args.speedup
        n = 0
        while d.time < target and n < 50:
            bot.step()
            n += 1

        if cam_renderer is not None and time.time() - last_cam > 0.15:
            cam_renderer.update_scene(d, camera="onboard", scene_option=cam_opt)
            cam_image = cam_renderer.render()
            last_cam = time.time()

        mission, labels, values = hud_lines(bot)
        if bridge:
            bridge.update(bot.telemetry())
            mission += "\nDashboard: " + {None: "connecting", True: "receiving data", False: "not reachable"}[bridge.ok]

        with viewer.lock():
            # TVOC trail: one disc per 10 cm walked, coloured by the gas reading there
            scn = viewer.user_scn
            while trail_drawn < len(bot.trail) and scn.ngeom < scn.maxgeom:
                x, y, tvoc = bot.trail[trail_drawn]
                mujoco.mjv_initGeom(scn.geoms[scn.ngeom], mujoco.mjtGeom.mjGEOM_CYLINDER,
                                    np.array([0.03, 0.0015, 0.0]), np.array([x, y, 0.004]),
                                    np.eye(3).flatten(), np.array(tvoc_rgba(tvoc), dtype=np.float32))
                scn.ngeom += 1
                trail_drawn += 1
            viewer.set_texts([
                (mujoco.mjtFontScale.mjFONTSCALE_150, mujoco.mjtGridPos.mjGRID_TOPLEFT, mission, None),
                (mujoco.mjtFontScale.mjFONTSCALE_150, mujoco.mjtGridPos.mjGRID_BOTTOMLEFT, labels, values),
            ])
            if cam_image is not None:
                vp = viewer.viewport
                if vp is not None and vp.width > 400:
                    w, h = 320, 240
                    viewer.set_images((mujoco.MjrRect(vp.width - w - 12, vp.height - h - 12, w, h), cam_image))
        viewer.sync()
        time.sleep(0.005)

if cam_renderer is not None:
    cam_renderer.close()
print(f"Finished: {bot.state}, {bot.distance:.2f} m walked in {d.time - bot.t0:.1f} s simulated")
for t, e in bot.events:
    print(f"  {t:6.1f} s  {e}")

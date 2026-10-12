"""Runs the survey headless and writes a video, result plots and a summary.

    python record.py                  video + plots + summary  (results/)
    python record.py --no-video       plots + summary only (seconds)
    python record.py --sweep          also the walking-speed vs servo-load sweep
"""

import argparse
import json
import math
from pathlib import Path

import mujoco
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from agribot import CTRL_DT, GAP_Y, AgriBot, env_dust, env_tvoc
from hud import hud_lines, tvoc_rgba
from model import DISEASE_CENTRE, DISEASE_RADIUS, FIELD, ROW_Y

OUT = Path(__file__).resolve().parent / "results"


def font(size, bold=False):
    for name in (("consolab.ttf", "arialbd.ttf") if bold else ("consola.ttf", "arial.ttf")):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default(size)


def panel(draw, xy, lines, f, pad=12, width=None):
    x, y = xy
    lh = f.size + 6
    w = width or max(draw.textlength(l, font=f) for l in lines) + 2 * pad
    draw.rounded_rectangle([x, y, x + w, y + len(lines) * lh + 2 * pad - 6], 10, fill=(14, 20, 16, 190))
    for i, l in enumerate(lines):
        draw.text((x + pad, y + pad + i * lh), l, font=f, fill=(236, 242, 236, 255))


def compose(frame, inset, bot):
    img = Image.fromarray(frame).convert("RGBA")
    over = Image.new("RGBA", img.size, (0, 0, 0, 0))
    dr = ImageDraw.Draw(over)
    mission, labels, values = hud_lines(bot)
    panel(dr, (18, 18), mission.split("\n"), font(19))
    rows = [f"{a:<28}{b}" for a, b in zip(labels.split("\n"), values.split("\n"))]
    panel(dr, (18, img.height - 18 - len(rows) * 25 - 18), rows, font(18))
    if inset is not None:
        iw, ih = inset.shape[1], inset.shape[0]
        x0, y0 = img.width - iw - 22, 22
        dr.rounded_rectangle([x0 - 6, y0 - 6, x0 + iw + 6, y0 + ih + 30], 8, fill=(14, 20, 16, 200))
        dr.text((x0, y0 + ih + 6), "Onboard ESP32-CAM view", font=font(16), fill=(220, 230, 220, 255))
    img = Image.alpha_composite(img, over)
    if inset is not None:
        img.paste(Image.fromarray(inset), (img.width - inset.shape[1] - 22, 22))
    return np.asarray(img.convert("RGB"))


def add_trail(scene, trail):
    for x, y, tvoc in trail:
        if scene.ngeom >= scene.maxgeom:
            break
        mujoco.mjv_initGeom(scene.geoms[scene.ngeom], mujoco.mjtGeom.mjGEOM_CYLINDER,
                            np.array([0.03, 0.0015, 0.0]), np.array([x, y, 0.004]),
                            np.eye(3).flatten(), np.array(tvoc_rgba(tvoc), dtype=np.float32))
        scene.ngeom += 1


def run(video, fps=30, speedup=2.0, size=(1280, 720)):
    bot = AgriBot()
    writer = renderer = cam_r = None
    if video:
        import imageio.v2 as imageio
        OUT.mkdir(exist_ok=True)
        writer = imageio.get_writer(OUT / "agribot_field_survey.mp4", fps=fps, codec="libx264",
                                    quality=None, macro_block_size=8,
                                    output_params=["-crf", "27", "-preset", "slow", "-pix_fmt", "yuv420p"])
        renderer = mujoco.Renderer(bot.m, size[1], size[0])
        cam_r = mujoco.Renderer(bot.m, 240, 320)
        cam = mujoco.MjvCamera()
        cam.type = mujoco.mjtCamera.mjCAMERA_TRACKING
        cam.trackbodyid = bot.m.body("torso").id
        cam.distance, cam.elevation, cam.azimuth = 1.75, -24, 140
        opt = mujoco.MjvOption()
        opt.geomgroup[:] = 1
        cam_opt = mujoco.MjvOption()
        cam_opt.flags[mujoco.mjtVisFlag.mjVIS_RANGEFINDER] = 0
    frame_dt, next_frame, shots = speedup / fps, 0.0, {}
    tail = 3.0
    while bot.d.time - bot.t0 < 400:
        bot.step()
        t = bot.d.time - bot.t0
        if video and t >= next_frame:
            next_frame += frame_dt
            renderer.update_scene(bot.d, camera=cam, scene_option=opt)
            add_trail(renderer.scene, bot.trail)
            frame = renderer.render()
            cam_r.update_scene(bot.d, camera="onboard", scene_option=cam_opt)
            inset = cam_r.render()
            out = compose(frame, inset, bot)
            writer.append_data(out)
            for key, when in (("01_standing", 3.0), ("02_row_gap_1", 25.0), ("03_diseased_patch", 63.0),
                              ("04_headland_turn", 86.0), ("05_survey_done", None)):
                if key not in shots and when is not None and t >= when:
                    shots[key] = out
        if bot.state in ("done", "fallen"):
            tail -= CTRL_DT
            if tail <= 0:
                break
    if video:
        shots["05_survey_done"] = out
        writer.close()
        renderer.close()
        cam_r.close()
        for k, img in shots.items():
            Image.fromarray(img).save(OUT / f"frame_{k}.png")
    return bot


def plots(bot):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    OUT.mkdir(exist_ok=True)
    log = bot.log
    t = np.array([r["t"] for r in log])
    col = lambda k: np.array([np.nan if r[k] is None else r[k] for r in log], dtype=float)
    plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False})

    # 1. survey map: path coloured by measured TVOC over the true VOC field
    fig, ax = plt.subplots(figsize=(10, 4.6))
    gx, gy = np.meshgrid(np.linspace(-FIELD[0], FIELD[0], 240), np.linspace(-FIELD[1], FIELD[1], 120))
    field = np.vectorize(env_tvoc)(gx, gy)
    ax.contourf(gx, gy, field, levels=14, cmap="YlOrRd", alpha=0.35)
    m = bot.m
    stem = m.material("stem").id
    for g in range(m.ngeom):
        if m.geom_matid[g] == stem:
            ax.plot(*bot.d.geom_xpos[g][:2], "o", color="#2f7d32", ms=3.2)
    ax.add_patch(plt.Circle(DISEASE_CENTRE, DISEASE_RADIUS, fill=False, ls="--", color="#8a5a00", lw=1.2))
    ax.text(DISEASE_CENTRE[0] + DISEASE_RADIUS * 0.72, DISEASE_CENTRE[1] - DISEASE_RADIUS * 0.72 - 0.08, "diseased patch",
            ha="left", va="top", color="#8a5a00", fontsize=9)
    sc = ax.scatter(col("x"), col("y"), c=col("tvoc_ppb"), cmap="RdYlGn_r", vmin=0, vmax=560, s=7, zorder=3)
    for tt, e in bot.events:
        if "Row end" in e:
            i = min(range(len(t)), key=lambda k: abs(t[k] - tt))
            ax.plot(log[i]["x"], log[i]["y"], marker="s", color="#1c4e80", ms=7, zorder=4)
    ax.set_aspect("equal")
    ax.set_xlim(-FIELD[0], FIELD[0]); ax.set_ylim(-FIELD[1], FIELD[1])
    ax.set_xlabel("x (m)"); ax.set_ylabel("y (m)")
    ax.set_title("Autonomous row survey: path coloured by measured TVOC (squares: row end detected by ultrasonic)")
    fig.colorbar(sc, ax=ax, label="TVOC (ppb)", shrink=0.85)
    fig.tight_layout(); fig.savefig(OUT / "survey_map.png", dpi=160); plt.close(fig)

    # 2. sensor time series
    fig, axs = plt.subplots(4, 1, figsize=(10, 8.4), sharex=True)
    axs[0].plot(t, col("tvoc_ppb"), color="#c0392b"); axs[0].set_ylabel("TVOC (ppb)")
    axs[0].axhline(220, ls=":", color="#999"); axs[0].text(t[-1], 226, "moderate", ha="right", fontsize=8, color="#777")
    axs[1].plot(t, col("dust"), color="#5b6fa8"); axs[1].set_ylabel("Dust (pcs/0.01 ft³)")
    axs[1].axhline(10000, ls=":", color="#999")
    axs[2].plot(t, col("temp_c"), color="#b4532a"); axs[2].set_ylabel("Temp (°C)")
    axs[3].plot(t, col("front_cm"), color="#6b5ba8", label="front"); axs[3].plot(t, col("side_cm"), color="#2f8f6f", label="side (crop row)")
    axs[3].axhline(55, ls=":", color="#999"); axs[3].set_ylabel("Ultrasonic (cm)"); axs[3].set_ylim(0, 420); axs[3].legend(loc="upper right", fontsize=8)
    axs[3].set_xlabel("time (s)")
    for ax in axs:
        for tt, e in bot.events:
            if "Row end" in e:
                ax.axvline(tt, color="#1c4e80", alpha=0.25)
    fig.suptitle("Simulated sensor readings during the survey (blue lines: row ends)")
    fig.tight_layout(); fig.savefig(OUT / "sensor_timeseries.png", dpi=160); plt.close(fig)

    # 3. servo load and gait quality
    fig, axs = plt.subplots(3, 1, figsize=(10, 6.6), sharex=True)
    axs[0].plot(t, col("torque_peak") * 100, color="#555", lw=0.8, label="peak, any joint")
    axs[0].plot(t, col("knee_peak") * 100, color="#c0392b", lw=0.8, alpha=0.8, label="peak knee")
    axs[0].axhline(100, color="#c0392b", ls="--", lw=1); axs[0].set_ylabel("Servo load (% stall)")
    axs[0].legend(loc="lower right", fontsize=8)
    axs[1].plot(t, np.degrees(np.abs(col("roll"))), label="|roll|"); axs[1].plot(t, np.degrees(np.abs(col("pitch"))), label="|pitch|")
    axs[1].set_ylabel("Tilt (deg)"); axs[1].legend(loc="upper right", fontsize=8)
    axs[2].plot(t, col("speed"), color="#2f6f4f"); axs[2].axhline(bot.speed, ls=":", color="#999")
    axs[2].set_ylabel("Speed (m/s)"); axs[2].set_xlabel("time (s)")
    fig.suptitle("Locomotion with MG996R-limited servos (1.0 N·m stall)")
    fig.tight_layout(); fig.savefig(OUT / "locomotion.png", dpi=160); plt.close(fig)

    # summary
    walk = [r for r in log if r["t"] > 3.0]
    tq = np.array([r["torque_peak"] for r in walk])
    tvoc = col("tvoc_ppb")
    i_max = int(np.nanargmax(tvoc))
    summary = {
        "outcome": bot.state,
        "duration_s": round(log[-1]["t"], 1),
        "distance_m": round(bot.distance, 2),
        "mean_speed_mps": round(float(np.mean([r["speed"] for r in walk])), 3),
        "rows_surveyed": len(GAP_Y),
        "row_ends_detected_by_ultrasonic": sum("Row end" in e for _, e in bot.events),
        "max_tilt_deg": round(float(np.degrees(max(max(abs(r["roll"]), abs(r["pitch"])) for r in walk))), 2),
        "peak_servo_load_pct": round(float(tq.max() * 100), 1),
        "time_any_servo_saturated_pct": round(float((tq > 0.98).mean() * 100), 1),
        "median_peak_servo_load_pct": round(float(np.median(tq) * 100), 1),
        "tvoc_max_ppb": round(float(tvoc[i_max]), 1),
        "tvoc_max_at_xy": [round(log[i_max]["x"], 2), round(log[i_max]["y"], 2)],
        "tvoc_source_true_xy": list(DISEASE_CENTRE),
        "dust_max": round(float(np.nanmax(col("dust"))), 0),
        "events": [[round(tt, 1), e] for tt, e in bot.events],
    }
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2))
    return summary


def sweep():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from tune import trial
    speeds = [0.06, 0.08, 0.10, 0.12, 0.14, 0.16, 0.18, 0.20, 0.22, 0.24]
    rows = []
    for v in speeds:
        r = trial(v, secs=15, freq=2.0, duty=0.6, sh=0.03, level=0.5)
        rows.append({"v": v, **{k: r[k] for k in ("fallen", "t", "dx", "tilt", "sat")}})
        print(f"  v={v:.2f}  {'FELL' if r['fallen'] else 'ok  '}  achieved {r['dx'] / r['t']:.3f} m/s  "
              f"tilt {r['tilt']:4.1f} deg  saturated {r['sat'] * 100:3.0f}% of time", flush=True)
    fig, ax = plt.subplots(figsize=(8, 4))
    ach = [r["dx"] / r["t"] for r in rows]
    ax.plot(speeds, ach, "o-", color="#2f6f4f", label="achieved speed")
    ax.plot(speeds, speeds, ":", color="#999", label="commanded")
    for r, a in zip(rows, ach):
        if r["fallen"]:
            ax.plot(r["v"], a, "x", color="#c0392b", ms=12, mew=2.5)
    ax2 = ax.twinx()
    ax2.bar(speeds, [r["sat"] * 100 for r in rows], width=0.012, alpha=0.3, color="#c0392b")
    ax2.set_ylabel("time at torque limit (%)", color="#c0392b")
    ax.set_xlabel("commanded speed (m/s)"); ax.set_ylabel("achieved speed (m/s)")
    ax.set_title("Trot speed vs MG996R torque limit (x = fell)")
    ax.legend(loc="upper left")
    fig.tight_layout(); fig.savefig(OUT / "speed_sweep.png", dpi=160); plt.close(fig)
    (OUT / "speed_sweep.json").write_text(json.dumps(rows, indent=2))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-video", action="store_true")
    ap.add_argument("--sweep", action="store_true")
    a = ap.parse_args()
    bot = run(video=not a.no_video)
    s = plots(bot)
    print(json.dumps({k: v for k, v in s.items() if k != "events"}, indent=2))
    if a.sweep:
        print("speed sweep:")
        sweep()

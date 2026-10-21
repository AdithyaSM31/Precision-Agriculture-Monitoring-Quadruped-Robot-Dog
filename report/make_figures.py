"""Generates the report's new figures into report/figures (run with the simulation venv)."""

import csv
import math
import shutil
import sys
from datetime import datetime
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Polygon
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "report" / "figures"
OUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / "simulation"))
sys.path.insert(0, str(ROOT / "agri_monitor" / "dashboard"))

plt.rcParams.update({"font.family": "serif", "font.serif": ["Times New Roman", "DejaVu Serif"], "font.size": 10,
                     "axes.spines.top": False, "axes.spines.right": False})


def save(fig, name):
    fig.savefig(OUT / name, dpi=220, bbox_inches="tight")
    plt.close(fig)
    print("wrote", name)


# ------------------------------------------------------------------ copied project figures
COPY = {
    ROOT / "3D_PRINT_READY" / "contact_sheet.png": "print_set.png",
    ROOT / "sys_arch.png": "initial_architecture.png",
    ROOT / "paper" / "figures" / "fig1_architecture.png": "final_architecture.png",
    ROOT / "simulation" / "results" / "frame_01_standing.png": "sim_standing.png",
    ROOT / "simulation" / "results" / "frame_03_diseased_patch.png": "sim_diseased_patch.png",
    ROOT / "simulation" / "results" / "frame_04_headland_turn.png": "sim_headland_turn.png",
    ROOT / "simulation" / "results" / "survey_map.png": "survey_map.png",
    ROOT / "simulation" / "results" / "sensor_timeseries.png": "sim_sensor_timeseries.png",
    ROOT / "simulation" / "results" / "locomotion.png": "sim_locomotion.png",
    ROOT / "simulation" / "results" / "speed_sweep.png": "speed_sweep.png",
}
for src, dst in COPY.items():
    shutil.copy(src, OUT / dst)
SCRATCH = Path(sys.argv[1]) if len(sys.argv) > 1 else None
if SCRATCH:
    for name in ("photo_chassis.jpg", "photo_oled.jpg", "dash_cards.jpg", "dash_diagnosis.jpg"):
        shutil.copy(SCRATCH / name, OUT / name)

# ------------------------------------------------------------------ real sensor logs (14 Oct session)
rows = list(csv.DictReader(open(ROOT / "agri_monitor/dashboard/data/sensors_2026-10-14.csv")))
t0 = datetime.fromisoformat(rows[0]["time"])
t = np.array([(datetime.fromisoformat(r["time"]) - t0).total_seconds() / 60 for r in rows])
eco2 = np.array([float(r["eco2_ppm"]) for r in rows])
tvoc = np.array([float(r["tvoc_ppb"]) for r in rows])
temp = np.array([float(r["temp_c"]) for r in rows])
fig, axs = plt.subplots(3, 1, figsize=(6.2, 5.6), sharex=True)
axs[0].plot(t, tvoc, color="#b42318", lw=1)
axs[0].axhline(220, ls=":", color="#888"); axs[0].axhline(660, ls="--", color="#888")
axs[0].text(t[-1], 240, "moderate", ha="right", fontsize=8, color="#666")
axs[0].text(t[-1], 680, "high", ha="right", fontsize=8, color="#666")
axs[0].set_ylabel("TVOC (ppb)")
axs[1].plot(t, eco2, color="#1d6b4c", lw=1); axs[1].set_ylabel("eCO$_2$ (ppm)"); axs[1].set_yscale("log")
axs[2].plot(t, temp, color="#9a5a00", lw=1); axs[2].set_ylabel("Temperature (°C)")
axs[2].set_xlabel("time since start of session (min)")
fig.suptitle("Logged readings from the physical sensor node, 14 October 2026", fontsize=11)
fig.tight_layout()
save(fig, "real_log_session.png")

rows12 = list(csv.DictReader(open(ROOT / "agri_monitor/dashboard/data/sensors_2026-10-12.csv")))
t12 = np.array([(datetime.fromisoformat(r["time"]) - datetime.fromisoformat(rows12[0]["time"])).total_seconds() / 60 for r in rows12])
fig, axs = plt.subplots(2, 1, figsize=(6.2, 3.8), sharex=True)
axs[0].plot(t12, [float(r["temp_c"]) for r in rows12], color="#9a5a00", lw=1); axs[0].set_ylabel("Temperature (°C)")
axs[1].plot(t12, [int(r["rssi"]) for r in rows12], color="#3b4cc0", lw=1); axs[1].set_ylabel("Wi-Fi RSSI (dBm)")
axs[1].set_xlabel("time since start of session (min)")
fig.suptitle("Sensor node temperature and link strength, 12 October 2026", fontsize=11)
fig.tight_layout()
save(fig, "real_log_temp_rssi.png")

# ------------------------------------------------------------------ vegetation gate illustration
from classifier import MIN_LEAF_COVERAGE, leaf_coverage  # noqa: E402
from matplotlib.patches import Rectangle  # noqa: E402

CAP = ROOT / "agri_monitor/dashboard/data/captures"
examples = [("20261018_103437_022.jpg", "Fallen leaf on paving"),
            ("20261018_103127_440.jpg", "Hedge at about 1 m"),
            ("20261018_103305_564.jpg", "Potted plant, close up"),
            ("20261018_104855_884.jpg", "Spotted leaves, close up")]
GREEN, RED = "#1f7a3a", "#b3261e"
fig, axs = plt.subplots(3, 4, figsize=(7.2, 3.75), gridspec_kw={"height_ratios": [1, 1, 0.22]})
for col, (name, label) in enumerate(examples):
    im = Image.open(CAP / name).convert("RGB")
    im = im.crop((0, 0, im.width, int(im.height * 0.875)))     # drop the dashboard's label banner
    cov = leaf_coverage(im)
    ok = cov >= MIN_LEAF_COVERAGE
    shown = im.resize((320, 240))
    hsv = np.asarray(shown.convert("HSV"), dtype=np.float32)
    h, s_, v = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
    mask = (h >= 38) & (h <= 165) & (s_ >= 0.20) & (v >= 0.12)
    rgb = np.asarray(shown, dtype=np.float32) / 255
    grey = rgb.mean(axis=2, keepdims=True) * np.ones(3)
    over = 0.35 * grey + 0.25
    over[mask] = 0.35 * rgb[mask] + 0.65 * np.array([0.10, 0.75, 0.25])
    axs[0, col].imshow(shown)
    axs[0, col].set_title(label, fontsize=9.5, pad=4)
    axs[1, col].imshow(over)
    for r in (0, 1):
        axs[r, col].set_xticks([]); axs[r, col].set_yticks([])
        for sp in axs[r, col].spines.values():
            sp.set_visible(True); sp.set_color("#999999"); sp.set_linewidth(0.6)
    bar = axs[2, col]
    bar.set_xlim(0, 1); bar.set_ylim(0, 1); bar.axis("off")
    bar.add_patch(Rectangle((0, 0.55), 1, 0.4, color="#e6e6e6", lw=0))
    bar.add_patch(Rectangle((0, 0.55), min(cov / 0.8, 1), 0.4, color=GREEN if ok else RED, lw=0))
    t = MIN_LEAF_COVERAGE / 0.8
    bar.plot([t, t], [0.45, 1.05], color="black", lw=1.0)
    bar.text(0.5, -0.25, f"coverage {cov * 100:.0f} %  →  {'accepted' if ok else 'rejected'}",
             ha="center", va="center", fontsize=9, color=GREEN if ok else RED, fontweight="bold")
axs[0, 0].set_ylabel("Camera frame", fontsize=9)
axs[1, 0].set_ylabel("Leaf-coloured pixels", fontsize=9)
fig.text(0.5, 0.005, "Bars: leaf coverage on a 0–80 % scale; the black tick marks the 12 % threshold",
         ha="center", fontsize=8.5, color="#444444")
fig.tight_layout(h_pad=0.6, w_pad=0.5, rect=(0, 0.03, 1, 1))
save(fig, "vegetation_gate.png")

# ------------------------------------------------------------------ leg kinematics schematic
from gait import leg_ik  # noqa: E402
from model import L1, L2  # noqa: E402

fig, ax = plt.subplots(figsize=(4.6, 4.2))
px, h = 0.03, 0.18
_, hip, knee = leg_ik(px, 0.06, -h, 1)
hipxy = np.array([0.0, 0.0])
kneexy = hipxy + L1 * np.array([-math.sin(hip), -math.cos(hip)])
foot = kneexy + L2 * np.array([-math.sin(hip + knee), -math.cos(hip + knee)])
ax.plot(*zip(hipxy, kneexy), color="#c99400", lw=7, solid_capstyle="round")
ax.plot(*zip(kneexy, foot), color="#222", lw=5, solid_capstyle="round")
for p, lab, off in ((hipxy, "hip joint", (0.012, 0.01)), (kneexy, "knee joint", (-0.07, 0.0)), (foot, "foot (p$_x$, −h)", (0.012, -0.012))):
    ax.plot(*p, "o", color="white", mec="black", ms=8, zorder=5)
    ax.text(p[0] + off[0], p[1] + off[1], lab, fontsize=9)
ax.plot([0, 0], [0, -0.23], ls=":", color="#888")
ax.plot([0, foot[0]], [foot[1], foot[1]], ls=":", color="#888")
ax.text(0.004, -0.215, "z", fontsize=9, color="#666")
ax.text((kneexy[0] + hipxy[0]) / 2 + 0.012, (kneexy[1] + hipxy[1]) / 2 + 0.01, "L$_1$ = 111 mm", fontsize=9)
ax.text((kneexy[0] + foot[0]) / 2 + 0.01, (kneexy[1] + foot[1]) / 2, "L$_2$ = 125 mm", fontsize=9)
ax.text(-0.125, -0.025, f"θ$_h$ = {math.degrees(hip):.0f}°", fontsize=9)
ax.text(kneexy[0] - 0.065, kneexy[1] - 0.045, f"θ$_k$ = {math.degrees(knee):.0f}°", fontsize=9)
ax.set_aspect("equal"); ax.set_xlim(-0.13, 0.11); ax.set_ylim(-0.215, 0.03)
ax.set_xlabel("x, forward (m)"); ax.set_ylabel("z, up (m)")
ax.set_title("Sagittal-plane leg geometry (knee behind the foot)", fontsize=10)
save(fig, "leg_kinematics.png")

# ------------------------------------------------------------------ foot trajectory over one gait cycle
from gait import Trot  # noqa: E402

g = Trot(height=0.18, step_height=0.03, freq=2.0, duty=0.6, level_gain=0.0)
g.amp = 1.0
xs, zs, ph = [], [], []
for i in range(200):
    tg = g.foot_targets(0.0025, 0.14, 0.0, 0, 0, True)
    xs.append(tg["FL"][0] * 1000); zs.append((tg["FL"][2] + 0.18) * 1000); ph.append(g.phase)
fig, axs = plt.subplots(1, 2, figsize=(6.4, 2.6))
axs[0].plot(xs, zs, color="#1d6b4c"); axs[0].set_xlabel("foot x relative to hip (mm)"); axs[0].set_ylabel("foot lift (mm)")
axs[0].set_title("Front-left foot path at 0.14 m/s", fontsize=9)
axs[0].annotate("stance", xy=(0, 0.5), fontsize=8); axs[0].annotate("swing", xy=(-4, 25), fontsize=8)
order = np.argsort(ph)
axs[1].plot(np.array(ph)[order], np.array(zs)[order], color="#b42318")
axs[1].axvspan(0, 0.6, color="#1d6b4c", alpha=0.08)
axs[1].set_xlabel("gait phase"); axs[1].set_ylabel("foot lift (mm)"); axs[1].set_title("Stance 60 %, swing 40 %", fontsize=9)
fig.tight_layout()
save(fig, "foot_trajectory.png")

# ------------------------------------------------------------------ centre of mass vs diagonal support line (top view)
fig, ax = plt.subplots(figsize=(5.2, 3.4))
feet = {"FL": (0.07, 0.099), "FR": (0.07, -0.099), "RL": (-0.07, 0.099), "RR": (-0.07, -0.099)}
ax.add_patch(Polygon([(0.12, 0.05), (0.12, -0.05), (-0.12, -0.05), (-0.12, 0.05)], fc="#f6d36b", ec="black", lw=0.8, alpha=0.6))
for n, (x, y) in feet.items():
    on = n in ("FL", "RR")
    ax.plot(x, y, "o", ms=11, color="#1d6b4c" if on else "white", mec="black")
    ax.text(x + 0.01, y + (0.012 if y > 0 else -0.025), n + (" (stance)" if on else " (swing)"), fontsize=8)
ax.plot([0.07, -0.07], [0.099, -0.099], color="#1d6b4c", lw=1.5, label="diagonal support line")
ax.plot(0, 0, "+", color="black", ms=12, mew=1.5); ax.text(0.006, 0.008, "body centre", fontsize=8)
ax.plot(-0.012, 0, "o", color="#b42318", ms=7); ax.text(-0.118, 0.012, "centre of mass\n12 mm aft", fontsize=8, color="#b42318")
ax.annotate("", xy=(-0.012, -0.012), xytext=(0, -0.012), arrowprops=dict(arrowstyle="<->", color="#b42318", lw=0.8))
ax.set_aspect("equal"); ax.set_xlim(-0.16, 0.16); ax.set_ylim(-0.14, 0.14)
ax.set_xlabel("x, forward (m)"); ax.set_ylabel("y, left (m)")
ax.set_title("Trot support during an FL + RR stance phase (top view)", fontsize=10)
ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.2), fontsize=8, frameon=False)
save(fig, "com_support_line.png")

# ------------------------------------------------------------------ firmware task schedule
tasks = [("SGP30 read", 1.0, "#1d6b4c"), ("MCP9808 read", 2.0, "#9a5a00"), ("Ultrasonic (alternating)", 0.25, "#3b4cc0"),
         ("PPD42 window close", 30.0, "#7b4fe0"), ("Telemetry POST", 5.0, "#b42318"), ("OLED refresh", 0.5, "#555555")]
fig, ax = plt.subplots(figsize=(6.4, 2.6))
for i, (name, period, col) in enumerate(tasks):
    ticks = np.arange(0, 32, period)
    ax.vlines(ticks, i - 0.35, i + 0.35, color=col, lw=1.2)
    ax.text(-0.6, i, f"{name}  ({period:g} s)", ha="right", va="center", fontsize=8)
ax.set_yticks([]); ax.set_xlim(0, 31); ax.set_ylim(-0.6, len(tasks) - 0.4)
ax.set_xlabel("time (s)"); ax.spines["left"].set_visible(False)
ax.set_title("Cooperative task schedule in the sensor-node main loop (PPD42 edges handled by interrupt)", fontsize=9)
save(fig, "firmware_schedule.png")

# ------------------------------------------------------------------ dashboard software architecture
fig, ax = plt.subplots(figsize=(6.4, 3.6)); ax.axis("off"); ax.set_xlim(0, 12); ax.set_ylim(0, 7)
def box(x, y, w, h, title, lines, fc="white"):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.15", fc=fc, ec="black", lw=0.7))
    ax.text(x + w / 2, y + h - 0.3, title, ha="center", va="top", fontsize=8.5, fontweight="bold")
    for i, l in enumerate(lines):
        ax.text(x + 0.15, y + h - 0.85 - i * 0.42, l, fontsize=7.5, va="top")
box(0.1, 3.6, 3.3, 3.2, "Sensor node", ["POST /api/sensors", "every 5 s, JSON"])
box(0.1, 0.2, 3.3, 3.0, "Camera node", ["MJPEG :81/stream", "POST /api/camera", "at boot"])
box(4.2, 0.2, 3.6, 6.6, "Flask server (laptop)", ["Routes: /api/sensors, /api/state,", "/api/camera, /api/scan,", "/api/classify, /api/camera/stream", "", "Camera worker thread:", "reads MJPEG, keeps latest frame,", "counts fps, optional auto-scan", "", "Classifier: vegetation gate", "+ MobileNetV2 (CPU)", "", "Storage: daily CSV, captures/,", "detections.jsonl"], fc="#eeeeee")
box(8.6, 3.6, 3.3, 3.2, "Browser / phone", ["polls /api/state, 2 s", "one MJPEG connection", "scan and upload buttons"])
box(8.6, 0.2, 3.3, 3.0, "Disk", ["sensors_YYYY-MM-DD.csv", "tagged JPEG captures", "settings.json"])
for (x1, y1, x2, y2) in ((3.4, 5.2, 4.2, 5.2), (3.4, 1.7, 4.2, 1.7), (7.8, 5.2, 8.6, 5.2), (7.8, 1.7, 8.6, 1.7)):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=8, lw=0.8))
save(fig, "dashboard_architecture.png")
print("done")

"""Column-width version of the vegetation-gate figure for the paper (run with the simulation venv)."""

import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "agri_monitor" / "dashboard"))
from classifier import MIN_LEAF_COVERAGE, leaf_coverage  # noqa: E402

plt.rcParams.update({"font.family": "serif", "font.serif": ["Times New Roman", "DejaVu Serif"], "font.size": 8})
CAP = ROOT / "agri_monitor/dashboard/data/captures"
examples = [("20261018_103437_022.jpg", "Fallen leaf on paving"),
            ("20261018_103127_440.jpg", "Hedge at about 1 m"),
            ("20261018_103305_564.jpg", "Potted plant, close up"),
            ("20261018_104855_884.jpg", "Spotted leaves, close up")]
GREEN, RED = "#1f7a3a", "#b3261e"

fig, axs = plt.subplots(4, 2, figsize=(3.4, 4.75))
for row, (name, label) in enumerate(examples):
    im = Image.open(CAP / name).convert("RGB")
    im = im.crop((0, 0, im.width, int(im.height * 0.875)))     # drop the dashboard's label banner
    cov = leaf_coverage(im)
    ok = cov >= MIN_LEAF_COVERAGE
    shown = im.resize((320, 240))
    hsv = np.asarray(shown.convert("HSV"), dtype=np.float32)
    h, s, v = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
    mask = (h >= 38) & (h <= 165) & (s >= 0.20) & (v >= 0.12)
    rgb = np.asarray(shown, dtype=np.float32) / 255
    over = 0.35 * rgb.mean(axis=2, keepdims=True) * np.ones(3) + 0.25
    over[mask] = 0.35 * rgb[mask] + 0.65 * np.array([0.10, 0.75, 0.25])
    axs[row, 0].imshow(shown)
    axs[row, 0].set_title(label, fontsize=8, pad=2)
    axs[row, 1].imshow(over)
    axs[row, 1].set_title(f"{cov * 100:.0f} % leaf → {'accepted' if ok else 'rejected'}", fontsize=8, pad=2,
                          color=GREEN if ok else RED, fontweight="bold")
    for a in axs[row]:
        a.set_xticks([]); a.set_yticks([])
        for sp in a.spines.values():
            sp.set_color("#999999"); sp.set_linewidth(0.5)
fig.tight_layout(h_pad=0.5, w_pad=0.4)
out = ROOT / "paper" / "figures" / "fig_gate.png"
fig.savefig(out, dpi=300, bbox_inches="tight")
print("wrote", out)

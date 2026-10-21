"""Stand-in for the XIAO sensor node, for testing the dashboard without hardware.

Posts the same JSON the firmware sends, every 2 s, with slow drift and an
occasional spike so the alert colours can be seen.

    python fake_sensors.py [--url http://localhost:5000]
"""

import argparse
import json
import math
import random
import time
import urllib.request


def level(value, moderate, high):
    return "high" if value >= high else "moderate" if value >= moderate else "good"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:5000")
    ap.add_argument("--period", type=float, default=2.0)
    args = ap.parse_args()

    t0 = time.time()
    while True:
        t = time.time() - t0
        spike = 1.0 + (2.5 if int(t) % 90 < 12 else 0.0)  # 12 s spike every 90 s
        eco2 = int(520 + 120 * math.sin(t / 40) * spike + random.uniform(-15, 15))
        tvoc = int(max(0, (90 + 40 * math.sin(t / 25)) * spike + random.uniform(-8, 8)))
        dust = max(0.0, 4200 + 1800 * math.sin(t / 55) * spike + random.uniform(-300, 300))
        temp = 29.5 + 1.2 * math.sin(t / 120) + random.uniform(-0.05, 0.05)
        air = "warmup" if t < 15 else level(tvoc, 220, 660) if level(tvoc, 220, 660) != "good" else level(eco2, 1000, 2000)
        payload = {
            "node": "fake", "uptime_s": int(t), "rssi": -55, "sgp30_ok": True,
            "eco2_ppm": eco2, "tvoc_ppb": tvoc, "air_level": air,
            "dust_valid": t >= 60, "dust_ratio_pct": round(dust / 520, 3),
            "dust_pcs_per_0_01cf": round(dust, 1),
            "dust_level": level(dust, 10000, 20000) if t >= 60 else "warmup",
            "mcp9808_ok": True, "temp_c": round(temp, 2),
            "muted": False,
        }
        req = urllib.request.Request(args.url + "/api/sensors", data=json.dumps(payload).encode(),
                                     headers={"Content-Type": "application/json"})
        try:
            urllib.request.urlopen(req, timeout=3).read()
            print(f"t={t:5.0f}s  eCO2 {eco2:4d}  TVOC {tvoc:4d}  dust {dust:7.0f}  [{air}]")
        except OSError as exc:
            print("post failed:", exc)
        time.sleep(args.period)


if __name__ == "__main__":
    main()

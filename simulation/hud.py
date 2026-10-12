"""Shared presentation: HUD text, trail colours and the dashboard bridge."""

import json
import threading
import time
import urllib.request

LEVEL_TAG = {"good": "GOOD", "moderate": "MODERATE", "high": "HIGH", "warmup": "warming up"}


def tvoc_rgba(tvoc):
    """Green (clean) -> yellow -> red (VOC hotspot) for the trail markers."""
    u = max(0.0, min(1.0, (tvoc - 20) / 500))
    if u < 0.5:
        return (0.20 + 1.5 * u, 0.75, 0.25, 0.9)
    return (0.95, 0.75 - 1.3 * (u - 0.5), 0.15, 0.9)


def fmt_cm(v):
    return "no echo" if v is None else f"{v:.0f} cm"


def hud_lines(bot):
    """(mission text, sensor labels, sensor values) for the overlay panels."""
    tel = bot.telemetry()
    x, y, z, roll, pitch, yaw = bot.pose
    t = bot.d.time - bot.t0
    gap = min(bot.wp // 2 + 1, 3)
    status = {"standing up": "Standing up", "surveying": f"Surveying row gap {gap} of 3",
              "done": "Survey complete", "fallen": "Robot fell"}[bot.state]
    last = "Last event: " + bot.events[-1][1] if bot.events else ""
    mission = (f"AgriBot  |  MuJoCo physics  |  12 x MG996R (1.0 N*m)\n"
               f"{status}\n"
               f"t = {t:5.1f} s   distance {bot.distance:5.2f} m   speed {tel['speed']:.2f} m/s\n"
               f"{last}")
    labels = "\n".join(["TVOC (SGP30)", "eCO2 (SGP30)", "Dust (PPD42)", "Temperature (MCP9808)",
                        "Front ultrasonic", "Side ultrasonic (crop row)", "Body height / tilt",
                        "Peak servo load"])
    values = "\n".join([
        f"{tel['tvoc_ppb']:5.0f} ppb  {LEVEL_TAG.get(tel['air_level'], '')}",
        f"{tel['eco2_ppm']:5.0f} ppm",
        f"{tel['dust']:5.0f} pcs  {LEVEL_TAG[tel['dust_level']]}",
        f"{tel['temp_c']:5.1f} C",
        fmt_cm(tel["front_cm"]),
        fmt_cm(tel["side_cm"]),
        f"{tel['body_h'] * 100:4.1f} cm / {abs(roll) * 57.3:3.1f}, {abs(pitch) * 57.3:3.1f} deg",
        f"{tel['torque_peak'] * 100:3.0f} % of stall",
    ])
    return mission, labels, values


class DashboardBridge:
    """Posts simulated readings to the real AgriBot dashboard, like the XIAO does."""

    def __init__(self, base_url, period=2.0):
        self.url = base_url.rstrip("/") + "/api/sensors"
        self.period = period
        self.latest = None
        self.ok = None
        threading.Thread(target=self._run, daemon=True).start()

    def update(self, tel):
        self.latest = tel

    def _run(self):
        while True:
            time.sleep(self.period)
            tel = self.latest
            if not tel:
                continue
            payload = {
                "node": "mujoco-sim", "sgp30_ok": True, "mcp9808_ok": True,
                "eco2_ppm": round(tel["eco2_ppm"]), "tvoc_ppb": round(tel["tvoc_ppb"]),
                "air_level": tel["air_level"], "dust_present": True, "dust_valid": True,
                "dust_pcs_per_0_01cf": round(tel["dust"], 1), "dust_level": tel["dust_level"],
                "temp_c": round(tel["temp_c"], 2), "front_cm": tel["front_cm"],
                "obstacle": tel["front_cm"] is not None and tel["front_cm"] < 25,
                "down_cm": None, "canopy_cm": None, "rssi": 0, "muted": False,
            }
            try:
                req = urllib.request.Request(self.url, data=json.dumps(payload).encode(),
                                             headers={"Content-Type": "application/json"})
                urllib.request.urlopen(req, timeout=2).read()
                self.ok = True
            except OSError:
                self.ok = False

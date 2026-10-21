"""AgriBot field monitor - laptop dashboard.

Receives sensor readings from the XIAO ESP32-S3 node, pulls frames from a
camera (ESP32-CAM, phone IP-webcam app, or any URL that returns a JPEG),
tags leaf images with a disease classifier and serves a live dashboard.

    python app.py            then open http://localhost:5000
"""

import csv
import io
import json
import os
import socket
import threading
import time
from collections import deque
from datetime import datetime
from pathlib import Path

import requests
from flask import Flask, Response, abort, jsonify, render_template, request, send_from_directory
from PIL import Image, ImageDraw, ImageFont

from classifier import LeafClassifier

BASE = Path(__file__).resolve().parent
DATA = BASE / "data"
CAPTURES = DATA / "captures"
SETTINGS_FILE = DATA / "settings.json"
DETECTIONS_FILE = DATA / "detections.jsonl"
CAPTURES.mkdir(parents=True, exist_ok=True)

PORT = int(os.environ.get("AGRI_PORT", "5000"))
NODE_TIMEOUT_S = 15        # node posts every 5 s; three misses = offline
SNAPSHOT_PERIOD_S = 0.15   # polling rate for cameras without a video stream
HISTORY_LEN = 720          # one hour at 5 s

app = Flask(__name__)
lock = threading.Lock()
frame_ready = threading.Condition()   # wakes browser video streams on each new frame
classifier = LeafClassifier()

history = deque(maxlen=HISTORY_LEN)
detections = deque(maxlen=24)
node = {"latest": None, "last_seen": 0.0, "ip": None}
camera = {"frame": None, "frame_time": 0.0, "frame_id": 0, "fps": 0.0, "error": None}


# ------------------------------------------------------------------ settings
def load_settings():
    defaults = {"camera_url": os.environ.get("AGRI_CAMERA_URL", ""), "stream_url": "",
                "auto_scan_s": float(os.environ.get("AGRI_SCAN_INTERVAL", "0"))}
    try:
        defaults.update(json.loads(SETTINGS_FILE.read_text()))
    except (OSError, ValueError):
        pass
    return defaults


settings = load_settings()


def save_settings():
    SETTINGS_FILE.write_text(json.dumps(settings, indent=2))


def load_detections():
    try:
        lines = DETECTIONS_FILE.read_text().splitlines()
    except OSError:
        return
    for line in lines[-detections.maxlen:]:
        try:
            detections.append(json.loads(line))
        except ValueError:
            pass


# ------------------------------------------------------------------ sensor log
def log_reading(row):
    path = DATA / f"sensors_{datetime.now():%Y-%m-%d}.csv"
    fields = ["time", "eco2_ppm", "tvoc_ppb", "air_level",
              "dust_pcs_per_0_01cf", "dust_ratio_pct", "dust_level",
              "temp_c", "rssi"]
    if path.exists():
        with path.open() as f:
            header = f.readline().strip().split(",")
        if header != fields:  # columns changed since this file was started: set it aside
            path.rename(path.with_name(f"{path.stem}_before_{datetime.now():%H%M%S}.csv"))
    new = not path.exists()
    with path.open("a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        if new:
            w.writeheader()
        w.writerow(row)


def sensor_snapshot():
    """Readings to stamp onto an image, so every tagged leaf carries its air context."""
    latest = node["latest"]
    if not latest or time.time() - node["last_seen"] > NODE_TIMEOUT_S:
        return None
    keys = ("eco2_ppm", "tvoc_ppb", "air_level", "dust_pcs_per_0_01cf", "dust_level", "dust_valid",
            "temp_c")
    return {k: latest.get(k) for k in keys}


# ------------------------------------------------------------------ tagging
def font(size):
    for name in ("arialbd.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def annotate(image, result):
    img = image.convert("RGB")
    img.thumbnail((800, 800))
    draw = ImageDraw.Draw(img)
    h = max(34, img.height // 9)
    if result["healthy"] is None:
        colour = (110, 110, 110)
    else:
        colour = (36, 128, 66) if result["healthy"] else (190, 50, 40)
    draw.rectangle([0, img.height - h, img.width, img.height], fill=colour)
    text = f'{result["crop"]} - {result["condition"]}  {result["confidence"] * 100:.0f}%'
    size = int(h * 0.55)
    while size > 10 and draw.textlength(text, font=font(size)) > img.width - 20:
        size -= 1
    draw.text((10, img.height - h + (h - size) / 2), text, fill="white", font=font(size))
    return img


def tag_image(image, source):
    result = classifier.classify(image)
    if result is None:
        return None, "classifier is still loading" if not classifier.error else classifier.error
    stamp = datetime.now()
    name = f"{stamp:%Y%m%d_%H%M%S_%f}"[:-3] + ".jpg"
    annotate(image, result).save(CAPTURES / name, quality=88)
    record = {"id": name, "time": stamp.isoformat(timespec="seconds"), "source": source,
              "image": f"/captures/{name}", "sensors": sensor_snapshot(), **result}
    with lock:
        detections.append(record)
    with DETECTIONS_FILE.open("a") as f:
        f.write(json.dumps(record) + "\n")
    return record, None


# ------------------------------------------------------------------ camera
def fetch_frame(url):
    r = requests.get(url, timeout=4)
    r.raise_for_status()
    return r.content


def mjpeg_frames(url):
    """Yield JPEGs from an MJPEG stream by cutting at the JPEG start/end markers.

    Works for any multipart camera stream regardless of its boundary string.
    """
    with requests.get(url, stream=True, timeout=(4, 8)) as r:
        r.raise_for_status()
        buf = b""
        for chunk in r.iter_content(chunk_size=16384):
            buf += chunk
            while True:
                start = buf.find(b"\xff\xd8")
                end = buf.find(b"\xff\xd9", start + 2) if start != -1 else -1
                if end == -1:
                    break
                yield buf[start:end + 2]
                buf = buf[end + 2:]
            if len(buf) > 2_000_000:  # never found an end marker - resync
                buf = b""


def snapshot_frames(url):
    """Fallback for cameras that only serve single photos."""
    while True:
        yield fetch_frame(url)
        time.sleep(SNAPSHOT_PERIOD_S)


frame_times = deque(maxlen=120)


def publish_frame(data):
    now = time.time()
    with lock:
        # Frames arrive from Wi-Fi in bursts, so count them over a 2 s window
        # rather than inverting the gap between two frames.
        frame_times.append(now)
        while frame_times and now - frame_times[0] > 2:
            frame_times.popleft()
        camera["fps"] = (len(frame_times) - 1) / (now - frame_times[0]) if len(frame_times) > 1 else 0.0
        camera.update(frame=data, frame_time=now, frame_id=camera["frame_id"] + 1, error=None)
    with frame_ready:
        frame_ready.notify_all()


def camera_worker():
    last_scan = 0.0
    while True:
        url, stream_url = settings.get("camera_url"), settings.get("stream_url")
        if not url and not stream_url:
            time.sleep(1)
            continue
        try:
            frames = mjpeg_frames(stream_url) if stream_url else snapshot_frames(url)
            for data in frames:
                if (settings.get("camera_url"), settings.get("stream_url")) != (url, stream_url):
                    break  # switched cameras - reconnect to the new one
                publish_frame(data)
                period = settings.get("auto_scan_s") or 0
                if period > 0 and time.time() - last_scan >= period and classifier.ready:
                    last_scan = time.time()
                    tag_image(Image.open(io.BytesIO(data)), "auto-scan")
        except Exception as exc:
            with lock:
                if settings.get("camera_url") == url:
                    camera.update(error=f"{type(exc).__name__}: {exc}"[:200], fps=0.0)
            time.sleep(2)


# ------------------------------------------------------------------ routes
@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/sensors")
def receive_sensors():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify(error="expected a JSON object"), 400
    now = time.time()
    row = {**payload, "time": datetime.now().isoformat(timespec="seconds")}
    with lock:
        node.update(latest=row, last_seen=now, ip=request.remote_addr)
        history.append({"t": now, "eco2": payload.get("eco2_ppm"), "tvoc": payload.get("tvoc_ppb"),
                        "dust": payload.get("dust_pcs_per_0_01cf") if payload.get("dust_valid") else None,
                        "temp": payload.get("temp_c")})
    log_reading(row)
    return jsonify(ok=True)


@app.get("/api/state")
def state():
    now = time.time()
    with lock:
        frame_age = now - camera["frame_time"] if camera["frame"] else None
        return jsonify(
            node={"online": now - node["last_seen"] < NODE_TIMEOUT_S, "ip": node["ip"],
                  "age_s": round(now - node["last_seen"], 1) if node["last_seen"] else None,
                  "latest": node["latest"]},
            history=[{**h, "t": round(h["t"] - now, 1)} for h in history if now - h["t"] <= 600],
            camera={"url": settings.get("camera_url"), "auto_scan_s": settings.get("auto_scan_s"),
                    "streaming": bool(settings.get("stream_url")),
                    "fps": round(camera["fps"], 1) if frame_age is not None and frame_age < 5 else 0,
                    "live": frame_age is not None and frame_age < 5, "error": camera["error"]},
            classifier={"ready": classifier.ready, "error": classifier.error,
                        "model": classifier.model_id},
            detections=list(reversed(detections)),
        )


@app.get("/api/camera/frame.jpg")
def camera_frame():
    with lock:
        data = camera["frame"]
    if not data:
        abort(404)
    return Response(data, mimetype="image/jpeg", headers={"Cache-Control": "no-store"})


@app.post("/api/camera")
def set_camera():
    body = request.get_json(silent=True) or {}
    url = (body.get("url") or "").strip()
    if url and not url.startswith(("http://", "https://")):
        url = "http://" + url
    with lock:
        if "stream" in body:  # the camera node sends its stream URL when it registers
            settings["stream_url"] = (body.get("stream") or "").strip()
        elif url != settings.get("camera_url"):  # a URL typed in by hand: photos only
            settings["stream_url"] = ""
        changed = url != settings.get("camera_url")
        settings["camera_url"] = url
        settings["auto_scan_s"] = max(0.0, float(body.get("auto_scan_s", settings.get("auto_scan_s") or 0)))
        if changed:
            camera.update(frame=None, frame_time=0.0, fps=0.0, error=None)
    save_settings()
    return jsonify(ok=True, url=url, stream=settings["stream_url"])


@app.get("/api/camera/stream")
def camera_stream():
    """Relays the latest frames to the browser as MJPEG video.

    Every viewer shares the one connection to the camera, so phones watching
    the dashboard add no load on the ESP32-CAM.
    """
    def frames():
        last_id = -1
        while True:
            with frame_ready:
                frame_ready.wait(timeout=5)
            with lock:
                data, fid = camera["frame"], camera["frame_id"]
            if data is None or fid == last_id:
                continue
            last_id = fid
            yield (b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: "
                   + str(len(data)).encode() + b"\r\n\r\n" + data + b"\r\n")

    return Response(frames(), mimetype="multipart/x-mixed-replace; boundary=frame",
                    headers={"Cache-Control": "no-store"})


@app.post("/api/scan")
def scan_now():
    with lock:
        data = camera["frame"]
    if not data:
        return jsonify(error="no camera frame yet - check the camera URL"), 409
    record, err = tag_image(Image.open(io.BytesIO(data)), "camera")
    return (jsonify(record), 200) if record else (jsonify(error=err), 503)


@app.post("/api/classify")
def classify_upload():
    file = request.files.get("image")
    if not file:
        return jsonify(error="no image uploaded"), 400
    try:
        image = Image.open(file.stream)
        image.load()
    except Exception:
        return jsonify(error="not a readable image"), 400
    record, err = tag_image(image, "upload")
    return (jsonify(record), 200) if record else (jsonify(error=err), 503)


@app.get("/captures/<path:name>")
def captures(name):
    return send_from_directory(CAPTURES, name)


@app.get("/api/export.csv")
def export_csv():
    files = sorted(DATA.glob("sensors_*.csv"), key=lambda f: f.stat().st_mtime)
    if not files:
        abort(404)
    return send_from_directory(DATA, files[-1].name, as_attachment=True)


def local_addresses():
    try:
        return sorted({a for a in socket.gethostbyname_ex(socket.gethostname())[2]
                       if not a.startswith("127.")})
    except OSError:
        return []


if __name__ == "__main__":
    load_detections()
    classifier.load_async()
    threading.Thread(target=camera_worker, daemon=True).start()
    print(f"\n  Dashboard:  http://localhost:{PORT}")
    for addr in local_addresses():
        print(f"  Sensor node can reach this laptop at  {addr}:{PORT}")
    print()
    app.run(host="0.0.0.0", port=PORT, threaded=True)

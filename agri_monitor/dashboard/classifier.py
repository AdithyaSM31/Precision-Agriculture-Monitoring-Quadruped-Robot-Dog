"""Leaf disease classifier.

Wraps a MobileNetV2 fine-tuned on PlantVillage (38 classes, 14 crops). The model
downloads once from Hugging Face on first run and is cached afterwards, so run
the dashboard once with internet before demo day.
"""

import os
import threading
import time

import numpy as np

MODEL_ID = os.environ.get(
    "AGRI_MODEL", "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification"
)

# Below this top-1 confidence the result is reported as uncertain. A PlantVillage
# model always answers with one of its 38 classes, even for a photo of a wall,
# so low confidence is the only signal that the image is not a known leaf.
MIN_CONFIDENCE = float(os.environ.get("AGRI_MIN_CONFIDENCE", "0.5"))


CROPS = ("Corn (Maize)", "Bell Pepper", "Apple", "Blueberry", "Cherry", "Grape", "Orange",
         "Peach", "Potato", "Raspberry", "Soybean", "Squash", "Strawberry", "Tomato")


def describe(label):
    """Split a raw class name into (crop, condition, healthy).

    The model's labels come in several shapes - "Tomato with Early Blight",
    "Healthy Tomato Plant", "Apple Scab", "Cedar Apple Rust" - so the crop is
    found by name rather than by position.
    """
    text = " ".join(label.replace("___", " ").replace("_", " ").split())
    lower = text.lower()
    crop = next((c for c in CROPS if c.lower() in lower), text.split()[0])
    if "healthy" in lower:
        return crop, "Healthy", True
    if " with " in lower:
        return crop, text[lower.index(" with ") + 6:], False
    if lower.startswith(crop.lower() + " "):  # "Tomato Mosaic Virus"
        return crop, text[len(crop) + 1:], False
    return crop, text, False  # "Cedar Apple Rust"


class LeafClassifier:
    def __init__(self):
        self.model_id = MODEL_ID
        self.ready = False
        self.error = None
        self._pipe = None
        self._lock = threading.Lock()

    def load_async(self):
        threading.Thread(target=self._load, daemon=True).start()

    def _load(self):
        try:
            from transformers import pipeline

            t0 = time.time()
            self._pipe = pipeline("image-classification", model=self.model_id, device=-1)
            self.ready = True
            print(f"[classifier] {self.model_id} ready in {time.time() - t0:.1f} s")
        except Exception as exc:  # surfaced on the dashboard instead of crashing it
            self.error = f"{type(exc).__name__}: {exc}"
            print(f"[classifier] failed to load: {self.error}")

    def classify(self, image):
        """Classify a PIL image. Returns a dict, or None if the model is not ready."""
        if not self.ready:
            return None
        t0 = time.time()
        coverage = leaf_coverage(image)
        with self._lock:
            top = self._pipe(image.convert("RGB"), top_k=3)
        best = top[0]
        crop, condition, healthy = describe(best["label"])
        has_leaf = coverage >= MIN_LEAF_COVERAGE
        confident = has_leaf and best["score"] >= MIN_CONFIDENCE
        if not has_leaf:
            crop, condition = "No leaf", "No leaf in view - hold a leaf close to the camera"
        elif not confident:
            crop, condition = "Unknown", "Uncertain - not a recognised leaf"
        return {
            "label": best["label"],
            "crop": crop,
            "condition": condition,
            "healthy": healthy if confident else None,
            "confidence": round(float(best["score"]), 4),
            "confident": confident,
            "leaf_coverage": round(coverage, 3),
            "top3": [{"label": p["label"], "score": round(float(p["score"]), 4)} for p in top],
            "inference_ms": round((time.time() - t0) * 1000, 1),
        }


# The model has no "not a leaf" class, so it answers confidently even for a
# photo of a wall. This vegetation check runs first: it measures how much of
# the frame is leaf-coloured (green through yellow, reasonably saturated) -
# the same idea as the excess-green indices used in crop imaging. Walls, skin,
# wood and floors fall outside that hue band.
MIN_LEAF_COVERAGE = float(os.environ.get("AGRI_MIN_LEAF", "0.12"))


def leaf_coverage(image):
    hsv = np.asarray(image.convert("RGB").resize((160, 120)).convert("HSV"), dtype=np.float32)
    hue = hsv[..., 0] * (360 / 255)
    sat, val = hsv[..., 1] / 255, hsv[..., 2] / 255
    leafy = (hue >= 38) & (hue <= 165) & (sat >= 0.20) & (val >= 0.12)
    return float(leafy.mean())

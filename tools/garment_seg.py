"""Segmentación de prendas (u2net_cloth_seg, ONNX): devuelve máscaras de parte superior / inferior."""
import numpy as np, onnxruntime as ort, cv2
from PIL import Image

_sess = {}
def _s(path):
    if path not in _sess:
        _sess[path] = ort.InferenceSession(path, providers=['CPUExecutionProvider'])
    return _sess[path]

def cloth_masks(img_rgb: np.ndarray, model: str):
    h, w = img_rgb.shape[:2]
    x = cv2.resize(img_rgb, (768, 768), interpolation=cv2.INTER_LANCZOS4).astype(np.float32) / 255.0
    x = (x - np.array([0.485, 0.456, 0.406])) / np.array([0.229, 0.224, 0.225])
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    s = _s(model)
    out = s.run(None, {s.get_inputs()[0].name: x})[0][0]  # (4,768,768)
    prob = np.exp(out - out.max(0)); prob /= prob.sum(0)
    upper = cv2.resize(prob[1] + prob[3] * 0.5, (w, h))
    lower = cv2.resize(prob[2] + prob[3] * 0.5, (w, h))
    return upper, lower

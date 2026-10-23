"""Pixel diff of two PNGs: python img_diff.py a.png b.png  -> max/mean abs diff (0-255), fraction of differing pixels, PSNR."""
import sys, numpy as np
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert("RGB"), dtype=np.int16); b = np.asarray(Image.open(sys.argv[2]).convert("RGB"), dtype=np.int16)
d = np.abs(a - b); mse = (d.astype(float) ** 2).mean()
print({"max": int(d.max()), "mean": round(float(d.mean()), 4), "frac_pixels_differing": round(float((d.sum(axis=2) > 0).mean()), 4), "psnr_db": None if mse == 0 else round(10 * np.log10(255 ** 2 / mse), 1)})

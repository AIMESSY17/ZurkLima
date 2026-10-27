"""Genera frames/m/: versión liviana del timelapse para celular o ahorro de datos.
1 de cada 2 fotogramas de frames/ (54 de 108), 640 px de ancho, webp calidad 45.
El fotograma frames/m/fNNN.webp corresponde a frames/f(2N-1).webp.
Uso: python tools/build-frames-m.py   (necesita Pillow)"""
import os, glob
from PIL import Image
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sorted(glob.glob(os.path.join(root, 'frames', 'f*.webp')))
out = os.path.join(root, 'frames', 'm'); os.makedirs(out, exist_ok=True)
tot = 0
for k, f in enumerate(src[::2]):
    im = Image.open(f).convert('RGB')
    im = im.resize((640, round(im.height * 640 / im.width)), Image.LANCZOS)
    p = os.path.join(out, 'f%03d.webp' % (k + 1)); im.save(p, 'WEBP', quality=45, method=6); tot += os.path.getsize(p)
print(len(src[::2]), 'fotogramas ·', tot // 1024, 'KB')

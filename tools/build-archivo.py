"""Genera las imágenes del ARCHIVO (galería) a partir de fotos/ (los originales no se tocan).
  img/archivo/sm/zk-XX.webp  -> miniatura ~480 px de ancho (la grilla)
  img/archivo/lg/zk-XX.webp  -> foto grande, lado mayor 1800 px (solo en el visor)
  js/archivo-data.js         -> lista de fotos con tamaño, categoría y texto alternativo
Uso: python tools/build-archivo.py
"""
import json, os, glob
from PIL import Image, ImageOps

# id: (categoría, texto alternativo)
INFO = {
 'zk-01': ('retratos', 'Sujeto con gorro y campera roja frente a una computadora en un estudio oscuro'),
 'zk-02': ('retratos', 'Sujeto con pasamontañas y buzo ZURKLIMA frente a una persiana azul'),
 'zk-03': ('retratos', 'Sujeto con pasamontañas señalando a cámara'),
 'zk-04': ('calle', 'Cassette Sony ZX60 bajo luz cálida'),
 'zk-05': ('retratos', 'Espalda con tatuaje en la nuca y buzo negro'),
 'zk-06': ('calle', 'Persona en un parque mostrando la espalda de su buzo'),
 'zk-07': ('calle', 'Sombras de manos proyectadas sobre una pared azul'),
 'zk-08': ('retratos', 'Retrato de perfil con tatuajes en la cara y el cuello'),
 'zk-09': ('calle', 'Chica con anteojos de sol entre taxis amarillos'),
 'zk-10': ('calle', 'Retrato en blanco y negro con capucha frente a un edificio'),
 'zk-11': ('calle', 'Espalda de buzo con estampa, al aire libre'),
 'zk-12': ('retratos', 'Nuca con tatuaje en primer plano'),
 'zk-13': ('calle', 'Persona caminando de noche junto a una estación de servicio'),
 'zk-14': ('calle', 'Encapuchado fumando en una estación de servicio de noche'),
 'zk-15': ('calle', 'Chica apoyada en una vidriera mirando a cámara'),
 'zk-16': ('retratos', 'Sujeto con gorra en un taller'),
 'zk-17': ('retratos', 'Sujeto detrás de una reja en un taller'),
 'zk-18': ('calle', 'Dos chicos con gorra al atardecer frente al lago'),
 'zk-19': ('en-vivo', 'Cantante con gorra blanca y micrófono en un show'),
 'zk-20': ('en-vivo', 'Rapero con gorra y camiseta verde rapeando en vivo'),
 'zk-21': ('retratos', 'Retrato nocturno de un hombre con anteojos bajo luz de calle'),
}

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sm_dir = os.path.join(root, 'img', 'archivo', 'sm'); lg_dir = os.path.join(root, 'img', 'archivo', 'lg')
os.makedirs(sm_dir, exist_ok=True); os.makedirs(lg_dir, exist_ok=True)
items = []
for f in sorted(glob.glob(os.path.join(root, 'fotos', 'zk-*.*'))):
    id_ = os.path.splitext(os.path.basename(f))[0]
    im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
    w, h = im.size
    sm = im.resize((480, round(h * 480 / w)), Image.LANCZOS)
    sm.save(os.path.join(sm_dir, id_ + '.webp'), 'WEBP', quality=72, method=6)
    k = min(1, 1800 / max(w, h)); lg = im.resize((round(w * k), round(h * k)), Image.LANCZOS) if k < 1 else im
    lg.save(os.path.join(lg_dir, id_ + '.webp'), 'WEBP', quality=82, method=6)
    cat, alt = INFO[id_]
    items.append({'id': id_, 'w': lg.width, 'h': lg.height, 'cat': cat, 'alt': alt})

with open(os.path.join(root, 'js', 'archivo-data.js'), 'w', encoding='utf-8', newline='\n') as o:
    o.write('/* Generado por tools/build-archivo.py — no editar a mano */\n')
    o.write('export const FOTOS = ' + json.dumps(items, ensure_ascii=False, indent=1) + ';\n')
print(len(items), 'fotos')

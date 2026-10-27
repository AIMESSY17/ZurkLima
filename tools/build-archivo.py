"""Genera las imágenes del ARCHIVO a partir de fotos/ (los originales no se tocan).
  img/archivo/sm/zk-XX.webp  -> miniatura 480 px de ancho (grilla de respaldo)
  img/archivo/lg/zk-XX.webp  -> foto grande, lado mayor 1800 px (solo en el visor)
  img/archivo/atlas.webp     -> las fotos en una sola imagen (celdas de 448 px) para el muro WebGL
  js/archivo-data.js         -> lista de fotos: tamaño, categoría, texto alternativo, zona de la cabeza y celda del atlas
Uso: python tools/build-archivo.py   (necesita Pillow)
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

# zona de la cabeza/objeto (x0,y0,x1,y1 normalizado 0-1) y tipo, para la caja de análisis y el encuadre:
# 'rostro' = cara visible · 'espalda' = de espaldas · 'objeto' = sin persona
BOX = {
 'zk-01': ('rostro', (.14,.33,.42,.56)), 'zk-02': ('rostro', (.40,.04,.60,.46)), 'zk-03': ('rostro', (.44,.00,.64,.36)),
 'zk-04': ('objeto', (.55,.15,.85,.42)), 'zk-05': ('espalda', (.18,.00,.66,.38)), 'zk-06': ('espalda', (.48,.00,.78,.20)),
 'zk-07': ('objeto', (.55,.25,.80,.55)), 'zk-08': ('rostro', (.22,.08,.76,.58)), 'zk-09': ('rostro', (.38,.40,.60,.56)),
 'zk-10': ('rostro', (.40,.28,.62,.44)), 'zk-11': ('espalda', (.32,.00,.64,.32)), 'zk-12': ('espalda', (.30,.05,.85,.60)),
 'zk-13': ('espalda', (.40,.02,.60,.22)), 'zk-14': ('rostro', (.36,.08,.64,.40)), 'zk-15': ('rostro', (.42,.08,.62,.32)),
 'zk-16': ('rostro', (.34,.36,.58,.60)), 'zk-17': ('rostro', (.38,.27,.62,.50)), 'zk-18': ('rostro', (.22,.36,.48,.58)),
 'zk-19': ('rostro', (.35,.15,.60,.42)), 'zk-20': ('rostro', (.38,.10,.60,.38)), 'zk-21': ('rostro', (.32,.10,.82,.68)),
}
CELL, ACOLS = 448, 7

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sm_dir = os.path.join(root, 'img', 'archivo', 'sm'); lg_dir = os.path.join(root, 'img', 'archivo', 'lg')
os.makedirs(sm_dir, exist_ok=True); os.makedirs(lg_dir, exist_ok=True)

files = sorted(glob.glob(os.path.join(root, 'fotos', 'zk-*.*')))
arows = (len(files) + ACOLS - 1) // ACOLS
atlas = Image.new('RGB', (CELL * ACOLS, CELL * arows), 'black')
AW, AH = atlas.size
items = []
for n, f in enumerate(files):
    id_ = os.path.splitext(os.path.basename(f))[0]
    im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
    w, h = im.size
    im.resize((480, round(h * 480 / w)), Image.LANCZOS).save(os.path.join(sm_dir, id_ + '.webp'), 'WEBP', quality=72, method=6)
    k = min(1, 1800 / max(w, h)); lg = im.resize((round(w * k), round(h * k)), Image.LANCZOS) if k < 1 else im
    lg.save(os.path.join(lg_dir, id_ + '.webp'), 'WEBP', quality=82, method=6)
    # celda del atlas: la foto entera, encajada y centrada
    k2 = CELL / max(w, h); cw, ch = round(w * k2), round(h * k2)
    x0 = (n % ACOLS) * CELL + (CELL - cw) // 2; y0 = (n // ACOLS) * CELL + (CELL - ch) // 2
    atlas.paste(im.resize((cw, ch), Image.LANCZOS), (x0, y0))
    cat, alt = INFO[id_]; tipo, box = BOX[id_]
    items.append({'id': id_, 'w': lg.width, 'h': lg.height, 'cat': cat, 'alt': alt, 'tipo': tipo, 'box': box,
                  'uv': [round(x0 / AW, 5), round(y0 / AH, 5), round((x0 + cw) / AW, 5), round((y0 + ch) / AH, 5)]})

atlas.save(os.path.join(root, 'img', 'archivo', 'atlas.webp'), 'WEBP', quality=78, method=6)
with open(os.path.join(root, 'js', 'archivo-data.js'), 'w', encoding='utf-8', newline='\n') as o:
    o.write('/* Generado por tools/build-archivo.py — no editar a mano */\n')
    o.write('export const ATLAS = ' + json.dumps({'src': 'img/archivo/atlas.webp', 'w': AW, 'h': AH}) + ';\n')
    o.write('export const FOTOS = ' + json.dumps(items, ensure_ascii=False) .replace('}, {', '},\n {') + ';\n')
print(len(items), 'fotos · atlas', AW, 'x', AH)

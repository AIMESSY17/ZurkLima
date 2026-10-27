"""Genera las imágenes y los datos del ARCHIVO a partir de fotos/ (los originales no se tocan).

Fuente editable a mano: datos/fotos.json (una entrada por foto). Este script:
  - completa lo que falte en cada entrada y, si completó algo, vuelve a guardar el JSON:
      codigo     "ZK-001" a partir del número del archivo
      fecha      al azar entre 2024-01-01 y el día en que se genera (semilla fija por foto)
      hora       al azar entre 19:00 y 03:59 (fotografía nocturna, misma semilla)
      lugar      "Neuquén"
      fotografo  "Bruno — ZURKLIMA"
    Lo que ya está en el JSON NO se regenera: se puede editar a mano sin miedo.
  - si hay una foto nueva en fotos/ sin entrada, le crea una con valores de relleno para completar.
Salidas:
  img/archivo/sm/zk-XX.webp  -> miniatura 480 px de ancho (grilla de respaldo)
  img/archivo/lg/zk-XX.webp  -> foto grande, lado mayor 1800 px (solo en la ficha técnica)
  img/archivo/atlas.webp     -> las fotos en una sola imagen (celdas de 448 px) para el muro WebGL
  js/archivo-data.js         -> lista de fotos para la web
Uso: python tools/build-archivo.py   (necesita Pillow)
"""
import json, os, re, glob, random, datetime
from PIL import Image, ImageOps

CELL, ACOLS = 448, 7
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
datos_path = os.path.join(root, 'datos', 'fotos.json')
sm_dir = os.path.join(root, 'img', 'archivo', 'sm'); lg_dir = os.path.join(root, 'img', 'archivo', 'lg')
os.makedirs(sm_dir, exist_ok=True); os.makedirs(lg_dir, exist_ok=True)

datos = json.load(open(datos_path, encoding='utf-8')) if os.path.exists(datos_path) else []
by_id = {d['id']: d for d in datos}
files = sorted(glob.glob(os.path.join(root, 'fotos', 'zk-*.*')))

# ---- completar datos que falten (una sola vez; queda guardado en el JSON) ----
cambio = False
D0 = datetime.date(2024, 1, 1)
for f in files:
    id_ = os.path.splitext(os.path.basename(f))[0]
    d = by_id.get(id_)
    if d is None:
        d = {'id': id_, 'titulo': 'Sin título', 'categoria': 'calle', 'alt': 'Fotografía de ZURKLIMA',
             'tipo': 'objeto', 'box': [.35, .3, .65, .6]}
        datos.append(d); by_id[id_] = d; cambio = True
        print('foto nueva sin datos:', id_, '-> completar titulo/categoria/alt/tipo/box en datos/fotos.json')
    rnd = random.Random('zurklima-' + id_)   # semilla fija por foto
    defaults = {
        'codigo': 'ZK-' + id_.split('-')[1].zfill(3),
        'fecha': (D0 + datetime.timedelta(days=rnd.randrange((datetime.date.today() - D0).days + 1))).isoformat(),
        'hora': '%02d:%02d' % ((19 + rnd.randrange(9)) % 24, rnd.randrange(60)),
        'lugar': 'Neuquén',
        'fotografo': 'Bruno — ZURKLIMA',
    }
    for k, v in defaults.items():
        if not d.get(k):
            d[k] = v; cambio = True

ORDEN = ['id', 'codigo', 'titulo', 'categoria', 'fecha', 'hora', 'lugar', 'fotografo', 'alt', 'tipo', 'box']
if cambio:
    datos.sort(key=lambda d: d['id'])
    datos = [{k: d[k] for k in ORDEN if k in d} | {k: v for k, v in d.items() if k not in ORDEN} for d in datos]
    with open(datos_path, 'w', encoding='utf-8', newline='\n') as o:
        txt = json.dumps(datos, ensure_ascii=False, indent=2)
        txt = re.sub(r'\[\s+([^\[\]]*?)\s+\]', lambda m: '[' + re.sub(r'\s+', ' ', m.group(1)) + ']', txt)  # box en una línea
        o.write(txt + '\n')
    by_id = {d['id']: d for d in datos}
    print('datos/fotos.json actualizado')

# ---- imágenes ----
arows = (len(files) + ACOLS - 1) // ACOLS
atlas = Image.new('RGB', (CELL * ACOLS, CELL * arows), 'black')
AW, AH = atlas.size
items = []
for n, f in enumerate(files):
    id_ = os.path.splitext(os.path.basename(f))[0]
    d = by_id[id_]
    im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
    w, h = im.size
    im.resize((480, round(h * 480 / w)), Image.LANCZOS).save(os.path.join(sm_dir, id_ + '.webp'), 'WEBP', quality=72, method=6)
    k = min(1, 1800 / max(w, h)); lg = im.resize((round(w * k), round(h * k)), Image.LANCZOS) if k < 1 else im
    lg.save(os.path.join(lg_dir, id_ + '.webp'), 'WEBP', quality=82, method=6)
    # celda del atlas: la foto entera, encajada y centrada
    k2 = CELL / max(w, h); cw, ch = round(w * k2), round(h * k2)
    x0 = (n % ACOLS) * CELL + (CELL - cw) // 2; y0 = (n // ACOLS) * CELL + (CELL - ch) // 2
    atlas.paste(im.resize((cw, ch), Image.LANCZOS), (x0, y0))
    items.append({'id': id_, 'codigo': d['codigo'], 'titulo': d['titulo'], 'cat': d['categoria'],
                  'fecha': d['fecha'], 'hora': d['hora'], 'lugar': d['lugar'], 'fotografo': d['fotografo'],
                  'w': lg.width, 'h': lg.height, 'alt': d['alt'], 'tipo': d['tipo'], 'box': d['box'],
                  'uv': [round(x0 / AW, 5), round(y0 / AH, 5), round((x0 + cw) / AW, 5), round((y0 + ch) / AH, 5)]})

atlas.save(os.path.join(root, 'img', 'archivo', 'atlas.webp'), 'WEBP', quality=78, method=6)
with open(os.path.join(root, 'js', 'archivo-data.js'), 'w', encoding='utf-8', newline='\n') as o:
    o.write('/* Generado por tools/build-archivo.py a partir de datos/fotos.json — no editar a mano */\n')
    o.write('export const ATLAS = ' + json.dumps({'src': 'img/archivo/atlas.webp', 'w': AW, 'h': AH}) + ';\n')
    o.write('export const FOTOS = ' + json.dumps(items, ensure_ascii=False).replace('}, {', '},\n {') + ';\n')
print(len(items), 'fotos · atlas', AW, 'x', AH)

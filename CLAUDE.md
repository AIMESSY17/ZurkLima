# ZURKLIMA — reglas del proyecto

Web de **ZURKLIMA**, la marca del fotógrafo **Bruno**, de **Neuquén** (Argentina).
Concepto de toda la web: **cámaras de vigilancia** — visión nocturna verde, HUD de cámara de seguridad,
corchetes amarillos, alertas rojas, anotaciones con líneas punteadas. Estilo trap/rap, flashero pero profesional.

## Marca
- Marca: **ZURKLIMA**. Fotógrafo: **Bruno**. Ciudad: **Neuquén**.
- **Nunca** usar "Yo, Zur" ni "yo.zur" en textos visibles. (La única excepción es la URL de Instagram
  `https://www.instagram.com/yo.zur/`, que se linkea sin mostrar el usuario en texto.)
- Logo: [assets/logo-zurklima.svg](assets/logo-zurklima.svg) (vector blanco, redibujado del PNG chico
  `assets/logo-zurklima.png`). Es el elemento "display": no hay fuente gótica.

## Paleta (tokens en `:root`, [css/styles.css](css/styles.css))
| token | color | uso |
|---|---|---|
| `--void` | `#030603` | fondo (negro con sesgo verde) |
| `--nv` | `#8CFF5A` | fósforo de visión nocturna |
| `--amber` | `#FFD23A` | corchetes, advertencias, botones |
| `--alert` | `#FF2B2B` | lock, peligro, sellos |
| `--ink` | `#F1F4EC` | texto de anotaciones |

Usar siempre los tokens, no colores sueltos.

## Fuentes
- **VT323** (`--f-digit`): números y HUD.
- **Courier Prime** (`--f-note`): anotaciones.
- **IBM Plex Mono** (`--f-ui`): interfaz.
- **Logo ZURKLIMA** como display.

## Idioma
- Textos de la ficha y de la interfaz: **español**.
- Comandos de cámara / consola / etiquetas técnicas del HUD: **inglés** (`> enhance --x8`, `TARGET LOCKED`).

## Estructura
- `index.html` — solo estructura.
- `css/styles.css` — estilos.
- `js/inicio.js` — arranque: si hay WebGL carga `js/fondo.js`; si no, deja el fotograma congelado fijo.
- `js/fondo.js` — fondo WebGL manejado por scroll, HUD, consola (módulo ES).
- `js/turno.js` — turno de WebGL: el muro y el fondo nunca animan a la vez (el muro tiene prioridad).
- `js/muro.js` — MURO INFINITO del archivo (WebGL con OGL): una malla instanciada, sin nodos DOM por foto.
- `js/vendor/ogl.min.js` — OGL 1.0.11 (Unlicense), solo las piezas que se usan.
- `js/deteccion.js` — exporta `DET` (cajas de personas por fotograma).
- `js/archivo.js` — ARCHIVO: elige muro o grilla, filtros, visor de detalle, anclas con scroll suave.
- `js/archivo-data.js` — lista de fotos (GENERADO, no editar a mano).
- `frames/` fotogramas del timelapse · `img/` freeze, retrato y evidencias de la ficha.
- `fotos/` — originales de Bruno (no se sirven directo, no tocar).
- `img/archivo/atlas.webp` — las 21 fotos en una sola textura (celdas 448 px) para el muro.
- `img/archivo/sm/` miniaturas 480 px webp (grilla de respaldo) · `img/archivo/lg/` 1800 px webp (solo en el visor).
- `assets/` — logo SVG, favicon, `og.jpg` (imagen para compartir), PNG y video originales.
- `referencias/` — imágenes de referencia de estilo (no se publican en la web).

## Secciones (en orden)
1. Fondo `#track/#stage` (CAM 07 → ficha/expediente).
2. `#archivo` — "ARCHIVO // EVIDENCIA" + filtros TODO / RETRATOS / CALLE / EN VIVO + MURO INFINITO.
3. `#contacto` — "REPORTAR AVISTAMIENTO": Instagram (DM `https://ig.me/m/yo.zur` y perfil).
4. Pie — logo, "FIN DE TRANSMISIÓN", volver arriba.

## Muro infinito (`js/muro.js`)
- Columnas de anchos/alturas variadas que se repiten con módulo en las dos direcciones (nunca se termina).
  Las posiciones se calculan en JS y van como atributos instanciados; nada de layout del DOM por frame.
- **Sin repetidas a la vista** (filtro TODO): el muro es un "toro" con una casilla por foto; el período
  horizontal (BW) y el vertical de cada columna (P) son más grandes que la pantalla + una casilla, así que
  ninguna foto puede verse dos veces. Por eso los monitores crecen en pantallas grandes. La cantidad de
  columnas se elige sola según el tamaño. Con filtros de pocas fotos las repetidas son inevitables (se
  reparten para que no queden pegadas). Prueba: `wrap._muroDebug.visibles()` / `panTo(x,y)`.
- Arrastre (mouse/touch) y rueda con inercia; curvatura "tela" según la velocidad (vuelve a plano al frenar).
- Hover: escaneo verde → color, corchetes amarillos y caja de análisis (zona de la cabeza = `BOX` en
  `tools/build-archivo.py`; tipos rostro / espalda / objeto). Cursor tipo mira.
- Clic/tap sin arrastre (< 6 px) abre el visor (en el evento `click`, no en `pointerup`). Arrastrar nunca abre.
- Filtros: estática de "cambio de canal" y el muro se rearma con esa categoría.
- Rueda (desktop): la rueda vertical **siempre** scrollea la página (nunca `preventDefault` en deltaY);
  mientras el muro está en pantalla, además deriva solo con el scroll (~0.35 del recorrido).
  El scroll horizontal del trackpad (deltaX) y Shift+rueda mueven el muro a los costados (ahí sí se
  cancela el scroll). Arrastrar mueve libre en todas direcciones. "↓ SEGUIR" queda como atajo.
- Táctil: vista previa quieta que no captura el scroll + "ENTRAR A LA SALA DE MONITOREO" → pantalla
  completa (`position:fixed`, `touch-action:none`, `history.pushState`; se sale con ✕ SALIR o el gesto atrás).
- El rAF se apaga solo cuando no hay nada que mover; IntersectionObserver + `turno` con el fondo.
- Respaldo: sin WebGL o con `prefers-reduced-motion` se muestra la grilla clásica. Con el muro activo,
  la grilla queda como lista oculta accesible: Tab centra/analiza el monitor y Enter abre el visor;
  "Saltar al archivo" abre el visor en la primera evidencia.

## Agregar o cambiar fotos del archivo
Los datos de cada foto viven en **`datos/fotos.json`** (se edita a mano, sin tocar Python):
```json
{ "id": "zk-14", "codigo": "ZK-014", "titulo": "Humo en la estación", "categoria": "calle",
  "fecha": "2025-03-14", "hora": "22:14", "lugar": "Neuquén", "fotografo": "Bruno — ZURKLIMA",
  "alt": "texto alternativo", "tipo": "rostro|espalda|objeto", "box": [x1, y1, x2, y2] }
```
- `titulo`: corto (2 a 4 palabras), sacado de la foto; **no describir a las personas por rasgos físicos**.
- `categoria`: `retratos` · `calle` · `en-vivo`.
- `tipo` + `box`: zona de la cabeza (u objeto) normalizada 0–1; la usan el muro (caja de análisis y encuadre)
  y la ficha técnica (puntos y cotas).
- `fecha` / `hora`: si faltan, el build las genera **una sola vez** (semilla fija; fecha entre 2024-01-01 y el
  día del build, hora entre 19:00 y 03:59) y las guarda en el JSON. Si ya están, no se tocan.

Pasos:
1. Copiar la foto a `fotos/` como `zk-XX.jpg|webp`.
2. `python tools/build-archivo.py` (necesita Pillow). Si la foto es nueva le crea una entrada de relleno en
   `datos/fotos.json`: completar título, categoría, alt, tipo y box, y volver a correr el build.
3. El build regenera miniaturas, grandes, atlas y `js/archivo-data.js` (no editar ese archivo a mano).
   (El atlas tiene 7 columnas de 448 px: con más de 63 fotos habría que agrandarlo.)

## Publicar
Es un sitio estático: subir la carpeta tal cual (Netlify, Cloudflare Pages, GitHub Pages, Vercel).
Cuando haya dominio, poner la URL absoluta en `og:image` (`https://DOMINIO/assets/og.jpg`).

## Desarrollo
- `npm run dev` y abrir http://localhost:3000 (con doble clic / `file://` el WebGL no carga las imágenes).
- **Mobile primero**: probar siempre a **390x844** (y también 1440x860).
- Consola del navegador: cero errores.

## Fondo
- **No cambiar la línea de tiempo del fondo** (fases, porcentajes de scroll, fotograma congelado 61,
  sujeto, zoom, enhance, match, ficha) salvo que se pida explícitamente.

## Reglas anti-lag (aplican a todo)
- Nada de `backdrop-filter` / blur encima de zonas que se mueven.
- Grano, cursor y efectos que se mezclan arriba: pausarlos sobre la galería.
- Miniaturas livianas (~400 px, webp) para lo que se mueve; la foto grande solo al abrir el detalle.
- Un solo `requestAnimationFrame` por efecto, y pausarlo con `IntersectionObserver` cuando no está en
  pantalla (el fondo WebGL se pausa cuando bajás a la galería, y al revés).
- `devicePixelRatio` máximo **1.5** en WebGL; si los FPS bajan, bajar la resolución sola (calidad adaptativa).
- Nunca dos contextos WebGL animando al mismo tiempo.

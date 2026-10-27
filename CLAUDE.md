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
- `js/fondo.js` — fondo WebGL manejado por scroll, HUD, consola (módulo ES).
- `js/deteccion.js` — exporta `DET` (cajas de personas por fotograma).
- `js/archivo.js` — ARCHIVO (galería): grilla, filtros, visor de detalle, anclas con scroll suave.
- `js/archivo-data.js` — lista de fotos (GENERADO, no editar a mano).
- `frames/` fotogramas del timelapse · `img/` freeze, retrato y evidencias de la ficha.
- `fotos/` — originales de Bruno (no se sirven directo, no tocar).
- `img/archivo/sm/` miniaturas 480 px webp (grilla) · `img/archivo/lg/` 1800 px webp (solo en el visor).
- `assets/` — logo SVG, favicon, `og.jpg` (imagen para compartir), PNG y video originales.
- `referencias/` — imágenes de referencia de estilo (no se publican en la web).

## Secciones (en orden)
1. Fondo `#track/#stage` (CAM 07 → ficha/expediente).
2. `#archivo` — "ARCHIVO // EVIDENCIA": fotos en verde visión nocturna, a color al pasar el mouse
   o en el visor. Filtros: TODO / RETRATOS / CALLE / EN VIVO.
3. `#contacto` — "REPORTAR AVISTAMIENTO": Instagram (DM `https://ig.me/m/yo.zur` y perfil).
4. Pie — logo, "FIN DE TRANSMISIÓN", volver arriba.

## Agregar o cambiar fotos del archivo
1. Copiar la foto a `fotos/` como `zk-XX.jpg|webp`.
2. Agregar su categoría y texto alternativo en `INFO` dentro de `tools/build-archivo.py`.
3. `python tools/build-archivo.py` (necesita Pillow) → regenera miniaturas, grandes y `js/archivo-data.js`.

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

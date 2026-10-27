/* Arranque del fondo: si el navegador no tiene WebGL, no se carga js/fondo.js
   (se rompería y el cartel de carga taparía la página). En su lugar queda el
   fotograma congelado como imagen fija y el resto de la web funciona igual. */
const cv = document.getElementById('gl');
// mismo pedido de contexto que hace fondo.js, así reutiliza este mismo contexto
const gl = cv.getContext('webgl', {antialias: false, premultipliedAlpha: false});
if (gl) {
  import('./fondo.js');
} else {
  document.documentElement.classList.add('sin-webgl');
  document.getElementById('boot').classList.add('gone');
}

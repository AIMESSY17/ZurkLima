/* Turno de WebGL: nunca dos contextos animando a la vez.
   - muro: cuando el muro del archivo está en pantalla (o abierto a pantalla completa) tiene prioridad
     y el fondo de la cámara se pausa; cuando el muro sale, el fondo puede volver a animar.
   - ficha: con la ficha técnica abierta no anima ninguno de los dos (0 requestAnimationFrame). */
const subs = new Set();
export const turno = {
  muro: false,
  ficha: false,
  set(v) { if (this.muro === v) return; this.muro = v; subs.forEach(f => f()); },
  setFicha(v) { if (this.ficha === v) return; this.ficha = v; subs.forEach(f => f()); },
  on(f) { subs.add(f); },
};

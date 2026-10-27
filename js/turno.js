/* Turno de WebGL: nunca dos contextos animando a la vez.
   Cuando el muro del archivo está en pantalla (o abierto a pantalla completa) tiene prioridad
   y el fondo de la cámara se pausa; cuando el muro sale, el fondo puede volver a animar. */
const subs = new Set();
export const turno = {
  muro: false,
  set(v) { if (this.muro === v) return; this.muro = v; subs.forEach(f => f()); },
  on(f) { subs.add(f); },
};

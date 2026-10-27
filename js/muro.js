/* MURO INFINITO del ARCHIVO (WebGL con OGL)
   - Un plano infinito de "monitores": columnas de anchos/alturas variadas que se repiten
     con módulo (horizontal: período BW · vertical: cada columna con su propio período).
     Las fotos se reciclan: no se crean nodos; es UNA sola malla instanciada y las posiciones
     se calculan en JS y se mandan como atributos (sin layout del DOM por frame).
   - Etiquetas EV/CAM/categoría/hora: textura generada una vez en un canvas.
   - Un solo requestAnimationFrame que se apaga solo cuando no hay nada que mover,
     y que solo corre con el muro en pantalla (IntersectionObserver + turno con el fondo).
   - DPR máximo 1.5 y calidad adaptativa si bajan los FPS. */
import {Renderer, Program, Mesh, Geometry, Texture, Plane} from './vendor/ogl.min.js';
import {ATLAS} from './archivo-data.js';
import {turno} from './turno.js';

const MAX = 600;                 // instancias máximas por frame
const SW = 96, SH = 20, LS = 2;  // casilla de etiqueta (px css) y escala de su textura
const PAD = 8;
const AMB = '#FFD23A', RED = '#FF2B2B', NV = '#8CFF5A', INK = '#F1F4EC';
const COLF = [1, .84, 1.12, .92, 1.04, .8, .96, 1.08];      // anchos relativos de columna
const RAT = [1.25, .82, 1.06, 1.38, .78, 1.18, .94, 1.3, .88]; // alto/ancho de los monitores

const VS = /* glsl */`
attribute vec2 uv;
attribute vec4 aRect;   // x, y, ancho, alto (px css, origen arriba-izq)
attribute vec4 aCrop;   // recorte dentro del atlas
attribute vec4 aInfo;   // foto, hover
uniform vec2 uRes;
uniform vec2 uVel;
varying vec2 vUv; varying vec4 vCrop; varying vec2 vSize; varying float vPhoto; varying float vHov;
void main(){
  vec2 l = vec2(uv.x, 1. - uv.y);
  vec2 p = aRect.xy + l * aRect.zw;
  vec2 n = p / uRes * 2. - 1.;
  // tela: el centro se atrasa más que los bordes cuando el muro se mueve rápido
  p -= uVel * (1. - .6 * dot(n, n)) * 1.1;
  vec2 c = p / uRes * 2. - 1.;
  gl_Position = vec4(c.x, -c.y, 0., 1.);
  vUv = l; vCrop = aCrop; vSize = aRect.zw; vPhoto = floor(aInfo.x + .5); vHov = aInfo.y;
}`;

const FS = /* glsl */`
precision highp float;
uniform sampler2D tAtlas, tLab;
uniform float uRows, uPad, uCompact, uStatic, uTime;
uniform vec2 uSlot;
varying vec2 vUv; varying vec4 vCrop; varying vec2 vSize; varying float vPhoto; varying float vHov;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec4 lab(vec2 lp, vec2 o, float s){
  vec2 q = (lp - o) / uSlot;
  if (q.x < 0. || q.y < 0. || q.x > 1. || q.y > 1.) return vec4(0.);
  return texture2D(tLab, vec2((s + q.x) * .25, (vPhoto + q.y) / uRows));
}
void main(){
  vec3 c = texture2D(tAtlas, mix(vCrop.xy, vCrop.zw, vUv)).rgb;
  float l = dot(c, vec3(.299, .587, .114));
  vec3 nv = vec3(.6, 1., .4) * pow(clamp(l * 1.3, 0., 1.), 1.05) + vec3(.012, .03, .008);
  float h = vHov, sw = h * 1.12;
  float rev = h > .001 ? step(vUv.y, sw - .04) : 0.;          // a color por arriba de la línea
  vec3 col = mix(nv, c * 1.06, rev);
  float line = (h > .001 && h < .999) ? exp(-abs(vUv.y - sw) * vSize.y * .3) : 0.;
  col += vec3(.55, 1., .35) * line * .9;                      // línea de escaneo
  col *= mix(.8 + .2 * step(1., mod(gl_FragCoord.y, 3.)), 1., rev * .7); // líneas de monitor (quietas)
  vec2 lp = vUv * vSize; vec4 a;
  a = lab(lp, vec2(uPad), 0.);                                col = mix(col, a.rgb, a.a);
  a = lab(lp, vec2(vSize.x - uPad - uSlot.x, uPad), 1.);      col = mix(col, a.rgb, a.a);
  a = lab(lp, vec2(uPad, vSize.y - uPad - uSlot.y), 2.);      col = mix(col, a.rgb, a.a);
  if (uCompact < .5) { a = lab(lp, vSize - uPad - uSlot, 3.); col = mix(col, a.rgb, a.a); }
  vec2 d = min(lp, vSize - lp);
  col = mix(col, vec3(.95, .96, .92), (1. - step(1., min(d.x, d.y))) * .2);   // borde fino
  if (h > 0.) {                                                // corchetes amarillos
    vec2 q = d - 6.;
    float k = (q.x >= 0. && q.y >= 0. && ((q.x < 2. && q.y < 16.) || (q.y < 2. && q.x < 16.))) ? 1. : 0.;
    col = mix(col, vec3(1., .824, .227), k * clamp(h * 3., 0., 1.));
  }
  if (uStatic > 0.) {                                          // estática de "cambio de canal"
    float s = hash(floor(gl_FragCoord.xy * .5) + fract(uTime) * 97.);
    float band = step(.9, hash(vec2(floor(gl_FragCoord.y * .05), floor(uTime * 30.))));
    col = mix(col, vec3(s) * vec3(.75, 1., .7) + band * .3, uStatic);
  }
  gl_FragColor = vec4(col, 1.);
}`;

function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function initMuro({wrap, fotos, labels, onOpen}) {
  const cv = wrap.querySelector('.muro-gl'), fx = wrap.querySelector('.muro-fx');
  const ctxAttrs = {alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance'};
  if (!(cv.getContext('webgl2', ctxAttrs) || cv.getContext('webgl', ctxAttrs))) return null;
  const html = document.documentElement;
  const touchMode = matchMedia('(hover: none) and (pointer: coarse)').matches;
  wrap.classList.toggle('touch', touchMode);

  let quality = 1;
  const dprOf = () => Math.min(devicePixelRatio || 1, 1.5) * quality;
  const renderer = new Renderer({canvas: cv, dpr: dprOf(), alpha: false, antialias: false, depth: false, webgl: 2});
  const gl = renderer.gl;
  gl.clearColor(3 / 255, 6 / 255, 3 / 255, 1);
  const fctx = fx.getContext('2d');

  /* ---------- malla instanciada ---------- */
  const pl = new Plane(gl, {widthSegments: 10, heightSegments: 10});
  const aRect = new Float32Array(MAX * 4), aCrop = new Float32Array(MAX * 4), aInfo = new Float32Array(MAX * 4);
  const geo = new Geometry(gl, {
    position: {size: 3, data: pl.attributes.position.data},
    uv: {size: 2, data: pl.attributes.uv.data},
    index: {data: pl.attributes.index.data},
    aRect: {instanced: 1, size: 4, data: aRect, usage: gl.DYNAMIC_DRAW},
    aCrop: {instanced: 1, size: 4, data: aCrop, usage: gl.DYNAMIC_DRAW},
    aInfo: {instanced: 1, size: 4, data: aInfo, usage: gl.DYNAMIC_DRAW},
  });
  const texOpts = {generateMipmaps: false, flipY: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR};
  const tAtlas = new Texture(gl, texOpts), tLab = new Texture(gl, texOpts);
  const program = new Program(gl, {
    vertex: VS, fragment: FS, cullFace: false, depthTest: false, depthWrite: false,
    uniforms: {
      tAtlas: {value: tAtlas}, tLab: {value: tLab}, uRes: {value: [1, 1]}, uVel: {value: [0, 0]},
      uRows: {value: fotos.length}, uSlot: {value: [SW, SH]}, uPad: {value: PAD}, uCompact: {value: 0},
      uStatic: {value: 0}, uTime: {value: 0},
    },
  });
  const mesh = new Mesh(gl, {geometry: geo, program});
  mesh.frustumCulled = false;

  /* ---------- estado ---------- */
  let list = fotos.map((_, i) => i), cols = [], BW = 1, vw = 1, vh = 1, base = 0;
  const pos = {x: 0, y: 0}, tgt = {x: 0, y: 0}, bend = {x: 0, y: 0};
  let visible = false, full = false, running = false, ready = false, dragging = false;
  let tap = null, down = null, ptr = null, kbd = -1, hk = null, hoverInfo = null, fxDirty = false;
  const hov = new Map();
  let statT0 = -1, pendingList = null, lastNow = 0, ftAvg = 16.7, ftN = 0;

  // recorte "cover" centrado en la cabeza de cada foto, expresado en coordenadas del atlas
  function cropFor(p, w, h) {
    const f = fotos[p], uv = f.uv, du = uv[2] - uv[0], dv = uv[3] - uv[1];
    const pa = (du * ATLAS.w) / (dv * ATLAS.h), ta = w / h;
    const fxc = (f.box[0] + f.box[2]) / 2, fyc = (f.box[1] + f.box[3]) / 2;
    let c;
    if (ta > pa) { const fh = pa / ta, cy = Math.min(1 - fh / 2, Math.max(fh / 2, fyc + fh * .12)); c = [0, cy - fh / 2, 1, cy + fh / 2]; }
    else { const fw = ta / pa, cx = Math.min(1 - fw / 2, Math.max(fw / 2, fxc)); c = [cx - fw / 2, 0, cx + fw / 2, 1]; }
    const iu = .5 / ATLAS.w, iv = .5 / ATLAS.h;
    return {c, a: [uv[0] + c[0] * du + iu, uv[1] + c[1] * dv + iv, uv[0] + c[2] * du - iu, uv[1] + c[3] * dv - iv]};
  }

  function buildLayout() {
    base = vw < 520 ? 165 : vw < 1100 ? 215 : 255;
    const gap = Math.round(base * .06), n = list.length, r = rng(7 + n);
    const perm = [...list];
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    cols = []; let x = 0, t = 0;
    COLF.forEach((f, ci) => {
      const w = Math.round(base * f), nt = ci % 3 === 1 ? 5 : 4, tiles = []; let y = 0;
      for (let k = 0; k < nt; k++) {
        const h = Math.round(w * RAT[(ci * 4 + k * 3) % RAT.length]);
        let p = perm[t++ % n];
        if (n > 1 && tiles.length && tiles[tiles.length - 1].p === p) p = perm[t++ % n];
        const cr = cropFor(p, w, h);
        tiles.push({y, h, p, a: cr.a, c: cr.c}); y += h + gap;
      }
      cols.push({x, w, tiles, P: y, off: Math.round(r() * y)}); x += w + gap;
    });
    BW = x; hov.clear();
  }

  // recorre los monitores que caen en pantalla (+ margen); el módulo hace que nunca se terminen
  function forEachTile(M, cb) {
    const j0 = Math.floor((pos.x - M) / BW) - 1, j1 = Math.floor((pos.x + vw + M) / BW) + 1;
    for (let j = j0; j <= j1; j++) for (let ci = 0; ci < cols.length; ci++) {
      const c = cols[ci], sx = c.x + j * BW - pos.x;
      if (sx > vw + M || sx + c.w < -M) continue;
      const b = c.off - pos.y, m0 = Math.floor((-M - b) / c.P) - 1, m1 = Math.floor((vh + M - b) / c.P) + 1;
      for (let m = m0; m <= m1; m++) for (let k = 0; k < c.tiles.length; k++) {
        const t = c.tiles[k], sy = t.y + b + m * c.P;
        if (sy > vh + M || sy + t.h < -M) continue;
        if (cb(sx, sy, c.w, t.h, t, ci + ':' + j + ':' + k + ':' + m) === false) return;
      }
    }
  }

  function hitTest(x, y) {
    let hit = null;
    forEachTile(0, (sx, sy, w, h, t, key) => { if (x >= sx && x < sx + w && y >= sy && y < sy + h) { hit = {sx, sy, w, h, t, key}; return false; } });
    return hit;
  }

  function fillInstances() {
    let n = 0; hk = null; hoverInfo = null;
    const hp = dragging ? null : ptr;
    forEachTile(70, (sx, sy, w, h, t, key) => {
      if (n >= MAX) return false;
      if (hp && hp.x >= sx && hp.x < sx + w && hp.y >= sy && hp.y < sy + h) { hk = key; hoverInfo = {sx, sy, w, h, t, key}; }
      const o = n * 4;
      aRect[o] = sx; aRect[o + 1] = sy; aRect[o + 2] = w; aRect[o + 3] = h;
      aCrop[o] = t.a[0]; aCrop[o + 1] = t.a[1]; aCrop[o + 2] = t.a[2]; aCrop[o + 3] = t.a[3];
      aInfo[o] = t.p; aInfo[o + 1] = hov.get(key) || 0;
      n++;
    });
    geo.attributes.aRect.needsUpdate = geo.attributes.aCrop.needsUpdate = geo.attributes.aInfo.needsUpdate = true;
    geo.setInstancedCount(n);
  }

  function updHover(dt) {
    let anim = false;
    if (hk) { const v = Math.min(1, (hov.get(hk) || 0) + dt / 520); hov.set(hk, v); if (v < 1) anim = true; }
    for (const [k, v] of hov) {
      if (k === hk) continue;
      const nv = v - dt / 220;
      if (nv <= 0) hov.delete(k); else { hov.set(k, nv); anim = true; }
    }
    return anim;
  }

  /* ---------- caja de análisis (solo el monitor apuntado, en un canvas 2D liviano) ---------- */
  const LM = [[.3, .38], [.7, .38], [.5, .56], [.38, .74], [.62, .74], [.22, .28], [.78, .28], [.5, .92], [.18, .58], [.82, .58]];
  const TRI = [[0, 1], [0, 2], [1, 2], [2, 3], [2, 4], [3, 4], [0, 5], [1, 6], [3, 7], [4, 7], [0, 8], [1, 9], [8, 3], [9, 4]];
  function tagFx(x, y, txt, bg, fg) {
    fctx.font = '15px VT323, monospace';
    const w = fctx.measureText(txt).width + 8;
    fctx.fillStyle = bg; fctx.fillRect(x, y - 16, w, 17); fctx.fillStyle = fg; fctx.fillText(txt, x + 4, y - 3);
  }
  function drawFx() {
    const show = hoverInfo && !dragging && Math.hypot(bend.x, bend.y) < 3;
    if (!show) { if (fxDirty) { fctx.clearRect(0, 0, vw, vh); fxDirty = false; } return; }
    fctx.clearRect(0, 0, vw, vh); fxDirty = true;
    const {sx, sy, w, h, t, key} = hoverInfo, f = fotos[t.p], hv = hov.get(key) || 0;
    if (hv < .35) return;
    const c = t.c, b = f.box;
    const mx = v => sx + (v - c[0]) / (c[2] - c[0]) * w, my = v => sy + (v - c[1]) / (c[3] - c[1]) * h;
    const x0 = Math.max(sx + 8, mx(b[0])), y0 = Math.max(sy + 34, my(b[1])), x1 = Math.min(sx + w - 8, mx(b[2])), y1 = Math.min(sy + h - 34, my(b[3]));
    if (x1 - x0 < 18 || y1 - y0 < 18) return;
    const done = hv >= 1, col = f.tipo === 'rostro' ? (done ? AMB : NV) : AMB;
    fctx.globalAlpha = Math.min(1, (hv - .35) / .35);
    const L = Math.min(14, (x1 - x0) * .3, (y1 - y0) * .3);
    fctx.strokeStyle = col; fctx.lineWidth = 2; fctx.beginPath();
    fctx.moveTo(x0, y0 + L); fctx.lineTo(x0, y0); fctx.lineTo(x0 + L, y0);
    fctx.moveTo(x1 - L, y0); fctx.lineTo(x1, y0); fctx.lineTo(x1, y0 + L);
    fctx.moveTo(x1, y1 - L); fctx.lineTo(x1, y1); fctx.lineTo(x1 - L, y1);
    fctx.moveTo(x0 + L, y1); fctx.lineTo(x0, y1); fctx.lineTo(x0, y1 - L); fctx.stroke();
    const bw = x1 - x0, bh = y1 - y0;
    if (f.tipo === 'rostro') {
      const pts = LM.map(([u, v]) => [x0 + u * bw, y0 + v * bh]);
      fctx.lineWidth = 1; fctx.strokeStyle = done ? 'rgba(255,210,58,.55)' : 'rgba(140,255,90,.55)'; fctx.beginPath();
      TRI.forEach(([i, j]) => { fctx.moveTo(pts[i][0], pts[i][1]); fctx.lineTo(pts[j][0], pts[j][1]); }); fctx.stroke();
      fctx.fillStyle = col; pts.forEach(p => fctx.fillRect(p[0] - 1.5, p[1] - 1.5, 3, 3));
      if (!done) { fctx.fillStyle = 'rgba(140,255,90,.85)'; fctx.fillRect(x0, y0 + bh * ((hv * 2) % 1), bw, 2); }
    } else if (f.tipo === 'objeto') {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; fctx.lineWidth = 1.5; fctx.beginPath();
      fctx.moveTo(cx - 10, cy); fctx.lineTo(cx + 10, cy); fctx.moveTo(cx, cy - 10); fctx.lineTo(cx, cy + 10); fctx.stroke();
    }
    const txt = f.tipo === 'rostro' ? (done ? 'MATCH ' + (88 + (t.p * 7) % 11) + '%' : 'ANALIZANDO ROSTRO ' + Math.round(hv * 100) + '%')
      : f.tipo === 'espalda' ? 'SUJETO DE ESPALDAS' : 'OBJETO DE INTERÉS';
    const ty = y0 - 2 > sy + 48 ? y0 - 2 : y1 + 19 < sy + h - 30 ? y1 + 19 : y0 + 18;   // sin pisar los chips EV/CAM
    tagFx(x0, ty, txt, f.tipo === 'rostro' && !done ? RED : AMB, f.tipo === 'rostro' && !done ? '#fff' : '#000');
    fctx.globalAlpha = 1;
  }

  /* ---------- loop ---------- */
  const clampV = v => Math.max(-60, Math.min(60, v));
  function tick(now) {
    if (!ready || !(visible || full)) { running = false; lastNow = 0; return; }
    const dt = lastNow ? Math.min(50, now - lastNow) : 16.7; lastNow = now;
    if (dt > 0 && dt < 100) {   // calidad adaptativa: si el promedio pasa de ~40 fps hacia abajo, bajar resolución
      ftAvg += (dt - ftAvg) * .05;
      if (++ftN > 90 && ftAvg > 24 && quality > .7) { quality = Math.max(.7, quality * .85); ftN = 0; ftAvg = 16.7; resize(); }
    }
    const k = 1 - Math.pow(1 - (dragging ? .4 : .085), dt / 16.67);
    const px = pos.x, py = pos.y;
    pos.x += (tgt.x - pos.x) * k; pos.y += (tgt.y - pos.y) * k;
    const vx = (pos.x - px) * 16.67 / dt, vy = (pos.y - py) * 16.67 / dt;
    const kb = 1 - Math.pow(.82, dt / 16.67);
    bend.x += (clampV(vx) - bend.x) * kb; bend.y += (clampV(vy) - bend.y) * kb;
    let st = 0;
    if (statT0 >= 0) {
      const e = now - statT0;
      if (pendingList && e >= 170) { list = pendingList; pendingList = null; buildLayout(); }
      st = e < 170 ? e / 170 : Math.max(0, 1 - (e - 170) / 280);
      if (e > 450) { statT0 = -1; st = 0; }
    }
    fillInstances();
    const hAnim = updHover(dt);
    const U = program.uniforms;
    U.uVel.value = [bend.x, bend.y]; U.uStatic.value = st; U.uTime.value = (now * .001) % 100;
    renderer.render({scene: mesh});
    drawFx();
    const moving = Math.abs(tgt.x - pos.x) > .15 || Math.abs(tgt.y - pos.y) > .15 || Math.abs(bend.x) > .05 || Math.abs(bend.y) > .05;
    if (moving || dragging || hAnim || statT0 >= 0) requestAnimationFrame(tick);
    else { running = false; lastNow = 0; }
  }
  function wake() { if (!running && ready && (visible || full)) { running = true; requestAnimationFrame(tick); } }

  function resize() {
    const r = wrap.getBoundingClientRect();
    vw = Math.max(1, r.width); vh = Math.max(1, r.height);
    renderer.dpr = dprOf(); renderer.setSize(vw, vh);
    const d = dprOf(); fx.width = Math.round(vw * d); fx.height = Math.round(vh * d); fctx.setTransform(d, 0, 0, d, 0, 0); fxDirty = false;
    program.uniforms.uRes.value = [vw, vh]; program.uniforms.uCompact.value = vw < 520 ? 1 : 0;
    const nb = vw < 520 ? 165 : vw < 1100 ? 215 : 255;
    if (ready && nb !== base) buildLayout();
  }
  new ResizeObserver(() => { resize(); wake(); }).observe(wrap);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; turno.set(visible || full); if (visible) wake(); }).observe(wrap);

  /* ---------- texturas ---------- */
  async function buildLabels() {
    try { await Promise.all([document.fonts.load('30px VT323'), document.fonts.load('700 24px "Courier Prime"')]); } catch (e) { /* sigue con la fuente de respaldo */ }
    const c = document.createElement('canvas'), W = SW * LS, H = SH * LS;
    c.width = W * 4; c.height = H * fotos.length;
    const x = c.getContext('2d'); x.textBaseline = 'middle';
    const chip = (sx, sy, txt, right, bg, fg, font, dot) => {
      x.font = font; const tw = x.measureText(txt).width + (dot ? 14 : 0), cw = tw + 10, ch = 34;
      const x0 = right ? sx + W - cw : sx, y0 = sy + (H - ch) / 2;
      x.fillStyle = bg; x.fillRect(x0, y0, cw, ch);
      let tx = x0 + 5;
      if (dot) { x.fillStyle = RED; x.beginPath(); x.arc(tx + 5, y0 + ch / 2, 4.5, 0, 7); x.fill(); tx += 14; }
      x.fillStyle = fg; x.fillText(txt, tx, y0 + ch / 2 + 1);
    };
    labels.forEach((L, i) => {
      const y = i * H;
      chip(0, y, L.ev, false, AMB, '#000', '30px VT323, monospace');
      chip(W, y, L.cam, true, 'rgba(0,0,0,.62)', NV, '30px VT323, monospace', true);
      chip(W * 2, y, L.cat, false, 'rgba(0,0,0,.62)', INK, '700 22px "Courier Prime", monospace');
      chip(W * 3, y, L.hora, true, 'rgba(0,0,0,.62)', 'rgba(241,244,236,.85)', '30px VT323, monospace');
    });
    return c;
  }
  const atlasImg = new Image(); atlasImg.decoding = 'async'; atlasImg.src = ATLAS.src;
  Promise.all([atlasImg.decode().then(() => atlasImg), buildLabels()]).then(([img, labCanvas]) => {
    tAtlas.image = img; tLab.image = labCanvas;
    ready = true; wrap.classList.remove('cargando');
    resize(); buildLayout();
    pos.x = tgt.x = Math.round(BW * .37); pos.y = tgt.y = 0;
    wake();
  }).catch(() => { wrap.classList.add('error'); });

  /* ---------- interacción ---------- */
  const interactive = () => !touchMode || full;
  const local = e => { const r = cv.getBoundingClientRect(); return {x: e.clientX - r.left, y: e.clientY - r.top}; };
  cv.addEventListener('pointerdown', e => {
    tap = null;
    if (!interactive() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const now = performance.now();
    down = {id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, lt: now, vx: 0, vy: 0};
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') { ptr = local(e); if (kbd >= 0) { kbd = -1; wrap.classList.remove('kbd'); } }
    if (down && e.pointerId === down.id) {
      const now = performance.now(), dx = e.clientX - down.lx, dy = e.clientY - down.ly, dtt = Math.max(1, now - down.lt);
      if (!dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { dragging = true; wrap.classList.add('drag'); }
      if (dragging) {
        tgt.x -= dx; tgt.y -= dy;
        down.vx = down.vx * .6 + (dx / dtt) * .4; down.vy = down.vy * .6 + (dy / dtt) * .4;
      }
      down.lx = e.clientX; down.ly = e.clientY; down.lt = now;
    }
    wake();
  });
  const up = e => {
    if (!down || e.pointerId !== down.id) return;
    if (dragging) {
      if (performance.now() - down.lt < 90) { tgt.x -= down.vx * 260; tgt.y -= down.vy * 260; }   // inercia al soltar
    } else if (e.type === 'pointerup') {
      // clic/tap sin arrastre (< 6 px): se abre en el evento "click" que sigue, así ese click
      // no cae sobre el visor recién abierto (en táctil lo cerraría al instante)
      const p = local(e), hit = hitTest(p.x, p.y);
      tap = hit ? hit.t.p : null;
    }
    down = null; dragging = false; wrap.classList.remove('drag'); wake();
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { ptr = null; wake(); } });
  wrap.addEventListener('wheel', e => {
    if (!interactive()) return;
    const r = wrap.getBoundingClientRect();
    // la rueda mueve el muro solo cuando el muro entra entero en pantalla; antes, scrollea la página
    if (!full && (r.top < -4 || r.bottom > innerHeight + 4)) return;
    e.preventDefault();
    const m = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh : 1;
    let dx = e.deltaX * m, dy = e.deltaY * m;
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    tgt.x += dx; tgt.y += dy; wake();
  }, {passive: false});

  /* ---------- celular: vista previa quieta + sala a pantalla completa ---------- */
  const entrar = wrap.querySelector('.muro-entrar'), salir = wrap.querySelector('.muro-salir');
  function enterFull() {
    if (full) return;
    full = true; wrap.classList.add('full'); html.classList.add('lock-muro');
    history.pushState({muro: 1}, '');
    turno.set(true); resize(); wake();
    salir.focus({preventScroll: true});
  }
  function exitFull(fromPop) {
    if (!full) return;
    full = false; wrap.classList.remove('full'); html.classList.remove('lock-muro'); ptr = null; down = null; dragging = false;
    if (!fromPop && history.state && history.state.muro) history.back();
    turno.set(visible); resize(); wake();
    entrar.focus({preventScroll: true});
  }
  entrar.addEventListener('click', enterFull);
  cv.addEventListener('click', () => {
    if (touchMode && !full) { enterFull(); return; }
    if (tap !== null) { const p = tap; tap = null; onOpen(p); }
  });
  salir.addEventListener('click', () => exitFull(false));
  addEventListener('popstate', () => {
    if (!full) return;
    const d = document.getElementById('visor'); if (d && d.open) d.close();
    exitFull(true);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && full && !document.getElementById('visor')?.open) exitFull(false);
  });

  /* ---------- teclado: centrar el monitor de la foto enfocada ---------- */
  function focusPhoto(i) {
    kbd = i; let best = null;
    forEachTile(Math.max(vw, vh), (sx, sy, w, h, t) => {
      if (t.p !== i) return;
      const dx = sx + w / 2 - vw / 2, dy = sy + h / 2 - vh / 2, d = Math.hypot(dx, dy);
      if (!best || d < best.d) best = {d, dx, dy};
    });
    if (best) { tgt.x = pos.x + best.dx; tgt.y = pos.y + best.dy; }
    ptr = {x: vw / 2, y: vh / 2}; wrap.classList.add('kbd'); wake();
  }
  function blurFocus() { if (kbd < 0) return; kbd = -1; ptr = null; wrap.classList.remove('kbd'); wake(); }

  function setList(next) {
    if (!ready) { list = next; return; }
    pendingList = next; statT0 = performance.now(); wake();
  }

  return {setList, focusPhoto, blurFocus, isFull: () => full, touchMode};
}

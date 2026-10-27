/* FICHA TÉCNICA de cada evidencia (reemplaza al visor).
   Al tocar un monitor, la cámara "imprime" la hoja técnica de esa foto: el monitor vuela hasta su lugar
   en la hoja (FLIP), pasa de verde a color con una línea de escaneo, se dibujan las cotas rojas, aparecen
   los puntos y se escriben los datos. Todo en menos de 1,2 s (con "reducir movimiento": directo).
   - Cada ficha tiene su link: #zk-014. El botón atrás del celular la cierra (history.pushState).
   - La foto grande (img/archivo/lg) se carga solo al abrir; se precargan la anterior y la siguiente.
   - Mientras está abierta, el muro y el fondo no animan (turno.ficha). */
import {ATLAS} from './archivo-data.js';
import {turno} from './turno.js';

const pad = (n, l = 2) => String(n).padStart(l, '0');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CATN = {'retratos': 'Retratos', 'calle': 'Calle', 'en-vivo': 'En vivo'};
const RED = '#FF2B2B', INK = '#0D0D0C', AMB = '#FFD23A', NV = '#8CFF5A';
const big = f => `img/archivo/lg/${f.id}.webp`;
const num = f => f.id.split('-')[1].padStart(3, '0');          // "014"
const hashOf = f => '#' + f.codigo.toLowerCase();               // "#zk-014"
const fecha = f => { const [y, m, d] = f.fecha.split('-'); return d + '/' + m + '/' + y; };

// puntos de la cara / nuca, en proporción dentro de "box"
const CARA = {frente: [.5, .16], ojoI: [.33, .42], ojoD: [.67, .42], nariz: [.5, .6], bocaI: [.37, .78], boca: [.5, .78], bocaD: [.63, .78], menton: [.5, .96]};
const CARA_L = [['frente', 'ojoI'], ['frente', 'ojoD'], ['ojoI', 'ojoD'], ['ojoI', 'nariz'], ['ojoD', 'nariz'], ['nariz', 'boca'], ['bocaI', 'boca'], ['boca', 'bocaD'], ['boca', 'menton']];
const NUCA = {a: [.5, .28], b: [.28, .5], c: [.72, .5], d: [.5, .7], e: [.5, .93]};
const NUCA_L = [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd'], ['d', 'e'], ['b', 'c']];

export function initFicha({fotos, cam, getVisible, onOpenChange}) {
  const $ = id => document.getElementById(id);
  const dlg = $('ficha'), img = $('fImg'), svg = $('fSvg'), ph = $('fPh'), photo = $('fPhoto'), load = $('fLoad');
  const fly = $('fFly'), flyCv = fly.querySelector('canvas'), flyScan = fly.querySelector('.f-scan');
  const dds = [...document.querySelectorAll('#fData dd')], pasos = [...document.querySelectorAll('#fPasos canvas')];
  const thumbs = $('fThumbs'), html = document.documentElement, hoja = dlg.querySelector('.hoja');
  hoja.tabIndex = -1;   // al abrir el foco va a la hoja (Tab recorre los botones; queda atrapado en el diálogo)
  let cur = -1, opener = null, closingFromPop = false, token = 0, thumbsCat = null, anims = [];
  const atlas = new Image(); atlas.decoding = 'async';
  const loadAtlas = () => { if (!atlas.src) atlas.src = ATLAS.src; };

  /* ---------- tamaño de la foto (calculado, así cotas y FLIP se ubican antes de que cargue) ---------- */
  const narrow = () => innerWidth <= 820;
  function layoutPhoto(f) {
    const cs = getComputedStyle(ph), pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight), pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
    const availW = Math.max(120, photo.clientWidth - pl - pr - 8);
    const top = dlg.querySelector('.h-top').offsetHeight, bot = dlg.querySelector('.h-bot').offsetHeight;
    const availH = narrow() ? innerHeight * .58 : Math.max(240, innerHeight - top - bot - pt - pb - 2 * parseFloat(getComputedStyle(dlg).paddingTop) - 16);
    const k = Math.min(availW / f.w, availH / f.h);
    const w = Math.round(f.w * k), h = Math.round(f.h * k);
    img.style.width = w + 'px'; img.style.height = h + 'px';
    return {L: pl, T: pt, w, h, W: w + pl + pr, H: h + pt + pb};
  }

  /* ---------- cotas, puntos y garabatos (SVG) ---------- */
  function overlay(f, G, t0) {
    const {L, T, w, h, W, H} = G, R = L + w, B = T + h, b = f.box, mob = narrow();
    const bx0 = L + b[0] * w, by0 = T + b[1] * h, bx1 = L + b[2] * w, by1 = T + b[3] * h, bw = bx1 - bx0, bh = by1 - by0;
    const P = ([u, v]) => [bx0 + u * bw, by0 + v * bh];
    let o = '', li = 0, pi = 0;
    const d = (base, step, i) => `style="--d:${(t0 + base + step * i).toFixed(3)}s"`;
    const ln = (x1, y1, x2, y2, sw = 1, col = RED, op = 1) => `<line class="ln" pathLength="1" ${d(0, .022, li++)} x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="${sw}" stroke-opacity="${op}"/>`;
    const tx = (x, y, s, size = 11, anchor = 'middle', rot = 0, extra = '') => `<text class="tx" ${d(.18, .02, li++)} x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" fill="${RED}" text-anchor="${anchor}"${rot ? ` transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})"` : ''} ${extra}>${s}</text>`;
    const arrowH = (x1, x2, y) => ln(x1, y, x2, y) + `<path class="tx" ${d(.18, 0, 0)} d="M${x1} ${y}l6 -3.5v7zM${x2} ${y}l-6 -3.5v7z" fill="${RED}"/>`;
    const arrowV = (x, y1, y2) => ln(x, y1, x, y2) + `<path class="tx" ${d(.18, 0, 0)} d="M${x} ${y1}l-3.5 6h7zM${x} ${y2}l-3.5 -6h7z" fill="${RED}"/>` + ln(x - 5, y1, x + 5, y1) + ln(x - 5, y2, x + 5, y2);
    // marco rojo fino + ticks en las esquinas
    o += `<rect class="ln" pathLength="1" ${d(0, 0, 0)} x="${L}" y="${T}" width="${w}" height="${h}" fill="none" stroke="${RED}" stroke-width="1"/>`;
    [[L, T, -1, -1], [R, T, 1, -1], [R, B, 1, 1], [L, B, -1, 1]].forEach(([x, y, sx, sy]) => { o += ln(x + sx * 4, y, x + sx * 14, y, 1.4) + ln(x, y + sy * 4, x, y + sy * 14, 1.4); });
    // caja de la zona analizada
    o += `<rect class="ln" pathLength="1" ${d(.05, 0, 0)} x="${bx0.toFixed(1)}" y="${by0.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="none" stroke="${RED}" stroke-width="1" stroke-opacity=".85"/>`;
    // cota superior con flechas
    const cy = T - 18, lab = f.tipo === 'rostro' ? 'LX01' : f.tipo === 'espalda' ? 'SUJETO DE ESPALDAS — RASGOS NO DISPONIBLES' : 'OBJETO DE INTERÉS · W ' + Math.round((b[2] - b[0]) * 100) + '%';
    o += arrowH(bx0, bx1, cy) + ln(bx0, cy - 5, bx0, by0, .8, RED, .45) + ln(bx1, cy - 5, bx1, by0, .8, RED, .45);
    const lx = Math.min(Math.max((bx0 + bx1) / 2, L + 120), R - 120);
    o += tx(f.tipo === 'rostro' ? (bx0 + bx1) / 2 : lx, cy - 6, lab, f.tipo === 'rostro' ? 12 : 10.5, 'middle', 0, 'font-weight="600" letter-spacing=".04em"');
    // cotas laterales
    const lx1 = L - 16, lx2 = L - 46, rx1 = R + 16, rx2 = R + 46;
    o += arrowV(lx1, by0, by1) + tx(lx1 - 8, (by0 + by1) / 2, f.tipo === 'objeto' ? 'H ' + Math.round((b[3] - b[1]) * 100) + '%' : 'dx E01', 10, 'middle', -90);
    if (by0 - T > 18) o += arrowV(rx1, T, by0) + tx(rx1 + 12, (T + by0) / 2, 'F02', 10, 'middle', -90);
    if (!mob) {
      if (f.tipo === 'rostro') {
        const ey = P(CARA.ojoI)[1], my = P(CARA.boca)[1], ny = P(CARA.nariz)[1], ch = P(CARA.menton)[1];
        o += arrowV(lx2, ey, my) + tx(lx2 - 8, (ey + my) / 2, 'sx E02', 10, 'middle', -90);
        o += arrowV(rx2, ny, ch) + tx(rx2 + 12, (ny + ch) / 2, 'N01', 10, 'middle', -90);
      } else {
        o += arrowV(rx2, by0, by1) + tx(rx2 + 12, (by0 + by1) / 2, 'N01', 10, 'middle', -90);
        if (by1 < B - 12) o += arrowV(lx2, by1, B) + tx(lx2 - 8, (by1 + B) / 2, 'sx E02', 10, 'middle', -90);
      }
    }
    // puntos rojos unidos por líneas finas (cara o nuca); en objetos, mira al centro y diagonales
    const pts = f.tipo === 'rostro' ? [CARA, CARA_L] : f.tipo === 'espalda' ? [NUCA, NUCA_L] : null;
    if (pts) {
      const [M, Ls] = pts;
      Ls.forEach(([a, c]) => { const p = P(M[a]), q = P(M[c]); o += `<line class="ln" pathLength="1" ${d(.28, .03, li++)} x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="${RED}" stroke-width=".9" stroke-opacity=".8"/>`; });
      Object.values(M).forEach(m => { const p = P(m); o += `<circle class="pt" ${d(.3, .05, pi++)} cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2" fill="${RED}" stroke="#fff" stroke-width=".8"/>`; });
    } else {
      const cx = (bx0 + bx1) / 2, cyy = (by0 + by1) / 2;
      o += ln(bx0, by0, bx1, by1, .8, RED, .7) + ln(bx1, by0, bx0, by1, .8, RED, .7) + ln(cx - 12, cyy, cx + 12, cyy, 1.6) + ln(cx, cyy - 12, cx, cyy + 12, 1.6);
      [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]].forEach((p, i) => { o += `<circle class="pt" ${d(.3, .05, i)} cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2" fill="${RED}" stroke="#fff" stroke-width=".8"/>`; });
    }
    // código de la toma abajo de la foto
    o += tx(L + w / 2, B + 24, 'L0' + num(f).slice(1), 13, 'middle', 0, 'font-weight="600"');
    // garabatos a mano (negro, sobre el papel): estrella, firma "zurklima" y flecha
    const sx = R + (mob ? 14 : 30), sy = T - (mob ? 12 : 20), s = mob ? 11 : 15;
    const star = Array.from({length: 11}, (_, k) => { const a = -Math.PI / 2 + k * Math.PI * .8 * 1.0, r = s * (1 + Math.sin(k * 7.3) * .08); return [sx + Math.cos(a) * r, sy + Math.sin(a) * r]; });
    o += `<path class="ln" pathLength="1" ${d(.55, 0, 0)} d="M${star.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L')}" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    o += `<text class="tx mk" ${d(.62, 0, 0)} x="${L + 4}" y="${B + 30}" font-size="${mob ? 17 : 22}" fill="${INK}" transform="rotate(-7 ${L + 4} ${B + 30})">zurklima</text>`;
    if (!mob) {
      const ax = R + 66, ay = T + h * .78, ex = R + 8, ey = T + h * .6;
      o += `<path class="ln" pathLength="1" ${d(.6, 0, 0)} d="M${ax} ${ay} C ${ax - 6} ${ay - 34}, ${ex + 30} ${ey + 4}, ${ex} ${ey}" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
      o += `<path class="ln" pathLength="1" ${d(.68, 0, 0)} d="M${ex + 11} ${ey - 7} L${ex} ${ey} L${ex + 12} ${ey + 5}" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      o += `<text class="tx mk" ${d(.72, 0, 0)} x="${ax - 4}" y="${ay + 18}" font-size="13" fill="${INK}" text-anchor="middle">${f.tipo === 'rostro' ? 'match!' : 'ojo'}</text>`;
    }
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = o;
  }

  /* ---------- código de barras decorativo a partir del código ---------- */
  function barcode(code) {
    let x = 0, o = '', h = 2166136261;
    for (const ch of code + '*' + code) {
      h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
      for (let k = 0; k < 5; k++) { const bw = 1 + ((h >>> (k * 3)) & 1) + ((h >>> (k * 3 + 1)) & 1) * .6, gap = 1 + ((h >>> (k * 3 + 2)) & 1); o += `<rect x="${x.toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="32" fill="${INK}"/>`; x += bw + gap; }
    }
    const bar = $('fBar'); bar.setAttribute('viewBox', `0 0 ${x.toFixed(0)} 44`); bar.setAttribute('preserveAspectRatio', 'none');
    bar.innerHTML = o + `<text x="${(x / 2).toFixed(0)}" y="43" font-size="10" text-anchor="middle" font-family="IBM Plex Mono, monospace" fill="${INK}" textLength="${(x * .7).toFixed(0)}">${code}</text>`;
  }

  /* ---------- canvas: recortes de la izquierda y los 4 pasos de análisis ---------- */
  const DPR = () => Math.min(devicePixelRatio || 1, 1.5);
  function prep(cv, aspect = 1) {
    const w = cv.clientWidth || 140, h = Math.round(w / aspect), k = DPR();
    cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    const x = cv.getContext('2d'); x.setTransform(k, 0, 0, k, 0, 0); return [x, w, h];
  }
  // región cuadrada (o de aspecto dado) alrededor del box, en px de la imagen
  function region(f, im, grow, aspect = 1) {
    const W = im.naturalWidth, H = im.naturalHeight, b = f.box;
    const cx = (b[0] + b[2]) / 2 * W, cy = (b[1] + b[3]) / 2 * H;
    let rh = Math.max((b[3] - b[1]) * H, (b[2] - b[0]) * W / aspect) * grow, rw = rh * aspect;
    if (rw > W) { rw = W; rh = rw / aspect; } if (rh > H) { rh = H; rw = rh * aspect; }
    const x0 = Math.min(W - rw, Math.max(0, cx - rw / 2)), y0 = Math.min(H - rh, Math.max(0, cy - rh / 2));
    return {x0, y0, rw, rh, W, H};
  }
  function noAplica(x, w, h, txt = 'NO APLICA') {
    x.fillStyle = 'rgba(13,13,12,.55)'; x.fillRect(0, 0, w, h);
    x.save(); x.translate(w / 2, h / 2); x.rotate(-.18); x.strokeStyle = RED; x.lineWidth = 2; x.font = '600 13px "IBM Plex Mono", monospace';
    const tw = x.measureText(txt).width + 14; x.strokeRect(-tw / 2, -12, tw, 24); x.fillStyle = RED; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 0, 1); x.restore();
  }
  function drawCanvases(f) {
    const im = img;
    // izquierda: zona del box y foto entera chica
    { const cv = $('fCrop1'), [x, w, h] = prep(cv, 3 / 4), r = region(f, im, 1.3, 3 / 4); x.drawImage(im, r.x0, r.y0, r.rw, r.rh, 0, 0, w, h); }
    { const cv = $('fCrop2'); cv.style.aspectRatio = f.w + ' / ' + f.h; const [x, w, h] = prep(cv, f.w / f.h); x.drawImage(im, 0, 0, w, h);
      const b = f.box; x.strokeStyle = RED; x.lineWidth = 1; x.strokeRect(b[0] * w, b[1] * h, (b[2] - b[0]) * w, (b[3] - b[1]) * h); }
    // pasos
    const r = region(f, im, 1.55);
    const base = (cv) => { const [x, w, h] = prep(cv); x.drawImage(im, r.x0, r.y0, r.rw, r.rh, 0, 0, w, h); const M = ([u, v]) => [((f.box[0] + u * (f.box[2] - f.box[0])) * r.W - r.x0) / r.rw * w, ((f.box[1] + v * (f.box[3] - f.box[1])) * r.H - r.y0) / r.rh * h]; return [x, w, h, M]; };
    // 1 · DETECCIÓN
    { const [x, , , M] = base(pasos[0]), a = M([0, 0]), c = M([1, 1]); x.strokeStyle = RED; x.lineWidth = 2; x.strokeRect(a[0], a[1], c[0] - a[0], c[1] - a[1]); }
    // 2 · RASGOS
    { const [x, w, h, M] = base(pasos[1]);
      if (f.tipo === 'rostro') {
        const zs = [['ojoI', .2, .14], ['ojoD', .2, .14], ['nariz', .16, .16], ['boca', .3, .12]].map(([k, sw, sh]) => { const c = M(CARA[k]), a = M([0, 0]), e = M([1, 1]); return [c, sw * (e[0] - a[0]), sh * (e[1] - a[1])]; });
        x.strokeStyle = RED; x.lineWidth = 1.2; x.beginPath(); zs.forEach(([c], i) => { if (i) x.lineTo(c[0], c[1]); else x.moveTo(c[0], c[1]); }); x.closePath(); x.stroke();
        x.strokeStyle = AMB; x.lineWidth = 1.6; zs.forEach(([c, sw, sh]) => x.strokeRect(c[0] - sw / 2, c[1] - sh / 2, sw, sh));
        x.fillStyle = NV; zs.forEach(([c]) => { x.beginPath(); x.arc(c[0], c[1], 2.2, 0, 7); x.fill(); });
      } else if (f.tipo === 'objeto') {
        const a = M([0, 0]), c = M([1, 1]), L = 12; x.strokeStyle = AMB; x.lineWidth = 2; x.beginPath();
        [[a[0], a[1], 1, 1], [c[0], a[1], -1, 1], [c[0], c[1], -1, -1], [a[0], c[1], 1, -1]].forEach(([px, py, sx, sy]) => { x.moveTo(px + sx * L, py); x.lineTo(px, py); x.lineTo(px, py + sy * L); }); x.stroke();
      } else noAplica(x, w, h);
    }
    // 3 · TRIANGULACIÓN (malla con los puntos de la cara o la nuca + bordes del box)
    { const [x, w, h, M] = base(pasos[2]);
      if (f.tipo === 'objeto') noAplica(x, w, h);
      else {
        const pts = Object.values(f.tipo === 'rostro' ? CARA : NUCA).concat([[0, 0], [.5, 0], [1, 0], [1, .5], [1, 1], [.5, 1], [0, 1], [0, .5]]).map(M);
        x.strokeStyle = 'rgba(80,230,255,.85)'; x.lineWidth = 1; x.beginPath();
        pts.forEach((p, i) => { pts.map((q, j) => [Math.hypot(p[0] - q[0], p[1] - q[1]), j]).sort((a, b) => a[0] - b[0]).slice(1, 4).forEach(([, j]) => { x.moveTo(p[0], p[1]); x.lineTo(pts[j][0], pts[j][1]); }); });
        x.stroke(); x.fillStyle = NV; pts.forEach(p => { x.beginPath(); x.arc(p[0], p[1], 2.4, 0, 7); x.fill(); });
      }
    }
    // 4 · EXTRACCIÓN (zona chica ampliada en píxeles + grilla de características)
    { const cv = pasos[3], [x, w, h] = prep(cv);
      if (f.tipo === 'espalda') { x.drawImage(im, r.x0, r.y0, r.rw, r.rh, 0, 0, w, h); noAplica(x, w, h); }
      else {
        const c = f.tipo === 'rostro' ? CARA.nariz : [.5, .5], b = f.box, W = im.naturalWidth, H = im.naturalHeight;
        const s = (b[2] - b[0]) * W * .45, sx = Math.max(0, Math.min(W - s, (b[0] + c[0] * (b[2] - b[0])) * W - s / 2)), sy = Math.max(0, Math.min(H - s, (b[1] + c[1] * (b[3] - b[1])) * H - s / 2));
        const t = document.createElement('canvas'); t.width = t.height = 10; t.getContext('2d').drawImage(im, sx, sy, s, s, 0, 0, 10, 10);
        x.fillStyle = '#d8d8d2'; x.fillRect(0, 0, w, h); x.imageSmoothingEnabled = false;
        const m = 12, gw = w - m * 2; x.drawImage(t, m, m, gw, gw);
        x.strokeStyle = RED; x.lineWidth = 1.4; for (let k = 0; k <= 5; k++) { const p = m + gw * k / 5; x.beginPath(); x.moveTo(p, m); x.lineTo(p, m + gw); x.moveTo(m, p); x.lineTo(m + gw, p); x.stroke(); }
        x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 1;
        for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const cx = m + gw * (i + .5) / 5, cy = m + gw * (j + .5) / 5, rr = gw / 16; x.beginPath(); for (let a = 0; a < 4; a++) { const an = a * Math.PI / 4; x.moveTo(cx - Math.cos(an) * rr, cy - Math.sin(an) * rr); x.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); } x.stroke(); }
        x.fillStyle = NV; x.beginPath(); x.arc(m + gw / 2, m + gw / 2, 3, 0, 7); x.fill();
      }
    }
  }

  /* ---------- datos (con efecto máquina de escribir) ---------- */
  function fillData(f, i, anim, t) {
    const vals = {codigo: f.codigo, titulo: f.titulo, fecha: fecha(f), hora: f.hora, lugar: f.lugar + ', AR', foto: f.fotografo, cat: CATN[f.cat] || 'Objeto', cam: cam(i)};
    const list = dds.map(dd => [dd, vals[dd.dataset.k] || '']);
    if (!anim) { list.forEach(([dd, v]) => { dd.textContent = v; }); return; }
    list.forEach(([dd]) => { dd.textContent = ''; });
    const start = performance.now() + 480, dur = 420, total = list.reduce((a, [, v]) => a + v.length, 0);
    const step = now => {
      if (t !== token) return;
      let n = Math.round(Math.max(0, Math.min(1, (now - start) / dur)) * total);
      for (const [dd, v] of list) { const k = Math.min(v.length, n); if (dd.textContent.length !== k) dd.textContent = v.slice(0, k); n -= k; }
      if (now < start + dur) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- miniaturas de la misma categoría ---------- */
  function buildThumbs(f) {
    if (thumbsCat !== f.cat) {
      thumbsCat = f.cat;
      thumbs.innerHTML = fotos.map((g, j) => g.cat !== f.cat ? '' :
        `<a href="${hashOf(g)}" data-i="${j}" aria-label="${g.codigo}: ${g.titulo}"><img src="img/archivo/sm/${g.id}.webp" alt="" loading="lazy" decoding="async"></a>`).join('');
    }
    thumbs.querySelectorAll('a').forEach(a => { const on = +a.dataset.i === cur; a.setAttribute('aria-current', on ? 'true' : 'false'); if (on) a.scrollIntoView({block: 'nearest', inline: 'nearest'}); });
  }
  thumbs.addEventListener('click', e => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); go(+a.dataset.i); });

  /* ---------- el monitor vuela hasta la hoja y pasa de verde a color ---------- */
  function paintFly(f, src, w, h) {
    flyCv.width = Math.max(2, Math.round(w)); flyCv.height = Math.max(2, Math.round(h));
    const x = flyCv.getContext('2d');
    x.fillStyle = '#0b1a08'; x.fillRect(0, 0, flyCv.width, flyCv.height);
    if (src === atlas && atlas.complete && atlas.naturalWidth) { const u = f.uv; x.drawImage(atlas, u[0] * ATLAS.w, u[1] * ATLAS.h, (u[2] - u[0]) * ATLAS.w, (u[3] - u[1]) * ATLAS.h, 0, 0, flyCv.width, flyCv.height); }
    else if (src && src.complete && src.naturalWidth) x.drawImage(src, 0, 0, flyCv.width, flyCv.height);
    // visión nocturna: escala de grises × verde fósforo
    x.globalCompositeOperation = 'saturation'; x.fillStyle = '#808080'; x.fillRect(0, 0, flyCv.width, flyCv.height);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = NV; x.fillRect(0, 0, flyCv.width, flyCv.height);
    x.globalCompositeOperation = 'screen'; x.fillStyle = 'rgba(20,60,10,.5)'; x.fillRect(0, 0, flyCv.width, flyCv.height);
    x.globalCompositeOperation = 'source-over';
  }
  function stopAnims() { anims.forEach(a => { try { a.cancel(); } catch (e) { /* ya terminó */ } }); anims = []; fly.style.display = 'none'; flyScan.style.display = 'none'; }

  /* ---------- mostrar una evidencia ---------- */
  function show(i, {rect = null, src = null, first = false} = {}) {
    const f = fotos[i], t = ++token, anim = !reduce;
    cur = i; stopAnims();
    const vis = getVisible(), pos = vis.indexOf(i);
    $('fCode').textContent = f.codigo; $('fTitulo').textContent = f.titulo; $('fVt').textContent = 'Visualización técnica ' + num(f);
    $('fCount').textContent = pad(pos + 1) + ' / ' + pad(vis.length); $('fAlt').textContent = f.alt;
    img.alt = f.alt; barcode(f.codigo); buildThumbs(f);
    dlg.classList.toggle('anim', anim);
    fillData(f, i, anim, t);
    const G = layoutPhoto(f);
    // las cotas se recrean en cada ficha, así sus animaciones CSS arrancan de cero
    const t0 = anim ? (first && rect ? .46 : .12) : 0;
    overlay(f, G, t0);
    img.removeAttribute('src'); img.style.opacity = '0'; load.classList.add('on');
    img.src = big(f);
    const loaded = img.decode().then(() => true, () => false);
    preload(vis[(pos + 1) % vis.length]); preload(vis[(pos - 1 + vis.length) % vis.length]);
    const done = ok => {
      if (t !== token) return;
      load.classList.toggle('on', !ok); if (!ok) { load.textContent = 'SEÑAL PERDIDA'; return; }
      img.style.opacity = '1'; drawCanvases(f);
    };
    if (!anim) { loaded.then(done); return; }
    // FLIP: del monitor tocado (o desde el lugar de la foto) hasta la foto en la hoja
    const to = img.getBoundingClientRect(), from = rect || to;
    paintFly(f, src || atlas, Math.min(448, to.width), Math.min(448, to.height));
    fly.style.display = 'block'; fly.style.clipPath = '';
    const k = r => ({left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px'});
    const a = fly.animate([k(from), k(to)], {duration: rect ? 420 : 1, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards'});
    anims.push(a);
    Promise.all([a.finished.catch(() => {}), loaded]).then(([, ok]) => {
      done(ok);
      if (t !== token || !ok) return;
      // barrido de arriba hacia abajo: lo verde se va y queda la foto en color
      flyScan.style.display = 'block';
      anims.push(fly.animate([{clipPath: 'inset(0 0 0 0)'}, {clipPath: 'inset(100% 0 0 0)'}], {duration: 360, easing: 'linear', fill: 'forwards'}));
      const s = flyScan.animate([{top: '0%'}, {top: '100%'}], {duration: 360, easing: 'linear', fill: 'forwards'});
      anims.push(s);
      s.finished.then(() => { if (t === token) stopAnims(); }, () => {});
    });
  }
  const pre = new Map();
  function preload(i) { if (i == null || i < 0 || pre.has(i)) return; const im = new Image(); im.decoding = 'async'; im.src = big(fotos[i]); pre.set(i, im); }

  function setHash(f, push) {
    const url = location.pathname + location.search + hashOf(f);
    if (push) history.pushState({ficha: f.codigo}, '', url); else history.replaceState({ficha: f.codigo}, '', url);
  }
  function go(i) { if (getVisible().indexOf(i) < 0) return; setHash(fotos[i], false); show(i); }
  function step(dv) { if (cur < 0) return; const v = getVisible(), p = v.indexOf(cur), n = v.length; go(v[(p + dv + n) % n]); }

  function open(i, {rect = null, src = null, opener: op = null} = {}) {
    if (getVisible().indexOf(i) < 0) return;
    loadAtlas();
    opener = op || document.activeElement;
    if (!dlg.open) { html.classList.add('lock'); dlg.showModal(); dlg.scrollTop = 0; hoja.focus({preventScroll: true}); turno.setFicha(true); onOpenChange && onOpenChange(true); }
    setHash(fotos[i], !(history.state && history.state.ficha));
    show(i, {rect, src, first: true});
  }
  function close() { if (dlg.open) dlg.close(); }

  dlg.addEventListener('close', () => {
    token++; stopAnims(); img.removeAttribute('src'); cur = -1;
    html.classList.remove('lock'); turno.setFicha(false); onOpenChange && onOpenChange(false);
    // si la ficha agregó una entrada al historial, volver (así queda limpio el hash)
    if (!closingFromPop && history.state && history.state.ficha) history.back();
    closingFromPop = false;
    if (opener && opener !== document.body && document.contains(opener)) opener.focus({preventScroll: true});
  });
  $('fClose').addEventListener('click', close);
  $('fClose2').addEventListener('click', close);
  $('fPrev').addEventListener('click', () => step(-1));
  $('fNext').addEventListener('click', () => step(1));
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });
  // swipe horizontal sobre la foto (celular)
  let sw = null;
  photo.addEventListener('pointerdown', e => { sw = {x: e.clientX, y: e.clientY}; });
  photo.addEventListener('pointerup', e => { if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) step(dx < 0 ? 1 : -1); });
  photo.addEventListener('pointercancel', () => { sw = null; });
  // atrás del navegador / celular: cierra la ficha (no sale de la página)
  addEventListener('popstate', () => {
    const st = history.state;
    if (dlg.open && !(st && st.ficha)) { closingFromPop = true; dlg.close(); return; }
    if (st && st.ficha) { const j = fotos.findIndex(g => g.codigo === st.ficha); if (j >= 0 && getVisible().includes(j)) { if (!dlg.open) open(j); else show(j); } }
  });
  // hash escrito a mano o link a #zk-014
  const fromHash = () => { const m = /^#zk-(\d{1,3})$/i.exec(location.hash); if (!m) return -1; return fotos.findIndex(g => g.codigo === 'ZK-' + m[1].padStart(3, '0')); };
  addEventListener('hashchange', () => { const j = fromHash(); if (j >= 0 && cur !== j) { if (dlg.open) go(j); else { history.replaceState(null, '', location.pathname + location.search); history.pushState({ficha: fotos[j].codigo}, '', location.pathname + location.search + hashOf(fotos[j])); open(j); } } });
  // al redimensionar, reubicar foto y cotas (sin animar)
  let rz = 0;
  addEventListener('resize', () => { if (!dlg.open || cur < 0) return; cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { const f = fotos[cur]; dlg.classList.remove('anim'); overlay(f, layoutPhoto(f), 0); if (img.complete && img.naturalWidth) drawCanvases(f); }); });

  // abrir directo si la página se cargó con #zk-014: el atrás cierra la ficha y queda en la página
  function openFromHash() {
    const j = fromHash(); if (j < 0) return false;
    history.replaceState(null, '', location.pathname + location.search);
    open(j); return true;
  }
  return {open, close, isOpen: () => dlg.open, openFromHash, current: () => cur};
}

/* ARCHIVO: grilla de evidencias, filtros y visor de detalle.
   Sin requestAnimationFrame propio: todo son transiciones CSS de una sola vez. */
import {FOTOS} from './archivo-data.js';

const CATS={'retratos':'RETRATOS','calle':'CALLE','en-vivo':'EN VIVO'};
const pad=(n,l=2)=>String(n).padStart(l,'0');
const evId=i=>'EV-'+pad(i+1);
// hora "de cámara" fija por foto, para que no cambie en cada visita
const stamp=i=>pad(21+Math.floor(i/6)%3)+':'+pad((i*17+7)%60)+':'+pad((i*29+11)%60);

const grid=document.getElementById('grid');
const count=document.getElementById('aCount');
const filterBtns=[...document.querySelectorAll('.filtros button')];

/* ---------- grilla ---------- */
const frag=document.createDocumentFragment();
FOTOS.forEach((f,i)=>{
  const li=document.createElement('li');li.className='ev-card';li.dataset.cat=f.cat;li.dataset.i=i;
  const h=Math.round(480*f.h/f.w);
  li.innerHTML=`<button type="button" class="ev-btn" aria-label="Abrir ${evId(i)}: ${f.alt}">
    <img src="img/archivo/sm/${f.id}.webp" width="480" height="${h}" alt="${f.alt}" loading="lazy" decoding="async">
    <span class="ev-tag ev-tl">${evId(i)}</span><span class="ev-tag ev-tr">CAM ${pad((i*3)%21+1)}</span>
    <span class="ev-tag ev-bl">${CATS[f.cat]||'OBJETO'}</span><span class="ev-tag ev-br">${stamp(i)}</span>
  </button>`;
  frag.appendChild(li);
});
grid.appendChild(frag);
const cards=[...grid.children];

// aparición al entrar en pantalla (una sola vez por tarjeta)
if('IntersectionObserver' in window){
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{rootMargin:'0px 0px -6% 0px'});
  cards.forEach(c=>io.observe(c));
}else cards.forEach(c=>c.classList.add('in'));

/* ---------- filtros ---------- */
filterBtns.forEach(b=>{const f=b.dataset.f;b.querySelector('b').textContent=pad(f==='todo'?FOTOS.length:FOTOS.filter(x=>x.cat===f).length)});
let visible=FOTOS.map((_,i)=>i);
function setFilter(f){
  filterBtns.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.f===f)));
  visible=[];
  cards.forEach((c,i)=>{const on=f==='todo'||c.dataset.cat===f;c.hidden=!on;if(on){visible.push(i);c.classList.add('in')}});
  count.textContent=pad(visible.length)+' ARCHIVOS'+(f==='todo'?'':' · '+CATS[f]);
}
filterBtns.forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.f)));
setFilter('todo');

/* ---------- visor ---------- */
const dlg=document.getElementById('visor'),vImg=document.getElementById('vImg'),vId=document.getElementById('vId'),vCap=document.getElementById('vCap'),
  vMeta=document.getElementById('vMeta'),vLoad=document.getElementById('vLoad'),scan=dlg.querySelector('.v-scan');
let cur=-1,opener=null;
const big=f=>`img/archivo/lg/${f.id}.webp`;
function preload(i){if(i>=0&&i<FOTOS.length){const im=new Image();im.decoding='async';im.src=big(FOTOS[i])}}

function show(i){
  cur=i;const f=FOTOS[i];const pos=visible.indexOf(i);
  vId.textContent='EVIDENCIA '+evId(i)+' · '+(CATS[f.cat]||'OBJETO');
  vMeta.textContent=pad(pos+1)+' / '+pad(visible.length)+' · CAM 07 · NQN';
  vCap.textContent=f.alt;
  vImg.alt=f.alt;vImg.width=f.w;vImg.height=f.h;
  vImg.classList.remove('reveal');vImg.classList.add('nv');vLoad.classList.add('on');
  const done=()=>{vLoad.classList.remove('on');scan.classList.remove('go');void scan.offsetWidth;scan.classList.add('go');
    requestAnimationFrame(()=>{vImg.classList.add('reveal');vImg.classList.remove('nv')})};
  vImg.onload=done;vImg.onerror=()=>{vLoad.textContent='SEÑAL PERDIDA';};
  vLoad.textContent='DESCARGANDO EVIDENCIA…';
  vImg.src=big(f);
  if(vImg.complete&&vImg.naturalWidth)done();
  preload(visible[pos+1]);preload(visible[pos-1]);
}
function step(d){if(cur<0)return;const pos=visible.indexOf(cur);const n=visible.length;show(visible[(pos+d+n)%n])}
function open(i,btn){opener=btn;document.documentElement.classList.add('lock');dlg.showModal();show(i)}
function close(){dlg.close()}

grid.addEventListener('click',e=>{const b=e.target.closest('.ev-btn');if(!b)return;open(+b.parentElement.dataset.i,b)});
document.getElementById('vClose').addEventListener('click',close);
document.getElementById('vPrev').addEventListener('click',()=>step(-1));
document.getElementById('vNext').addEventListener('click',()=>step(1));
dlg.addEventListener('close',()=>{document.documentElement.classList.remove('lock');vImg.removeAttribute('src');cur=-1;opener&&opener.focus()});
dlg.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();step(1)}else if(e.key==='ArrowLeft'){e.preventDefault();step(-1)}});
// clic en el fondo vacío cierra
dlg.addEventListener('click',e=>{if(e.target===dlg||e.target.classList.contains('v-frame')||e.target.classList.contains('v-fig'))close()});
// swipe horizontal en celular
let sx=null,sy=0;
vImg.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY});
vImg.addEventListener('pointerup',e=>{if(sx===null)return;const dx=e.clientX-sx,dy=e.clientY-sy;sx=null;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.3)step(dx<0?1:-1)});

/* ---------- anclas con scroll suave ---------- */
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
document.addEventListener('click',e=>{
  const a=e.target.closest('a[href^="#"]');if(!a)return;
  const id=a.getAttribute('href').slice(1);
  if(id==='top'){e.preventDefault();scrollTo({top:0,behavior:reduce?'auto':'smooth'});return}
  const t=document.getElementById(id);if(!t)return;
  e.preventDefault();t.scrollIntoView({behavior:reduce?'auto':'smooth'});
  if(!t.hasAttribute('tabindex'))t.setAttribute('tabindex','-1');t.focus({preventScroll:true});
  if(id==='archivo')history.replaceState(null,'','#archivo');
});

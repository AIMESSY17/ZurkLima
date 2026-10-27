/* ARCHIVO: muro infinito (WebGL), filtros, visor de detalle y grilla de respaldo.
   - Con WebGL y sin "reducir movimiento": se usa el MURO (js/muro.js). La grilla queda en el DOM
     sin imágenes, oculta a la vista pero accesible con teclado/lector (Tab centra el monitor en el muro).
   - Sin WebGL o con prefers-reduced-motion: se muestra la grilla clásica (respaldo). */
import {FOTOS} from './archivo-data.js';
import {initMuro} from './muro.js';

const CATS={'retratos':'RETRATOS','calle':'CALLE','en-vivo':'EN VIVO'};
const pad=(n,l=2)=>String(n).padStart(l,'0');
const evId=i=>'EV-'+pad(i+1);
const camId=i=>'CAM '+pad((i*3)%21+1);
// hora "de cámara" fija por foto, para que no cambie en cada visita
const stamp=i=>pad(21+Math.floor(i/6)%3)+':'+pad((i*17+7)%60)+':'+pad((i*29+11)%60);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const html=document.documentElement;

const archivo=document.getElementById('archivo');
const grid=document.getElementById('grid');
const count=document.getElementById('aCount');
const filterBtns=[...document.querySelectorAll('.filtros button')];
const muroEl=document.getElementById('muro');

/* ---------- muro (si se puede) ---------- */
let muro=null;
if(!reduce){
  muroEl.hidden=false;
  try{
    muro=initMuro({wrap:muroEl,fotos:FOTOS,onOpen:i=>open(i,null),
      labels:FOTOS.map((f,i)=>({ev:evId(i),cam:camId(i),cat:CATS[f.cat]||'OBJETO',hora:stamp(i)}))});
  }catch(err){muro=null}
  if(!muro)muroEl.hidden=true;
}
archivo.classList.toggle('muro-on',!!muro);

/* ---------- grilla (respaldo visible, o lista accesible del muro) ---------- */
const frag=document.createDocumentFragment();
FOTOS.forEach((f,i)=>{
  const li=document.createElement('li');li.className='ev-card';li.dataset.cat=f.cat;li.dataset.i=i;
  const h=Math.round(480*f.h/f.w);
  // con el muro activo no se cargan las miniaturas de la grilla (ya están en el atlas)
  const img=muro?'':`<img src="img/archivo/sm/${f.id}.webp" width="480" height="${h}" alt="${f.alt}" loading="lazy" decoding="async">`;
  li.innerHTML=`<button type="button" class="ev-btn" aria-label="Abrir ${evId(i)}: ${f.alt}">${img}
    <span class="ev-tag ev-tl">${evId(i)}</span><span class="ev-tag ev-tr">${camId(i)}</span>
    <span class="ev-tag ev-bl">${CATS[f.cat]||'OBJETO'}</span><span class="ev-tag ev-br">${stamp(i)}</span>
  </button>`;
  frag.appendChild(li);
});
grid.appendChild(frag);
const cards=[...grid.children];

if(muro){
  // Tab sobre la lista oculta: el muro centra y "analiza" el monitor de esa foto
  grid.addEventListener('focusin',e=>{const li=e.target.closest('.ev-card');if(!li)return;
    // el navegador scrollea hasta la lista oculta: reencuadrar para que el muro quede entero a la vista
    requestAnimationFrame(()=>{muroEl.scrollIntoView({block:'center'});muro.focusPhoto(+li.dataset.i)})});
  grid.addEventListener('focusout',e=>{if(!grid.contains(e.relatedTarget))muro.blurFocus()});
}else if('IntersectionObserver' in window){
  // aparición al entrar en pantalla (una sola vez por tarjeta)
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{rootMargin:'0px 0px -6% 0px'});
  cards.forEach(c=>io.observe(c));
}else cards.forEach(c=>c.classList.add('in'));

/* ---------- filtros ---------- */
filterBtns.forEach(b=>{const f=b.dataset.f;b.querySelector('b').textContent=pad(f==='todo'?FOTOS.length:FOTOS.filter(x=>x.cat===f).length)});
let visible=FOTOS.map((_,i)=>i),filtro='todo';
function setFilter(f){
  const changed=f!==filtro;filtro=f;
  filterBtns.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.f===f)));
  visible=[];
  cards.forEach((c,i)=>{const on=f==='todo'||c.dataset.cat===f;c.hidden=!on;if(on){visible.push(i);c.classList.add('in')}});
  count.textContent=pad(visible.length)+' ARCHIVOS'+(f==='todo'?'':' · '+CATS[f]);
  const n=document.getElementById('muroN');if(n)n.textContent=pad(visible.length);
  if(muro&&changed)muro.setList(visible.slice());
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
function open(i,btn){
  if(visible.indexOf(i)<0)return;
  opener=btn||document.activeElement;html.classList.add('lock');dlg.showModal();show(i);
}
function close(){dlg.close()}

grid.addEventListener('click',e=>{const b=e.target.closest('.ev-btn');if(!b)return;open(+b.parentElement.dataset.i,b)});
document.getElementById('vClose').addEventListener('click',close);
document.getElementById('vPrev').addEventListener('click',()=>step(-1));
document.getElementById('vNext').addEventListener('click',()=>step(1));
dlg.addEventListener('close',()=>{html.classList.remove('lock');vImg.removeAttribute('src');cur=-1;
  if(opener&&opener!==document.body&&document.contains(opener))opener.focus({preventScroll:true})});
dlg.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();step(1)}else if(e.key==='ArrowLeft'){e.preventDefault();step(-1)}});
// clic en el fondo vacío cierra
dlg.addEventListener('click',e=>{if(e.target===dlg||e.target.classList.contains('v-frame')||e.target.classList.contains('v-fig'))close()});
// swipe horizontal en celular
let sx=null,sy=0;
vImg.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY});
vImg.addEventListener('pointerup',e=>{if(sx===null)return;const dx=e.clientX-sx,dy=e.clientY-sy;sx=null;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.3)step(dx<0?1:-1)});

/* ---------- anclas con scroll suave ---------- */
document.addEventListener('click',e=>{
  const a=e.target.closest('a[href^="#"]');if(!a)return;
  const id=a.getAttribute('href').slice(1);
  if(id==='top'){e.preventDefault();scrollTo({top:0,behavior:reduce?'auto':'smooth'});return}
  const t=document.getElementById(id);if(!t)return;
  e.preventDefault();t.scrollIntoView({behavior:reduce?'auto':'smooth'});
  if(!t.hasAttribute('tabindex'))t.setAttribute('tabindex','-1');t.focus({preventScroll:true});
  // "saltar al archivo" con el muro activo: abre el visor en la primera evidencia (se navega con las flechas)
  if(a.classList.contains('skip')&&muro&&visible.length){
    const first=cards[visible[0]].querySelector('.ev-btn');open(visible[0],first);
  }
});

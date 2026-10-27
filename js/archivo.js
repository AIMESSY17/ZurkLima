/* ARCHIVO: muro infinito (WebGL), filtros, ficha técnica de cada foto y grilla de respaldo.
   - Con WebGL y sin "reducir movimiento": se usa el MURO (js/muro.js). La grilla queda en el DOM
     sin imágenes, oculta a la vista pero accesible con teclado/lector (Tab centra el monitor en el muro).
   - Sin WebGL o con prefers-reduced-motion: se muestra la grilla clásica (respaldo). */
import {FOTOS} from './archivo-data.js';
import {initMuro} from './muro.js';
import {initFicha} from './ficha.js';

const CATS={'retratos':'RETRATOS','calle':'CALLE','en-vivo':'EN VIVO'};
const pad=(n,l=2)=>String(n).padStart(l,'0');
const evId=i=>'EV-'+pad(i+1);
const camId=i=>'CAM '+pad((i*3)%21+1);
// sello de cámara: fecha y hora de la toma (datos/fotos.json) → "14.03.25 · 22:14"
const stamp=i=>{const [y,m,d]=FOTOS[i].fecha.split('-');return d+'.'+m+'.'+y.slice(2)+' · '+FOTOS[i].hora};
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
    muro=initMuro({wrap:muroEl,fotos:FOTOS,onOpen:(i,rect)=>open(i,muroEl.querySelector('.muro-gl'),rect),
      labels:FOTOS.map((f,i)=>({ev:evId(i),cam:camId(i),cat:CATS[f.cat]||'OBJETO',hora:stamp(i)}))});
  }catch(err){muro=null}
  if(!muro)muroEl.hidden=true;
}
archivo.classList.toggle('muro-on',!!muro);

/* ---------- expediente del fondo: ÚLTIMA TOMA = la foto más reciente ---------- */
{const last=[...FOTOS].sort((a,b)=>(a.fecha+a.hora).localeCompare(b.fecha+b.hora)).pop();
  const el=document.getElementById('ultimaToma');
  if(el&&last){const [y,m,d]=last.fecha.split('-');el.textContent=last.lugar+' · '+d+'/'+m+'/'+y}}

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

/* ---------- ficha técnica (js/ficha.js) ---------- */
const ficha=initFicha({fotos:FOTOS,cam:camId,getVisible:()=>visible,
  onOpenChange:on=>{if(!on&&muro)muro.blurFocus()}});
// opener: elemento al que vuelve el foco al cerrar · rect: monitor del muro (vuela desde ahí)
function open(i,opener,rect){
  if(visible.indexOf(i)<0){setFilter('todo')}
  const src=opener&&opener.querySelector?opener.querySelector('img'):null;
  ficha.open(i,{rect:rect||(src&&src.getBoundingClientRect())||null,src,opener});
}
grid.addEventListener('click',e=>{const b=e.target.closest('.ev-btn');if(!b)return;
  // con el muro activo la lista está oculta: sin vuelo, solo el barrido de color
  open(+b.parentElement.dataset.i,b,muro?null:undefined)});
if(muro)muroEl.querySelector('.muro-gl').tabIndex=-1;
// link directo a una ficha (#zk-014)
ficha.openFromHash();

/* ---------- anclas con scroll suave ---------- */
document.addEventListener('click',e=>{
  const a=e.target.closest('a[href^="#"]');if(!a)return;
  const id=a.getAttribute('href').slice(1);
  if(/^zk-\d+$/i.test(id))return;   // links a fichas: los maneja js/ficha.js
  if(id==='top'){e.preventDefault();scrollTo({top:0,behavior:reduce?'auto':'smooth'});return}
  const t=document.getElementById(id);if(!t)return;
  e.preventDefault();t.scrollIntoView({behavior:reduce?'auto':'smooth'});
  if(!t.hasAttribute('tabindex'))t.setAttribute('tabindex','-1');t.focus({preventScroll:true});
  // "saltar al archivo" con el muro activo: abre la ficha de la primera evidencia (se navega con las flechas)
  if(a.classList.contains('skip')&&muro&&visible.length){
    const first=cards[visible[0]].querySelector('.ev-btn');open(visible[0],first);
  }
});

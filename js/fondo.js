import {DET} from './deteccion.js';

const N=108, FREEZE=60, SUBJ=[0.589,0.727,0.641,0.975];
const VA=16/9, PA=1616/1080;
const FACE=[0.40,0.05,0.63,0.57];
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const seg=(p,a,b)=>clamp((p-a)/(b-a));
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const lerp=(a,b,t)=>a+(b-a)*t;

/* ---------- carga ---------- */
const frames=new Array(N);let loaded=0;
const total=N+2;
const bootPct=document.getElementById('bootPct'),boot=document.getElementById('boot');
function tick(){loaded++;bootPct.textContent=String(Math.min(99,Math.round(loaded/total*100))).padStart(2,'0')+'%'}
function loadImg(src){return new Promise(r=>{const i=new Image();i.decoding='async';i.onload=()=>{tick();r(i)};i.onerror=()=>{tick();r(null)};i.src=src})}
const freezeP=loadImg('img/freeze.webp'), portraitP=loadImg('img/subject.webp');
const frameP=[];
for(let i=0;i<N;i++){frameP.push(loadImg('frames/f'+String(i+1).padStart(3,'0')+'.webp').then(im=>frames[i]=im))}

/* ---------- WebGL ---------- */
const cv=document.getElementById('gl');
const gl=cv.getContext('webgl',{antialias:false,premultipliedAlpha:false});
const VS=`attribute vec2 a;varying vec2 vUv;void main(){vUv=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}`;
const FS=`precision highp float;
uniform sampler2D uT0,uT1;uniform vec2 uRes,uC,uS,uC2,uS2;uniform float uTime,uFish,uTiles,uPix,uGlitch,uNV,uMix,uFlash;
varying vec2 vUv;
float h(float n){return fract(sin(n*127.1)*43758.5453);}
float h2(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
vec3 nvg(vec3 c){float l=dot(c,vec3(.299,.587,.114));l=pow(clamp(l*1.3,0.,1.),1.15);return vec3(.30,1.,.36)*l+vec3(0.,.03,.008);}
vec3 samp(sampler2D t,vec2 v,float ab){return vec3(texture2D(t,v+vec2(ab,0.)).r,texture2D(t,v).g,texture2D(t,v-vec2(ab,0.)).b);}
void main(){
  vec2 s=vUv;float A=uRes.x/uRes.y;
  float band=floor(s.y*30.+floor(uTime*16.)*3.1);
  float gk=step(1.-uGlitch*.6,h(band));
  s.x+=gk*(h(band+3.7)-.5)*.22*uGlitch;
  vec2 P=(s-.5)*vec2(A,1.);
  float R=.47*min(A,1.);
  float r=length(P)/R;float rc=clamp(r,.001,.9999);
  float w=asin(rc)/(rc*1.5708);
  vec2 sw=.5+P*mix(1.,w,uFish)/vec2(A,1.);
  vec2 v=uC+(sw-.5)*uS;
  vec2 tv=(v-.5)*uTiles+.5;
  vec2 fv=uTiles>1.001?fract(tv):clamp(tv,0.,1.);
  float edge=min(min(fv.x,1.-fv.x),min(fv.y,1.-fv.y));
  float gut=mix(1.,smoothstep(.0,.012,edge),clamp(uTiles-1.,0.,1.));
  float px=mix(1800.,46.,uPix*uPix);
  if(uPix>.001){vec2 g=vec2(px,px/1.7778);fv=(floor(fv*g)+.5)/g;}
  float ab=.0012+uGlitch*.014+uFish*.003*r;
  vec3 c=samp(uT0,fv,ab);
  vec2 v2=uC2+(s-.5)*uS2;
  vec3 c2=samp(uT1,clamp(v2,0.,1.),ab*.8);
  float pm=uMix>=.999?1.:step(h(floor(s.y*22.)+floor(uTime*14.)*5.3),uMix);
  vec3 col=mix(c,c2,pm);
  vec3 photo=pow(col,vec3(1.08))*1.12;
  vec3 g=mix(photo,nvg(col),uNV);
  g*=gut;
  float m=mix(1.,smoothstep(1.,.982,r),uFish);
  float rim=uFish*smoothstep(.035,0.,abs(r-1.));
  g=g*m+vec3(.35,1.,.4)*rim*.55;
  g*=mix(1.,.86+.14*sin(gl_FragCoord.y*1.7),.75);
  float gr=h2(gl_FragCoord.xy*.73+fract(uTime*7.3)*91.);
  g+=(gr-.5)*.11;
  vec2 q=(vUv-.5)*vec2(A,1.)/max(A,1.);
  g*=mix(.42,1.,smoothstep(.95,.25,length(q)*1.35));
  g+=uFlash;
  gl_FragColor=vec4(g,1.);
}`;
function sh(t,src){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(s));return s}
const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);gl.useProgram(pr);
const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
const al=gl.getAttribLocation(pr,'a');gl.enableVertexAttribArray(al);gl.vertexAttribPointer(al,2,gl.FLOAT,false,0,0);
const U={};['uT0','uT1','uRes','uC','uS','uC2','uS2','uTime','uFish','uTiles','uPix','uGlitch','uNV','uMix','uFlash'].forEach(n=>U[n]=gl.getUniformLocation(pr,n));
function mkTex(unit){const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));return t}
const T0=mkTex(0),T1=mkTex(1);gl.uniform1i(U.uT0,0);gl.uniform1i(U.uT1,1);
let curTex=null;
function setFrame(img){if(!img||img===curTex)return;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,T0);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);curTex=img}

/* ---------- HUD ---------- */
const hud=document.getElementById('hud'),cx=hud.getContext('2d');
let W=0,H=0,DPR=1;
// calidad adaptativa: multiplica la resolución del WebGL (tope 1.5); baja sola si los FPS caen
let quality=1,ftAvg=16.7,ftN=0,lastNow=0;
function resize(){DPR=Math.min(devicePixelRatio||1,2);W=cv.clientWidth;H=cv.clientHeight;
  const gs=Math.min(DPR,1.5)*quality;cv.width=Math.round(W*gs);cv.height=Math.round(H*gs);gl.viewport(0,0,cv.width,cv.height);
  hud.width=Math.round(W*DPR);hud.height=Math.round(H*DPR);cx.setTransform(DPR,0,0,DPR,0,0)}
addEventListener('resize',resize);resize();

const AMB='#FFD23A',RED='#FF2B2B',INK='#F1F4EC',NV='#8CFF5A';
function corners(x,y,w,h,col,lw,len){cx.strokeStyle=col;cx.lineWidth=lw;const l=Math.min(len,w*.4,h*.4);cx.beginPath();
  cx.moveTo(x,y+l);cx.lineTo(x,y);cx.lineTo(x+l,y);cx.moveTo(x+w-l,y);cx.lineTo(x+w,y);cx.lineTo(x+w,y+l);
  cx.moveTo(x+w,y+h-l);cx.lineTo(x+w,y+h);cx.lineTo(x+w-l,y+h);cx.moveTo(x+l,y+h);cx.lineTo(x,y+h);cx.lineTo(x,y+h-l);cx.stroke()}
function tag(x,y,txt,bg,fg,size=14){cx.font=size+'px VT323, monospace';const w=cx.measureText(txt).width+8;cx.fillStyle=bg;cx.fillRect(x,y-size-2,w,size+3);cx.fillStyle=fg;cx.fillText(txt,x+4,y-2)}
function note(x0,y0,x1,y1,lines,col,a){if(a<=0)return;cx.globalAlpha=a;
  const fs=Math.round(clamp(W/60,14,21));cx.font='700 '+fs+'px "Courier Prime", monospace';
  const mw=Math.max(...lines.map(l=>cx.measureText(l).width));const left=x1<x0;
  if(left&&x1-6-mw<12)x1=12+mw+6;if(!left&&x1+6+mw>W-12)x1=W-12-mw-6;
  y1=Math.max(y1,fs*lines.length+60);
  cx.setLineDash([5,4]);cx.strokeStyle=col;cx.lineWidth=1.6;
  cx.beginPath();cx.moveTo(x0,y0);cx.lineTo(x1,y1);cx.stroke();cx.setLineDash([]);
  cx.fillStyle=col;cx.beginPath();cx.arc(x0,y0,3.5,0,7);cx.fill();cx.beginPath();cx.arc(x1,y1,2.5,0,7);cx.fill();
  cx.textAlign=left?'right':'left';
  cx.shadowColor='rgba(0,0,0,.9)';cx.shadowBlur=6;
  lines.forEach((t,i)=>cx.fillText(t,x1+(x1<x0?-6:6),y1-6-(lines.length-1-i)*fs*1.05));
  cx.shadowBlur=0;cx.textAlign='left';cx.globalAlpha=1}
function cross(x,y,s,col,lw=2){cx.strokeStyle=col;cx.lineWidth=lw;cx.beginPath();cx.moveTo(x-s,y);cx.lineTo(x+s,y);cx.moveTo(x,y-s);cx.lineTo(x,y+s);cx.stroke()}
function sun(x,y,col){cx.strokeStyle=col;cx.fillStyle=col;cx.lineWidth=1.5;cx.beginPath();cx.arc(x,y,4,0,7);cx.fill();for(let k=0;k<8;k++){const a=k*Math.PI/4;cx.beginPath();cx.moveTo(x+Math.cos(a)*7,y+Math.sin(a)*7);cx.lineTo(x+Math.cos(a)*11,y+Math.sin(a)*11);cx.stroke()}}

/* ---------- consola ---------- */
const LOG=[[0,'> cam07.connect("NQN-CENTRO") ... OK'],[.08,'> feed.mode = NVG / 40° FOV'],[.16,'> lens.unwarp() ... 3x3 → 1'],[.24,'> scan --faces --all'],[.34,'> 2.418 rostros indexados'],[.42,'> freeze --frame 0061'],[.47,'> lock target 0299'],[.55,'> threat.level = MUY ALTA'],[.62,'> zoom --follow 0299 --x3'],[.68,'> enhance --x8'],[.77,'> identity.lookup(db.NQN)'],[.84,'> match 99.7% → "BRUNO · ZURKLIMA"'],[.9,'> expediente.open(0299)']];
const con=document.getElementById('console');let lastLog=-1;
function setLog(p){let n=0;for(let i=0;i<LOG.length;i++)if(p>=LOG[i][0])n=i;if(n===lastLog)return;lastLog=n;con.textContent=LOG.slice(Math.max(0,n-3),n+1).map(l=>l[1]).join('\n')}

/* ---------- loop ---------- */
const track=document.getElementById('track'),hero=document.getElementById('hero'),enh=document.getElementById('enh'),enhBar=document.getElementById('enhBar'),enhLbl=document.getElementById('enhLbl'),cut=document.getElementById('cut'),file=document.getElementById('file'),stateEl=document.getElementById('state'),frRd=document.getElementById('frRd'),zoomRd=document.getElementById('zoomRd'),clock=document.getElementById('clock');
const railEls=[...document.querySelectorAll('#rail span')];
let pS=0,freezeImg=null,portraitImg=null,started=false,t0=performance.now();
// anti-lag: el loop solo corre mientras el sticky está en pantalla
let onScreen=true,running=false;
function startLoop(){if(started&&onScreen&&!running){running=true;lastNow=0;requestAnimationFrame(frame)}}
new IntersectionObserver(([e])=>{onScreen=e.isIntersecting;startLoop()},{rootMargin:'-2px 0px'}).observe(document.getElementById('stage'));
function progress(){const r=track.getBoundingClientRect();const span=track.offsetHeight-innerHeight;return clamp(-r.top/span)}
function pad(n){return String(n).padStart(2,'0')}

function frame(now){
  if(!onScreen){running=false;return}
  requestAnimationFrame(frame);
  const t=(now-t0)/1000;
  const dt=now-lastNow;lastNow=now;
  if(dt>0&&dt<100){ftAvg+=(dt-ftAvg)*.05;if(++ftN>90&&ftAvg>24&&quality>.55){quality=Math.max(.55,quality*.8);ftN=0;ftAvg=16.7;resize()}}
  const pT=progress();pS+=(pT-pS)*(reduce?1:.14);if(Math.abs(pT-pS)<.0004)pS=pT;const p=pS;
  const A=W/H;

  // estados
  const unfold=ease(seg(p,.09,.23));
  const fish=1-unfold, tiles=1+2*(1-ease(seg(p,.06,.21)));
  const frozen=p>=.42;
  const zoomK1=ease(seg(p,.44,.5)),zoomK=ease(seg(p,.58,.72)), zoom=1+.55*zoomK1+1.55*zoomK, camK=Math.max(zoomK1*.85,zoomK);
  const pix=ease(seg(p,.66,.77));
  const mix=seg(p,.765,.805);
  const nv=1-ease(seg(p,.83,.92))*.92;
  let glitch=0;
  glitch=Math.max(glitch,Math.sin(Math.PI*seg(p,.735,.82))*1.0);
  glitch=Math.max(glitch,Math.sin(Math.PI*seg(p,.405,.44))*.7);
  glitch=Math.max(glitch,Math.sin(Math.PI*seg(p,.1,.2))*.35);
  if(!reduce&&p<.42){const b=Math.sin(t*1.7)+Math.sin(t*2.9);if(b>1.75)glitch=Math.max(glitch,.35)}
  const flash=Math.max(Math.sin(Math.PI*seg(p,.415,.435))*.55,Math.sin(Math.PI*seg(p,.775,.79))*.4);

  // textura del video
  let fi;
  if(frozen&&freezeImg){setFrame(freezeImg);fi=FREEZE}
  else{fi=Math.floor(t*(reduce?2:9))%N;let k=0;while(!frames[fi]&&k<N){fi=(fi+1)%N;k++}setFrame(frames[fi])}

  // mapeo plano (cover) + zoom hacia el sujeto
  const sc=A>VA?[1,VA/A]:[A/VA,1];
  const S=[sc[0]/zoom,sc[1]/zoom];
  const subjC=[(SUBJ[0]+SUBJ[2])/2,(SUBJ[1]+SUBJ[3])/2];
  let c0=[A<VA?clamp(subjC[0],sc[0]/2,1-sc[0]/2):.5,.5];
  let C=[lerp(c0[0],subjC[0],camK),lerp(c0[1],subjC[1]-.03,camK)];
  C=[clamp(C[0],S[0]/2,1-S[0]/2),clamp(C[1],S[1]/2,1-S[1]/2)];
  // retrato
  const wide=A>1.15;
  const zp=(wide?1.22:1)+.06*seg(p,.8,1);
  const sc2=A>PA?[1,PA/A]:[A/PA,1];const S2=[sc2[0]/zp,sc2[1]/zp];
  const face=[(FACE[0]+FACE[2])/2,(FACE[1]+FACE[3])/2];
  const tgt=wide?[.34,.5]:[.5,.27];
  let C2=[face[0]-(tgt[0]-.5)*S2[0],face[1]-(tgt[1]-.5)*S2[1]];
  C2=[clamp(C2[0],S2[0]/2,1-S2[0]/2),clamp(C2[1],S2[1]/2,1-S2[1]/2)];

  gl.uniform2f(U.uRes,cv.width,cv.height);gl.uniform2f(U.uC,C[0],C[1]);gl.uniform2f(U.uS,S[0],S[1]);
  gl.uniform2f(U.uC2,C2[0],C2[1]);gl.uniform2f(U.uS2,S2[0],S2[1]);
  gl.uniform1f(U.uTime,reduce?0:t);gl.uniform1f(U.uFish,fish);gl.uniform1f(U.uTiles,tiles);gl.uniform1f(U.uPix,pix);
  gl.uniform1f(U.uGlitch,reduce?glitch*.3:glitch);gl.uniform1f(U.uNV,nv);gl.uniform1f(U.uMix,mix);gl.uniform1f(U.uFlash,flash);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);

  // ---------- HUD 2D ----------
  cx.clearRect(0,0,W,H);
  const toS=(x,y)=>[(.5+(x-C[0])/S[0])*W,(.5+(y-C[1])/S[1])*H];
  const toS2=(x,y)=>[(.5+(x-C2[0])/S2[0])*W,(.5+(y-C2[1])/S2[1])*H];

  // fase esfera: anotaciones fijas estilo referencia
  const aA=1-seg(p,.05,.12);
  if(aA>0){const R=.47*Math.min(A,1)*H;const ox=W/2,oy=H/2;
    note(ox-R*.55,oy-R*.18,ox-R*.92,oy-R*.42,['unidentified','existence'],INK,aA);
    note(ox+R*.42,oy-R*.42,ox+R*.62,oy-R*.78,['WARNING:','DANGEROUSLY','CREATIVE'],AMB,aA);
    note(ox+R*.3,oy+R*.32,ox+R*.72,oy+R*.18,['search','required'],INK,aA);
    cx.globalAlpha=aA;cross(ox-R*.62,oy+R*.05,14,RED,3);corners(ox-R*.82,oy-R*.12,R*.38,R*.42,AMB,2,22);
    corners(ox+R*.18,oy+R*.48,R*.22,R*.22,AMB,3,18);sun(ox+R*.44,oy-R*.02,AMB);cross(ox+R*.72,oy+R*.5,20,AMB,1.5);cx.globalAlpha=1}

  // centro
  if(p<.42){const ca=seg(p,.12,.2)*(1-seg(p,.38,.42));if(ca>0){cx.globalAlpha=ca*.8;cross(W/2,H/2,16,AMB,1.5);cx.globalAlpha=1}}

  // scan en vivo
  const live=seg(p,.22,.27)*(1-seg(p,.4,.42));
  if(live>0){
    const list=DET[fi]||[];cx.globalAlpha=live;
    list.forEach(b=>{const [x1,y1]=toS(b[0],b[1]),[x2,y2]=toS(b[2],b[3]);const w=x2-x1,h=y2-y1;if(x2<0||x1>W||y2<0||y1>H)return;
      corners(x1,y1,w,h,AMB,1.6,12);if(h>26)tag(x1,y1,'PERSON '+Math.round(b[4]*100)+'%',AMB,'#000',13)});
    const sy=((t*.35)%1)*H;const g=cx.createLinearGradient(0,sy-40,0,sy);g.addColorStop(0,'rgba(140,255,90,0)');g.addColorStop(1,'rgba(140,255,90,.28)');
    cx.fillStyle=g;cx.fillRect(0,sy-40,W,40);cx.fillStyle=NV;cx.fillRect(0,sy,W,1);
    cx.globalAlpha=1;
  }

  // freeze + lock
  if(frozen&&p<.79){
    const list=DET[FREEZE];const lockK=seg(p,.47,.49);
    list.forEach((b,i)=>{
      const isS=Math.abs(b[0]-SUBJ[0])<.005&&Math.abs(b[1]-SUBJ[1])<.005;
      const [x1,y1]=toS(b[0],b[1]),[x2,y2]=toS(b[2],b[3]);const w=x2-x1,h=y2-y1;
      if(isS)return;
      const fade=1-seg(p,.455+i*.006,.47+i*.006);if(fade<=0)return;
      cx.globalAlpha=fade;corners(x1,y1,w,h,AMB,1.6,12);if(h>26)tag(x1,y1,'PERSON '+Math.round(b[4]*100)+'%',AMB,'#000',13);cx.globalAlpha=1});
    // sujeto
    const [x1,y1]=toS(SUBJ[0],SUBJ[1]),[x2,y2]=toS(SUBJ[2],SUBJ[3]);const w=x2-x1,h=y2-y1;
    const aS=1-seg(p,.74,.78);
    cx.globalAlpha=aS;
    const col=lockK>0?RED:AMB;const pad=lockK*10*(1+.15*Math.sin(t*6));
    corners(x1-pad,y1-pad,w+pad*2,h+pad*2,col,2.4+lockK,18);
    const conf=Math.round(lerp(34,99,ease(seg(p,.47,.56))));
    tag(x1-pad,y1-pad,(lockK>0?'TARGET 0299 · ':'PERSON ')+conf+'%',col,lockK>0?'#fff':'#000',Math.round(clamp(W/90,13,18)));
    if(lockK>0){cross((x1+x2)/2,y1+h*.18,Math.max(10,w*.35),RED,2.5);
      cx.strokeStyle='rgba(255,43,43,.5)';cx.lineWidth=1;cx.beginPath();cx.moveTo(0,y1+h*.18);cx.lineTo(x1-pad-4,y1+h*.18);cx.moveTo(x2+pad+4,y1+h*.18);cx.lineTo(W,y1+h*.18);cx.stroke()}
    cx.globalAlpha=1;
    // anotaciones pegadas al sujeto
    const mx=(x1+x2)/2,my=(y1+y2)/2;const narrow=W<700;const dx=narrow?clamp(W*.2,50,110):clamp(W*.14,110,260);
    const nA=aS*(1-seg(p,.6,.64));
    note(x1+w*.35,y1+h*.1,x1-dx,y1-h*.7,['unidentified','existence'],INK,seg(p,.5,.53)*nA);
    note(x2-w*.15,y1+h*.12,x2+dx,y1-h*1.05,['WARNING:','DANGEROUSLY','CREATIVE'],AMB,seg(p,.52,.55)*nA);
    if(!narrow)note(x1+w*.15,y1+h*.42,x1-dx*1.1,y1+h*.05,['WARNING:','ARMED WITH CAMERA BAG'],RED,seg(p,.54,.57)*nA);
    note(x2-w*.25,y1+h*.7,x2+dx*.9,y1+h*.12,['search','required'],INK,seg(p,.56,.59)*nA);
    if(lockK>0&&aS>0){cx.globalAlpha=aS;cx.font=Math.round(clamp(W/70,14,20))+'px VT323, monospace';cx.fillStyle=NV;
      const tx=Math.min(x2+12,W-cx.measureText('AnataWaZurklima(Definite)').width-10);cx.fillText('AnataWaZurklima(Definite)',tx,my);cx.fillText(', dist='+(0.61+.3*zoomK).toFixed(2),tx,my+18);cx.fillText(', cos='+(3.10-zoomK*1.2).toFixed(2),tx,my+36);cx.globalAlpha=1}
  }

  // retrato: escaneo facial
  if(p>.79){
    const [fx1,fy1]=toS2(FACE[0],FACE[1]),[fx2,fy2]=toS2(FACE[2],FACE[3]);const fw=fx2-fx1,fh=fy2-fy1;
    const sA=seg(p,.79,.81)*(1-seg(p,.9,.93)*.75);
    cx.globalAlpha=sA;
    const matched=p>.845;const col=matched?AMB:RED;
    corners(fx1,fy1,fw,fh,col,3,26);
    // malla
    cx.strokeStyle=matched?'rgba(255,210,58,.45)':'rgba(140,255,90,.45)';cx.lineWidth=1;
    const pts=[];for(let j=0;j<7;j++)for(let i=0;i<5;i++){const jx=Math.sin(i*7.1+j*3.3)*.08,jy=Math.cos(i*5.3+j*2.1)*.05;pts.push([fx1+fw*(.12+i*.19+jx),fy1+fh*(.1+j*.13+jy)])}
    const scanY=fy1+fh*((t*.6)%1);
    cx.beginPath();for(let j=0;j<7;j++)for(let i=0;i<5;i++){const a=pts[j*5+i];if(i<4){const b=pts[j*5+i+1];cx.moveTo(a[0],a[1]);cx.lineTo(b[0],b[1])}if(j<6){const b=pts[(j+1)*5+i];cx.moveTo(a[0],a[1]);cx.lineTo(b[0],b[1])}if(i<4&&j<6){const b=pts[(j+1)*5+i+1];cx.moveTo(a[0],a[1]);cx.lineTo(b[0],b[1])}}cx.stroke();
    cx.fillStyle=matched?AMB:NV;pts.forEach(a=>{cx.fillRect(a[0]-1.5,a[1]-1.5,3,3)});
    if(!matched){cx.fillStyle='rgba(140,255,90,.8)';cx.fillRect(fx1,scanY,fw,2)}
    // ojos
    const eyes=[[.47,.30],[.565,.30]].map(e=>toS2(e[0],e[1]));eyes.forEach(e=>{cx.strokeStyle=col;cx.lineWidth=1.5;cx.strokeRect(e[0]-12,e[1]-8,24,16)});
    const fs=Math.round(clamp(W/45,16,28));
    const ty=fy1<fs+70?Math.max(fs+70,fy1+fs+10):fy1;
    tag(Math.max(fx1,12),ty,matched?'IDENTITY: BRUNO · ZURKLIMA · 99.7%':'IDENTITY: UNKNOWN',col,matched?'#000':'#fff',fs);
    if(!matched){const pc=Math.round(lerp(12,99,seg(p,.8,.845)));tag(fx1,fy2+fs+8,'MATCHING DB.NQN '+pc+'%',RED,'#fff',Math.round(fs*.7))}
    cx.globalAlpha=1;
  }

  // ---------- DOM ----------
  hero.style.opacity=1-seg(p,.02,.09);hero.style.transform='scale('+(1+seg(p,0,.09)*.08)+')';
  const ek=seg(p,.66,.69)*(1-seg(p,.76,.78));enh.style.opacity=ek;const ep=Math.round(seg(p,.67,.765)*100);enhBar.style.width=ep+'%';enhLbl.textContent='RECONSTRUYENDO ROSTRO '+pad(Math.min(ep,99))+'%';
  cut.style.opacity=0;
  file.classList.toggle('on',p>.9);
  let st='LIVE',al=false;if(p>=.24)st='SCANNING';if(frozen){st='FRAME FROZEN';}if(p>=.47){st='TARGET LOCKED';al=true}if(p>=.66){st='ENHANCE x8';al=false}if(p>=.79){st='IDENTIFYING';al=true}if(p>=.845){st='MATCH 99.7%';al=false}
  if(stateEl.textContent!==st){stateEl.textContent=st;stateEl.classList.toggle('alert',al)}
  frRd.textContent='FR '+String(fi+1).padStart(4,'0')+'/0108';zoomRd.textContent=(p>.79?zp*1:zoom).toFixed(1);
  railEls.forEach((el,i)=>{const a=+el.dataset.a,b=i<railEls.length-1?+railEls[i+1].dataset.a:2;el.classList.toggle('on',p>=a&&p<b)});
  setLog(p);
  const d=new Date();clock.textContent=pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear()+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
}

Promise.all([freezeP,portraitP,frameP[0]]).then(([fz,pt])=>{
  freezeImg=fz;portraitImg=pt;
  if(pt){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,T1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,pt)}
  const go=()=>{boot.classList.add('gone');if(!started){started=true;startLoop()}};
  Promise.race([Promise.all(frameP),new Promise(r=>setTimeout(r,2500))]).then(go);
});

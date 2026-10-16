// ══════════════════════════════════════════════════════════════
// Straßenlabor · 3D-Ansicht (wie Shadowmap, offen und frei): Gebäude aus der
// 3D BAG (gemessene Höhen), Registerbäume mit gemessener Höhe, Boden aus der BGT
// oder dem Luftbild — Schattenwurf in Echtzeit (three.js, Shadow-Mapping) zum
// Sonnenstand des Zeitreglers. Kamera frei drehbar, Augenhöhe, Sonnenbahn am
// Himmel, Tagesverlauf und „Stadt wächst" (Baujahre) als Bewegung.
// ══════════════════════════════════════════════════════════════
(function(){
'use strict';
const LAB=window.LAB;if(!LAB||!LAB.api)return;
const A=LAB.api,T=(d,e,n)=>A.T(d,e,n);
const V={on:false,busy:false,err:null,R:320,ground:'map',eye:false,grow:null,stats:null};
LAB.v3d=V;
let THREE=null,ren,scene,cam,sunL,hemi,sunBall,pathLine,groundMat,root,buckets=[],trees=null,el=null,raf=0,dirty=true,lastSun='';
const CAM={th:-2.35,ph:1.0,r:620,tx:0,tz:0,yaw:0,pitch:.08};   // Umlaufkamera (Kugelkoordinaten) und Augenhöhe
let C0=null;                                                  // Mittelpunkt in RD-Metern

const three=()=>THREE?Promise.resolve(THREE):import('https://cdn.jsdelivr.net/npm/three@0.160.0/+esm').then(m=>(THREE=m));
const loc=(x,y)=>{const ll=A.map.unproject([x,y],20),r=A.toRD(ll.lat,ll.lng);return [r[0]-C0[0],r[1]-C0[1]];};   // Weltpixel → Meter (Ost, Nord)
const sunDir=sun=>{const c=Math.cos(sun.alt);return [-Math.sin(sun.az)*c,Math.sin(sun.alt),Math.cos(sun.az)*c];};   // three: x = Ost, y = oben, z = Süd

// ── Geometrie ──
function pushTri(P,N,Cc,a,b,c,n,col){   // Dreieck mit Außen-Normalen, Wicklung passend gemacht
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],gx=uy*vz-uz*vy,gy=uz*vx-ux*vz,gz=ux*vy-uy*vx;
  if(gx*n[0]+gy*n[1]+gz*n[2]<0){const t=b;b=c;c=t;}
  for(const p of [a,b,c]){P.push(p[0],p[1],p[2]);N.push(n[0],n[1],n[2]);Cc.push(col[0],col[1],col[2]);}
}
function bldGeo(list,colorOf){
  const P=[],N=[],Cc=[];
  for(const b of list){
    let R=[];for(let i=0;i<b.z.length-2;i+=2)R.push(loc(b.z[i],b.z[i+1]));if(R.length<3)continue;
    let ar=0;for(let i=0;i<R.length;i++){const p=R[i],q=R[(i+1)%R.length];ar+=p[0]*q[1]-q[0]*p[1];}if(ar<0)R.reverse();
    const h=Math.max(1.5,b.h||3),col=colorOf(b);
    for(let i=0;i<R.length;i++){const p=R[i],q=R[(i+1)%R.length],dx=q[0]-p[0],dy=q[1]-p[1],L=Math.hypot(dx,dy);if(L<1e-3)continue;
      const n=[dy/L,0,dx/L],p0=[p[0],0,-p[1]],q0=[q[0],0,-q[1]],q1=[q[0],h,-q[1]],p1=[p[0],h,-p[1]];   // Außennormale (Ost, oben, Süd)
      pushTri(P,N,Cc,p0,q0,q1,n,col);pushTri(P,N,Cc,p0,q1,p1,n,col);}
    const tri=THREE.ShapeUtils.triangulateShape(R.map(p=>new THREE.Vector2(p[0],p[1])),[]),rc=col.map(v=>Math.min(1,v*1.06));
    for(const t of tri)pushTri(P,N,Cc,[R[t[0]][0],h,-R[t[0]][1]],[R[t[1]][0],h,-R[t[1]][1]],[R[t[2]][0],h,-R[t[2]][1]],[0,1,0],rc);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setAttribute('color',new THREE.Float32BufferAttribute(Cc,3));
  return g;
}
const hex2=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const BUCKET=y=>y==null||y<1200?null:y<1600?1500:y<1900?Math.floor(y/50)*50:Math.floor(y/10)*10;
async function build(){
  const c=A.PIN||A.map.getCenter();C0=A.toRD(c.lat,c.lng);
  const R=V.R,dLat=R/111320,dLon=R/(111320*Math.cos(c.lat*A.SR)),bb=L.latLngBounds([c.lat-dLat,c.lng-dLon],[c.lat+dLat,c.lng+dLon]);
  A.status(T('3D-Stadt wird gebaut: Gebäude, Bäume, Boden …','Building the 3D city: buildings, trees, ground …','3D-stad wordt gebouwd: gebouwen, bomen, bodem …'),true);
  const [blds]=await Promise.all([A.ensure('b',bb),A.ensureTrees()]);
  await A.measureTrees();
  const inR=b=>{const p=loc(b.z[0],b.z[1]);return Math.hypot(p[0],p[1])<R;};
  const list=blds.filter(inR);
  root=new THREE.Group();scene.add(root);
  // Gebäude nach Bauzeit gruppiert (für „Stadt wächst"), Farbe hell wie Gips
  const by=new Map();for(const b of list){const k=BUCKET(b.yr);if(!by.has(k))by.set(k,[]);by.get(k).push(b);}
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0});
  buckets=[];for(const [k,bs] of by){const m=new THREE.Mesh(bldGeo(bs,()=>hex2('#f6f2ea')),mat);m.castShadow=m.receiveShadow=true;m.userData={y:k,n:bs.length};root.add(m);buckets.push(m);}
  // Bäume: Stamm + Krone, gemessene Höhe (AHN), Krone aus dem Register
  const ts=A.treesIn(.02,bb).map(t=>{const p=loc(t[4],t[5]);return {x:p[0],z:-p[1],r:Math.max(1.2,t[2]),h:Math.max(3,t[3])};}).filter(t=>Math.hypot(t.x,t.z)<R);
  if(ts.length){const cg=new THREE.IcosahedronGeometry(1,1),tg=new THREE.CylinderGeometry(.18,.25,1,6);
    const cm=new THREE.MeshStandardMaterial({color:0x6f9a5a,roughness:1,flatShading:true}),tm=new THREE.MeshStandardMaterial({color:0x6b5a48,roughness:1});
    const crowns=new THREE.InstancedMesh(cg,cm,ts.length),trunks=new THREE.InstancedMesh(tg,tm,ts.length),o=new THREE.Object3D(),col=new THREE.Color();
    ts.forEach((t,i)=>{const ch=Math.min(2*t.r,.62*t.h);o.position.set(t.x,t.h-ch/2,t.z);o.scale.set(t.r,ch/2,t.r);o.rotation.set(0,i,0);o.updateMatrix();crowns.setMatrixAt(i,o.matrix);
      col.setHSL(.27+((i*37)%10)/200,.32,.42+((i*53)%10)/100);crowns.setColorAt(i,col);
      o.position.set(t.x,(t.h-ch)/2,t.z);o.scale.set(1,Math.max(.5,t.h-ch),1);o.rotation.set(0,0,0);o.updateMatrix();trunks.setMatrixAt(i,o.matrix);});
    crowns.castShadow=crowns.receiveShadow=trunks.castShadow=true;root.add(crowns,trunks);trees=crowns;}
  // Boden: Kreis mit BGT-Flächen (schnell als Fläche, später Textur)
  const gg=new THREE.CircleGeometry(R*1.02,96);gg.rotateX(-Math.PI/2);
  groundMat=new THREE.MeshStandardMaterial({color:0xe9e3d6,roughness:1});const gm=new THREE.Mesh(gg,groundMat);gm.receiveShadow=true;root.add(gm);
  V.stats={b:list.length,t:ts.length,yrs:list.filter(b=>b.yr>=1200).length};
  A.status('');dirty=true;
  paintGround();
}
async function paintGround(){   // Karte (BGT-Flächen) oder Luftbild (PDOK) als Bodentextur
  const R=V.R,N=2048,cv=document.createElement('canvas');cv.width=cv.height=N;const g=cv.getContext('2d');if(!g||typeof g.fillRect!=='function')return;
  const c=A.PIN||A.map.getCenter(),dLat=R/111320,dLon=R/(111320*Math.cos(c.lat*A.SR)),bb=L.latLngBounds([c.lat-dLat,c.lng-dLon],[c.lat+dLat,c.lng+dLon]);
  if(V.ground==='photo'){
    const u=`https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=Actueel_orthoHR&STYLES=&CRS=EPSG:28992&BBOX=${C0[0]-R},${C0[1]-R},${C0[0]+R},${C0[1]+R}&WIDTH=${N}&HEIGHT=${N}&FORMAT=image/jpeg`;
    const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{g.drawImage(img,0,0,N,N);apply(cv);};img.src=u;return;}
  const S=await A.ensure('s',bb);
  g.fillStyle='#ece6da';g.fillRect(0,0,N,N);
  const px=(e,n)=>[(e+R)/(2*R)*N,(R-n)/(2*R)*N],COL={0:'#d9d3c7',1:'#e3dccb',2:'#b8c79a',3:'#9cbbd6'};
  const by=new Map();for(const o of S){const t=LAB.street?LAB.street.typeOf(o):'';const c2=t==='car'||t==='transit'?'#c9c4bb':t==='bike'?'#e2b9a8':COL[o.c]||COL[0];if(!by.has(c2))by.set(c2,[]);by.get(c2).push(o);}
  for(const [c2,os] of by){g.fillStyle=c2;for(let j=0;j<os.length;j+=64){g.beginPath();for(let i=j;i<Math.min(os.length,j+64);i++){const z=os[i].z;for(let k=0;k<z.length;k+=2){const p=loc(z[k],z[k+1]),q=px(p[0],p[1]);k?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]);}g.closePath();}g.fill();}}
  apply(cv);
  function apply(canvas){const tx=new THREE.CanvasTexture(canvas);tx.colorSpace=THREE.SRGBColorSpace;tx.anisotropy=8;
    const m=new THREE.MeshStandardMaterial({map:tx,roughness:1});const gm=root&&root.children.find(o=>o.geometry&&o.geometry.type==='CircleGeometry');
    if(gm){gm.geometry.dispose();const pg=new THREE.PlaneGeometry(2*R,2*R);pg.rotateX(-Math.PI/2);gm.geometry=pg;gm.material=m;}dirty=true;}
}

// ── Licht, Himmel, Sonnenbahn ──
function skyCol(alt){const d=alt*180/Math.PI;return d<-4?new THREE.Color(0x1d1b2b):d<6?new THREE.Color(0xe9c7a8):d<18?new THREE.Color(0xdfe2e4):new THREE.Color(0xd6e4ef);}
function updateSun(){
  const sun=A.sunNow(),key=sun.alt.toFixed(4)+'|'+sun.az.toFixed(4);if(key===lastSun)return;lastSun=key;
  const d=sunDir(sun),up=sun.alt>0,D=900;
  sunL.position.set(d[0]*D,Math.max(.02,d[1])*D,d[2]*D);sunL.intensity=up?3.4*Math.min(1,.3+sun.alt*2.2):0;
  const warm=Math.max(0,1-sun.alt/(25*A.SR));sunL.color.setRGB(1,.94-.18*warm,.86-.36*warm);
  hemi.intensity=up?.5:.2;const sc=skyCol(sun.alt);scene.background=sc;scene.fog.color=sc;
  sunBall.position.set(d[0]*V.R*.95,d[1]*V.R*.95,d[2]*V.R*.95);sunBall.visible=up;
  // Sonnenbahn des Tages
  const pts=[],day=A.dayDate();day.setHours(0,0,0,0);const c=A.PIN||A.map.getCenter();
  for(let m=0;m<=1440;m+=10){const s=A.sunPos(new Date(day.valueOf()+m*6e4),c.lat,c.lng);if(s.alt<0)continue;const q=sunDir(s);pts.push(new THREE.Vector3(q[0]*V.R*.95,q[1]*V.R*.95,q[2]*V.R*.95));}
  if(pathLine){scene.remove(pathLine);pathLine.geometry.dispose();}
  if(pts.length>1){pathLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color:0xd59a3a,dashSize:8,gapSize:6,transparent:true,opacity:.8}));pathLine.computeLineDistances();scene.add(pathLine);}
  dirty=true;
}

// ── Kamera: Umlauf (ziehen = drehen, Rad/Pinch = Zoom, rechts/Shift = schieben) und Augenhöhe ──
function placeCam(){
  if(V.eye){cam.position.set(CAM.tx,1.7,CAM.tz);cam.lookAt(CAM.tx+Math.sin(CAM.yaw)*10,1.7+Math.tan(CAM.pitch)*10,CAM.tz-Math.cos(CAM.yaw)*10);cam.fov=62;}
  else{const s=Math.sin(CAM.ph);cam.position.set(CAM.tx+CAM.r*s*Math.sin(CAM.th),CAM.r*Math.cos(CAM.ph),CAM.tz+CAM.r*s*Math.cos(CAM.th));cam.lookAt(CAM.tx,0,CAM.tz);cam.fov=38;}
  cam.updateProjectionMatrix();dirty=true;
}
function controls(cv){
  const pts=new Map();let last=null,pinch=null;
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);pts.set(e.pointerId,[e.clientX,e.clientY]);last={x:e.clientX,y:e.clientY,b:e.button,sh:e.shiftKey};if(pts.size===2){const [a,b]=[...pts.values()];pinch=Math.hypot(a[0]-b[0],a[1]-b[1]);}});
  cv.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,[e.clientX,e.clientY]);
    if(pts.size===2){const [a,b]=[...pts.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch){zoom(pinch/d);}pinch=d;return;}
    if(!last)return;const dx=e.clientX-last.x,dy=e.clientY-last.y;last.x=e.clientX;last.y=e.clientY;
    if(V.eye){CAM.yaw+=dx*.005;CAM.pitch=Math.max(-.6,Math.min(.9,CAM.pitch+dy*.004));}
    else if(last.b===2||last.sh){const k=CAM.r/900,c=Math.cos(CAM.th),s=Math.sin(CAM.th);CAM.tx-=(dx*c-dy*s)*k;CAM.tz-=(-dx*s-dy*c)*k*-1;}
    else{CAM.th-=dx*.006;CAM.ph=Math.max(.12,Math.min(1.45,CAM.ph-dy*.005));}
    placeCam();});
  const up=e=>{pts.delete(e.pointerId);if(pts.size<2)pinch=null;if(!pts.size)last=null;};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(e.deltaY*.0012));},{passive:false});
  function zoom(f){if(V.eye)return;CAM.r=Math.max(60,Math.min(1600,CAM.r*f));placeCam();}
}

// ── Stadt wächst: Gebäude nach Baujahr einblenden ──
function growTick(now){
  const G=V.grow;if(!G)return;const t=Math.min(1,(now-G.t0)/G.dur),yr=Math.round(G.y0+(G.y1-G.y0)*(t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2));
  let n=0;for(const m of buckets){const show=m.userData.y!=null&&m.userData.y<=yr;m.visible=show||t>=1;if(show)n+=m.userData.n;}
  const lbl=el.querySelector('.v3-year');if(lbl)lbl.innerHTML=`<b>${yr}</b><span>${A.fmt(n)} ${T('Gebäude stehen','buildings standing','gebouwen staan')}</span>`;
  dirty=true;if(t>=1){V.grow=null;setTimeout(()=>{const l=el&&el.querySelector('.v3-year');if(l)l.classList.remove('on');},2400);}
}
function startGrow(){
  const ys=buckets.map(m=>m.userData.y).filter(v=>v!=null);if(!ys.length)return;
  V.grow={y0:Math.min(...ys),y1:new Date().getFullYear(),t0:performance.now(),dur:REDUCED()?1:14000};el.querySelector('.v3-year').classList.add('on');
}
const REDUCED=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Ein-/Ausschalten ──
function frame(now){if(!V.on||!ren)return;updateSun();if(V.grow)growTick(now||performance.now());
  const w=el.clientWidth,h=el.clientHeight;if(ren.domElement.width!==Math.round(w*ren.getPixelRatio())||ren.domElement.height!==Math.round(h*ren.getPixelRatio())){ren.setSize(w,h,false);cam.aspect=w/Math.max(1,h);cam.updateProjectionMatrix();dirty=true;}
  if(dirty){ren.render(scene,cam);dirty=false;}}
function loop(now){raf=requestAnimationFrame(loop);frame(now);}
V.open=async function(){
  if(V.on||V.busy)return;V.busy=true;V.err=null;A.rerender();
  try{await three();}catch(e){V.busy=false;V.err=T('3D braucht eine Internetverbindung zur Grafik-Bibliothek (three.js) — gerade nicht erreichbar.','3D needs the graphics library (three.js) — not reachable right now.','3D heeft de grafische bibliotheek (three.js) nodig — nu niet bereikbaar.');A.rerender();return;}
  el=document.createElement('div');el.className='v3d';el.innerHTML=`<div class="v3-bar">
      <button data-v="eye">${T('Augenhöhe','Eye level','Ooghoogte')}</button><button data-v="grow">${T('Stadt wächst','City grows','Stad groeit')}</button>
      <button data-v="ground">${T('Luftbild','Aerial','Luchtfoto')}</button><button data-v="close" class="v3-x">${T('Zur Karte','Back to map','Naar kaart')}</button></div>
    <div class="v3-year"></div><p class="v3-hint">${T('Ziehen dreht · Rad oder zwei Finger zoomen · rechte Taste oder Umschalt schiebt','Drag to orbit · wheel or pinch to zoom · right button or shift to pan','Slepen draait · wiel of twee vingers zoomen · rechterknop of shift schuift')}</p>`;
  A.map.getContainer().appendChild(el);
  try{ren=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});}catch(e){el.remove();el=null;V.busy=false;V.err=T('Dieses Gerät kann kein WebGL — 3D nicht möglich.','This device has no WebGL — 3D not possible.','Dit apparaat heeft geen WebGL — 3D niet mogelijk.');A.rerender();return;}
  ren.setPixelRatio(Math.min(2,devicePixelRatio||1));ren.shadowMap.enabled=true;ren.shadowMap.type=THREE.PCFSoftShadowMap;ren.toneMapping=THREE.ACESFilmicToneMapping;ren.toneMappingExposure=.95;ren.outputColorSpace=THREE.SRGBColorSpace;
  el.prepend(ren.domElement);
  scene=new THREE.Scene();scene.fog=new THREE.Fog(0xd6e4ef,V.R*1.3,V.R*3.4);
  cam=new THREE.PerspectiveCamera(38,1,1,6000);
  hemi=new THREE.HemisphereLight(0xc9dcf2,0xb9ad95,.5);scene.add(hemi);
  sunL=new THREE.DirectionalLight(0xfff1dc,2.4);sunL.castShadow=true;const sc=sunL.shadow.camera;sc.left=sc.bottom=-V.R*1.05;sc.right=sc.top=V.R*1.05;sc.near=10;sc.far=2400;
  sunL.shadow.mapSize.set(4096,4096);sunL.shadow.bias=-.0004;sunL.shadow.normalBias=.4;sunL.shadow.radius=3;scene.add(sunL,sunL.target);
  sunBall=new THREE.Mesh(new THREE.SphereGeometry(7,24,16),new THREE.MeshBasicMaterial({color:0xffd27a,fog:false}));scene.add(sunBall);
  controls(ren.domElement);
  el.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{const v=b.dataset.v;
    if(v==='close')V.close();
    if(v==='eye'){V.eye=!V.eye;b.classList.toggle('on',V.eye);if(V.eye){const s=A.sunNow();CAM.yaw=Math.PI-s.az;CAM.pitch=.08;}placeCam();}
    if(v==='grow')startGrow();
    if(v==='ground'){V.ground=V.ground==='map'?'photo':'map';b.textContent=V.ground==='map'?T('Luftbild','Aerial','Luchtfoto'):T('Karte','Map','Kaart');paintGround();}});
  V.on=true;document.body.classList.add('v3d-on');placeCam();lastSun='';
  try{await build();}catch(e){V.err=T('3D-Daten konnten nicht geladen werden.','3D data could not be loaded.','3D-data kon niet worden geladen.');}
  V.busy=false;A.rerender();dirty=true;frame();if(!raf)raf=requestAnimationFrame(loop);
};
V.close=function(){if(!V.on&&!el)return;V.on=false;V.grow=null;document.body.classList.remove('v3d-on');cancelAnimationFrame(raf);raf=0;
  if(scene)scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{if(m.map)m.map.dispose();m.dispose();});}});
  if(ren){ren.dispose();ren.forceContextLoss&&ren.forceContextLoss();}if(el)el.remove();el=ren=scene=cam=root=trees=pathLine=null;buckets=[];A.rerender();};
V.toggle=()=>V.on?V.close():V.open();
V._t={bldGeo,BUCKET,sunDir,CAM,get buckets(){return buckets},startGrow,frame:t=>{dirty=true;placeCam();frame(t);}};
})();

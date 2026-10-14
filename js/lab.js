// ══════════════════════════════════════════════════════════════
// Straßenlabor — Schatten, Sonnenstunden, Oberflächen-Albedo und
// Hitze-Risiko auf Straßenebene, live aus offenen amtlichen Quellen:
//   Gebäude + gemessene Höhen  3D BAG (TU Delft / 3DGI, CC BY 4.0)
//   Oberflächenmaterial        BGT (Kadaster / PDOK)
//   Bäume                      Bomenkaart der Gemeente Utrecht
//   Sonnenstand                astronomisch berechnet (wie klassische App)
// 2D-Näherung: kein Gelände; Schatten auf Dächern werden nicht gezeigt.
// ══════════════════════════════════════════════════════════════
(function(){
'use strict';
const SR=Math.PI/180,SE=SR*23.4397;
// Sonnenstand. az: von Süden, westwärts positiv (SunCalc-Konvention)
function sunPos(date,lat,lon){
  const d=date.valueOf()/864e5-0.5+2440588-2451545;
  const M=SR*(357.5291+0.98560028*d);
  const L=M+SR*(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*M))+SR*102.9372+Math.PI;
  const dec=Math.asin(Math.sin(SE)*Math.sin(L)),ra=Math.atan2(Math.sin(L)*Math.cos(SE),Math.cos(L));
  const H=SR*(280.16+360.9856235*d)+SR*lon-ra,phi=SR*lat;
  return {alt:Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(H)),
          az:Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(phi)-Math.tan(dec)*Math.cos(phi))};
}
// WGS84 → Rijksdriehoek (Schreutelkamp & Strang van Hees, Genauigkeit < 1 m)
function toRD(lat,lon){
  const p=0.36*(lat-52.15517440),l=0.36*(lon-5.38720621);
  const x=155000+190094.945*l-11832.228*p*l-114.221*p*p*l-32.391*l*l*l-0.705*p-2.340*p*p*p*l-0.608*p*l*l*l-0.008*l*l+0.148*p*p*l*l*l;
  const y=463000+309056.544*p+3638.893*l*l+73.077*p*p-157.984*p*l*l+59.788*p*p*p+0.433*l-6.439*p*p*l*l-0.032*p*l+0.092*l*l*l*l-0.054*p*l*l*l*l;
  return [x,y];
}
// Albedo je Oberflächenmaterial der BGT — Literaturwerte (Oke 1987; US EPA 2008, Reducing Urban Heat Islands)
const ALB={
  'asfalt':0.08,'cementbeton':0.30,'beton':0.30,'betonstraatstenen':0.25,'gebakken klinkers':0.20,'tegels':0.30,
  'sierbestrating':0.24,'grasbetontegels':0.22,'grind':0.25,'schelpen':0.30,'zand':0.30,'puin':0.20,
  'gesloten verharding':0.10,'open verharding':0.24,'half verhard':0.25,'onverhard':0.17,'erf':0.20,
  'groenvoorziening':0.20,'grasland overig':0.23,'grasland agrarisch':0.23,'loofbos':0.15,'gemengd bos':0.15,'naaldbos':0.13,
  'struiken':0.17,'houtwal':0.16,'bouwland':0.20,'moeras':0.14,'rietland':0.15,'heide':0.14,'fruitteelt':0.18,'boomteelt':0.17,
  'water':0.07
};
const MAT={
  'asfalt':['Asphalt','asphalt'],'cementbeton':['Beton','concrete'],'betonstraatstenen':['Betonpflaster','concrete pavers'],'gebakken klinkers':['Klinker (gebrannt)','fired clay brick'],
  'tegels':['Gehwegplatten','paving tiles'],'sierbestrating':['Zierpflaster','decorative paving'],'grasbetontegels':['Rasengitter','grass pavers'],'grind':['Kies','gravel'],'zand':['Sand','sand'],
  'gesloten verharding':['geschlossene Decke','closed pavement'],'open verharding':['Pflaster','open paving'],'half verhard':['teilbefestigt','semi-paved'],'onverhard':['unbefestigt','unpaved'],'erf':['Hof','yard'],
  'groenvoorziening':['Grünanlage','planted green'],'grasland overig':['Rasen','grass'],'loofbos':['Laubgehölz','deciduous wood'],'struiken':['Sträucher','shrubs'],'water':['Wasser','water']
};
const CLASS={sealed:0,unpaved:1,green:2,water:3};
function surf(coll,p){
  const fv=(p.plus_fysiek_voorkomen&&ALB[p.plus_fysiek_voorkomen]!=null)?p.plus_fysiek_voorkomen:(p.fysiek_voorkomen||'');
  if(coll==='waterdeel')return {a:ALB.water,c:CLASS.water,m:'water'};
  if(coll==='begroeidterreindeel')return {a:ALB[fv]!=null?ALB[fv]:0.20,c:CLASS.green,m:fv||'groenvoorziening'};
  const a=ALB[fv]!=null?ALB[fv]:0.15;
  return {a,c:/^(onverhard|half verhard|zand|grind|schelpen)$/.test(fv)?CLASS.unpaved:CLASS.sealed,m:fv};
}

const LAB=window.LAB={on:false,mode:'shadow',dateKey:'today',min:14*60,playing:false};
let map,opt,cv,ctx,dock,info,raf=0,dpr=1;
const TILE_LAT=0.004,TILE_LON=0.006;               // ≈ 445 × 410 m
const MAX_TILES=24,KEEP_TILES=120,MIN_Z=16;         // höchstens ≈ 2 × 2 km laden (ab Zoom 16); Speicher begrenzen
const B={tiles:new Map(),list:[],key:''};          // Gebäude (3D BAG)
const S={tiles:new Map(),list:[],key:''};          // Oberflächen (BGT)
let TREES=null,treeLoad=null;                       // [lat,lon,kronenradius,höhe,x20,y20]
let SUNH=null;                                      // Sonnenstunden-Raster des zuletzt berechneten Ausschnitts
const T=(de,en,nl)=>opt.T(de,en,nl);
const nf=(v,d)=>v.toFixed(d).replace('.',opt.lang()==='en'?'.':',');

// ── Datum & Uhrzeit ──
function dayDate(){
  const now=new Date(),key=LAB.mode==='heat'?'jun':LAB.dateKey;
  const m={today:[now.getMonth(),now.getDate()],jun:[5,21],sep:[8,21],dec:[11,21]}[key];
  return new Date(now.getFullYear(),m[0],m[1]);
}
function atMin(min){const d=dayDate();d.setHours(0,0,0,0);return new Date(d.valueOf()+min*6e4);}
function sunNow(){const c=map.getCenter();return sunPos(atMin(LAB.min),c.lat,c.lng);}
function dayRange(){                                // Auf- und Untergang (Sonnenmitte, mit Refraktion)
  const c=map.getCenter();let a=null,b=null;
  for(let m=120;m<=1440;m+=2){const s=sunPos(atMin(m),c.lat,c.lng);if(s.alt>-0.833*SR){if(a==null)a=m;b=m;}}
  return [a,b];
}
const hhmm=m=>{m=Math.round(m);return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0');};
const bearing=az=>((az/SR)+180+360)%360;            // von Norden im Uhrzeigersinn
const dirName=b=>T(['N','NO','O','SO','S','SW','W','NW'],['N','NE','E','SE','S','SW','W','NW'],['N','NO','O','ZO','Z','ZW','W','NW'])[Math.round(b/45)%8];

// ── Projektion: Weltpixel bei Zoom 20 einmal vorrechnen, pro Bild nur skalieren ──
function w20(lat,lon){const q=map.project([lat,lon],20);return [q.x,q.y];}
function xf(sc){const z=map.getZoom(),k=map.getZoomScale(z,20),o=map.containerPointToLayerPoint([0,0]).add(map.getPixelOrigin());return {k:k*sc,ox:o.x*sc,oy:o.y*sc,sc};}
function mpp(){const c=map.getCenter();return 40075016.686*Math.cos(c.lat*SR)/(256*Math.pow(2,map.getZoom()));}
function signed(z){let a=0;for(let i=0,n=z.length/2;i<n;i++){const j=(i+1)%n;a+=z[2*i]*z[2*j+1]-z[2*j]*z[2*i+1];}return a;}
function pack(ring){const z=new Float64Array(ring.length*2);ring.forEach((p,i)=>{const q=w20(p[1],p[0]);z[2*i]=q[0];z[2*i+1]=q[1];});return z;}
function outerRings(geom){
  if(!geom)return [];
  const polys=geom.type==='Polygon'?[geom.coordinates]:geom.type==='MultiPolygon'?geom.coordinates:[];
  return polys.map(p=>p[0]).filter(r=>r&&r.length>=4);
}

// ── Daten laden (Kacheln, höchstens 4 Abrufe gleichzeitig — die Dienste sind öffentlich und kostenlos) ──
let active=0;const queue=[];
function limited(fn){return new Promise((res,rej)=>{const run=()=>{active++;fn().then(res,rej).finally(()=>{active--;const n=queue.shift();if(n)n();});};if(active<4)run();else queue.push(run);});}
const tooFar=()=>map.getZoom()<MIN_Z||tilesFor(map.getBounds().pad(.2)).length>MAX_TILES;
function tilesFor(bounds){
  const out=[],s=Math.floor(bounds.getSouth()/TILE_LAT),n=Math.floor(bounds.getNorth()/TILE_LAT),w=Math.floor(bounds.getWest()/TILE_LON),e=Math.floor(bounds.getEast()/TILE_LON);
  for(let y=s;y<=n;y++)for(let x=w;x<=e;x++)out.push([y,x]);return out;
}
async function fetchBuildings(y,x){
  const s=y*TILE_LAT,w=x*TILE_LON,n=s+TILE_LAT,e=w+TILE_LON;
  const C=[toRD(s,w),toRD(s,e),toRD(n,w),toRD(n,e)],X=C.map(c=>c[0]),Y=C.map(c=>c[1]);
  const bbox=[Math.floor(Math.min(...X)),Math.floor(Math.min(...Y)),Math.ceil(Math.max(...X)),Math.ceil(Math.max(...Y))].join(',');
  const base='https://data.3dbag.nl/api/BAG3D/wfs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BAG3D:lod12&SRSNAME=EPSG:4326&OUTPUTFORMAT=application/json&PROPERTYNAME=geom,b3_h_70p,b3_h_maaiveld&COUNT=2000';
  const out=[];
  for(let start=0;start<10000;start+=2000){
    const r=await fetch(`${base}&STARTINDEX=${start}&BBOX=${bbox},EPSG:28992`);
    if(!r.ok)throw new Error('3D BAG '+r.status);
    const j=await r.json(),fs=j.features||[];
    for(const f of fs){const p=f.properties||{};
      const h=(p.b3_h_70p!=null&&p.b3_h_maaiveld!=null)?Math.max(0,p.b3_h_70p-p.b3_h_maaiveld):null;
      for(const ring of outerRings(f.geometry)){const z=pack(ring);out.push({z,h,sg:signed(z)>0});}}
    if(fs.length<2000)break;
  }
  return out;
}
async function fetchSurfaces(y,x){
  const s=y*TILE_LAT,w=x*TILE_LON,n=s+TILE_LAT,e=w+TILE_LON,out=[];
  for(const coll of ['wegdeel','onbegroeidterreindeel','begroeidterreindeel','waterdeel']){
    let url=`https://api.pdok.nl/lv/bgt/ogc/v1/collections/${coll}/items?bbox=${w},${s},${e},${n}&limit=1000&f=json`;
    for(let k=0;k<15&&url;k++){
      const r=await fetch(url);if(!r.ok)throw new Error('BGT '+r.status);const j=await r.json();
      for(const f of j.features||[]){const sf=surf(coll,f.properties||{});for(const ring of outerRings(f.geometry))out.push({z:pack(ring),...sf});}
      const nx=(j.links||[]).find(l=>l.rel==='next');url=nx?nx.href:null;
    }
  }
  return out;
}
async function ensure(kind){
  const st=kind==='b'?B:S,fn=kind==='b'?fetchBuildings:fetchSurfaces;
  const want=tilesFor(map.getBounds().pad(kind==='b'?.2:.04));
  if(want.length>MAX_TILES){st.list=[];st.key='';st.failed=0;return st.list;}
  let loading=false;
  const ps=want.map(([y,x])=>{const k=y+'_'+x;let e=st.tiles.get(k);
    if(!e){loading=true;e={v:undefined};e.p=limited(()=>fn(y,x)).then(v=>{e.v=v;},()=>{e.v=null;setTimeout(()=>st.tiles.delete(k),15000);});st.tiles.set(k,e);}
    else{st.tiles.delete(k);st.tiles.set(k,e);if(e.v===undefined)loading=true;}   // zuletzt genutzt nach hinten
    return e.p;});
  if(loading)status(kind==='b'?T('Gebäude und gemessene Höhen werden geladen …','Loading buildings and measured heights …','Gebouwen en gemeten hoogtes laden …'):T('Oberflächen (BGT) werden geladen …','Loading surfaces (BGT) …','Oppervlakken (BGT) laden …'),true);
  await Promise.all(ps);
  const key=want.map(t=>t.join('_')).join('|');
  if(key!==st.key||loading){
    const seen=new Set();st.list=[];st.failed=0;
    for(const [y,x] of want){const e=st.tiles.get(y+'_'+x);const v=e&&e.v;if(!v){st.failed++;continue;}
      for(const o of v){const k=o.z[0].toFixed(1)+','+o.z[1].toFixed(1)+','+o.z.length;if(seen.has(k))continue;seen.add(k);st.list.push(o);}}
    st.key=key;
  }
  if(loading)status('');
  if(st.tiles.size>KEEP_TILES){const keepK=new Set(want.map(t=>t.join('_')));for(const k of st.tiles.keys()){if(st.tiles.size<=KEEP_TILES)break;if(!keepK.has(k)&&st.tiles.get(k).v!==undefined)st.tiles.delete(k);}}
  return st.list;
}
function ensureTrees(){
  if(TREES)return Promise.resolve(TREES);
  if(!treeLoad)treeLoad=fetch(opt.treesUrl).then(r=>r.ok?r.json():null).catch(()=>null).then(j=>{
    const Y=new Date().getFullYear();
    TREES=j?j.t.map(t=>{const age=(t[2]>1800&&t[2]<=Y)?Y-t[2]:25,D=Math.min(12,1+0.35*age),H=Math.min(24,3+0.45*age),q=w20(t[0],t[1]);return [t[0],t[1],D/2,H,q[0],q[1]];}):[];
    return TREES;});
  return treeLoad;
}
function treesIn(pad){
  if(!TREES)return [];const b=map.getBounds().pad(pad),s=b.getSouth(),n=b.getNorth(),w=b.getWest(),e=b.getEast();
  return TREES.filter(t=>t[0]>=s&&t[0]<=n&&t[1]>=w&&t[1]<=e);
}

// ── Schatten: Prisma = verschobener Grundriss ∪ gefegte Kanten, gleich orientiert (nonzero ohne Löcher).
//    Wenige Gebäude je Füllung in deckender Farbe: ein einziger Riesenpfad braucht im Browser Sekunden ──
function castShadows(g,sun,X,trees,colTree,colBld,batch){
  batch=batch||1;let nb=0;
  const m=mpp()/X.sc,dx=Math.sin(sun.az),dy=Math.cos(sun.az),t=Math.tan(sun.alt);
  if(trees&&trees.length){g.fillStyle=colTree;
    for(let j=0;j<trees.length;j+=48){g.beginPath();
      for(let i=j;i<Math.min(trees.length,j+48);i++){const tr=trees[i],L=Math.min(250,tr[3]*0.65/t)/m,r=tr[2]/m,cx=tr[4]*X.k-X.ox+dx*L,cy=tr[5]*X.k-X.oy-dy*L;g.moveTo(cx+r,cy);g.arc(cx,cy,r,0,2*Math.PI);}
      g.fill();}}
  g.fillStyle=colBld;g.beginPath();
  for(const b of B.list){
    if(!(b.h>=1))continue;
    const L=Math.min(600,b.h/t)/m,ox=dx*L,oy=-dy*L,z=b.z,n=z.length/2;
    const P=new Array(n);for(let i=0;i<n;i++)P[i]=[z[2*i]*X.k-X.ox,z[2*i+1]*X.k-X.oy];
    for(let i=0;i<n-1;i++){const a=P[i],c=P[i+1],cr=(c[0]-a[0])*oy-(c[1]-a[1])*ox;
      if(cr>0){g.moveTo(a[0],a[1]);g.lineTo(c[0],c[1]);g.lineTo(c[0]+ox,c[1]+oy);g.lineTo(a[0]+ox,a[1]+oy);}
      else{g.moveTo(a[0],a[1]);g.lineTo(a[0]+ox,a[1]+oy);g.lineTo(c[0]+ox,c[1]+oy);g.lineTo(c[0],c[1]);}
      g.closePath();}
    if(b.sg){g.moveTo(P[0][0]+ox,P[0][1]+oy);for(let i=1;i<n;i++)g.lineTo(P[i][0]+ox,P[i][1]+oy);}
    else{g.moveTo(P[n-1][0]+ox,P[n-1][1]+oy);for(let i=n-2;i>=0;i--)g.lineTo(P[i][0]+ox,P[i][1]+oy);}
    g.closePath();
    if(++nb%batch===0){g.fill('nonzero');g.beginPath();}
  }
  if(nb%batch)g.fill('nonzero');
}
function poly(g,z,X){g.moveTo(z[0]*X.k-X.ox,z[1]*X.k-X.oy);for(let i=2;i<z.length;i+=2)g.lineTo(z[i]*X.k-X.ox,z[i+1]*X.k-X.oy);g.closePath();}
function chunked(g,items,size,add,fill,stroke,lw){g.fillStyle=fill;if(stroke){g.strokeStyle=stroke;g.lineWidth=lw;}
  for(let j=0;j<items.length;j+=size){g.beginPath();for(let i=j;i<Math.min(items.length,j+size);i++)add(items[i]);g.fill();if(stroke)g.stroke();}}
function drawBuildings(g,X,fill,stroke){chunked(g,B.list,16,b=>poly(g,b.z,X),fill,stroke,.7*X.sc);}
function drawCrowns(g,X,fill,stroke){const m=mpp()/X.sc;chunked(g,treesIn(.05),48,t=>{const x=t[4]*X.k-X.ox,y=t[5]*X.k-X.oy,r=Math.max(1.5*X.sc,t[2]/m);g.moveTo(x+r,y);g.arc(x,y,r,0,2*Math.PI);},fill,stroke,.7*X.sc);}
function drawSurfaces(g,X){const by=new Map();for(const o of S.list){const c=albCol(o.a,o.c);if(!by.has(c))by.set(c,[]);by.get(c).push(o);}
  for(const [c,list] of by)chunked(g,list,16,o=>poly(g,o.z,X),c);}
let off=null;const OFF={};                          // getrennte Hilfsflächen: Anzeige (GPU) und Auslesen (CPU)
function offscreen(w,h,read){const k=read?'r':'d';let c=OFF[k];if(!c){c=OFF[k]=document.createElement('canvas');c._g=c.getContext('2d',read?{willReadFrequently:true}:undefined);}
  if(c.width!==w||c.height!==h){c.width=w;c.height=h;}off=c;const g=c._g;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,w,h);return g;}
function size(){const s=map.getSize();dpr=Math.min(2,window.devicePixelRatio||1);if(cv.width!==Math.round(s.x*dpr)||cv.height!==Math.round(s.y*dpr)){cv.width=Math.round(s.x*dpr);cv.height=Math.round(s.y*dpr);cv.style.width=s.x+'px';cv.style.height=s.y+'px';}return s;}
const isDark=()=>opt.dark();

function draw(){
  raf=0;if(!LAB.on||!ctx)return;size();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);
  if(tooFar())return;
  const dark=isDark(),X=xf(dpr);
  if(LAB.mode==='shadow'){
    const sun=sunNow();
    if(sun.alt>0.004){
      const low=sun.alt<15*SR;                                  // tiefe Sonne: wärmeres Licht
      ctx.fillStyle=low?(dark?'rgba(255,150,70,.16)':'rgba(255,150,60,.13)'):(dark?'rgba(255,206,120,.11)':'rgba(255,214,120,.10)');ctx.fillRect(0,0,cv.width,cv.height);
      const sz=map.getSize(),g=offscreen(sz.x,sz.y);           // Schatten in CSS-Auflösung (weich), Gebäude scharf in voller Auflösung
      castShadows(g,sun,xf(1),treesIn(.3),dark?'rgb(30,30,44)':'rgb(150,154,180)',dark?'rgb(0,0,8)':'rgb(24,22,44)',4);   // Baumschatten heller = lichtdurchlässig
      ctx.globalAlpha=dark?.78:.44;ctx.imageSmoothingEnabled=true;ctx.drawImage(off,0,0,cv.width,cv.height);ctx.globalAlpha=1;
    }else{ctx.fillStyle=dark?'rgba(6,6,16,.5)':'rgba(24,22,44,.34)';ctx.fillRect(0,0,cv.width,cv.height);}
    drawBuildings(ctx,X,dark?'#3b3644':'#fbf9f4',dark?'rgba(255,255,255,.15)':'rgba(23,21,28,.3)');
    drawCrowns(ctx,X,dark?'rgba(110,170,110,.38)':'rgba(72,140,84,.36)',dark?'rgba(150,210,150,.35)':'rgba(31,90,43,.45)');
  }else if(LAB.mode==='sunhours'||LAB.mode==='heat'){
    const img=SUNH&&(LAB.mode==='heat'?SUNH.heatImg:SUNH.img);
    if(img&&SUNH.date===dateTag()){ctx.imageSmoothingEnabled=true;ctx.drawImage(img,SUNH.wx*X.k-X.ox,SUNH.wy*X.k-X.oy,SUNH.ww*X.k,SUNH.wh*X.k);}
    drawBuildings(ctx,X,dark?'rgba(42,38,49,.94)':'rgba(251,249,244,.95)',dark?'rgba(255,255,255,.16)':'rgba(23,21,28,.28)');
    drawCrowns(ctx,X,'rgba(0,0,0,0)',dark?'rgba(150,210,150,.4)':'rgba(31,90,43,.38)');
  }else if(LAB.mode==='albedo'){
    drawSurfaces(ctx,X);
    drawBuildings(ctx,X,dark?'rgba(60,56,66,.9)':'rgba(206,201,192,.9)',dark?'rgba(255,255,255,.14)':'rgba(23,21,28,.22)');
    drawCrowns(ctx,X,'rgba(72,140,84,.18)',dark?'rgba(150,210,150,.35)':'rgba(31,90,43,.35)');
  }
}
const ALB_RAMP=[[0.05,[34,30,40]],[0.12,[88,76,84]],[0.20,[172,158,146]],[0.28,[224,212,194]],[0.35,[250,246,236]]];
function ramp(R,f){f=Math.max(R[0][0],Math.min(R[R.length-1][0],f));for(let i=1;i<R.length;i++){const [a,c1]=R[i-1],[b,c2]=R[i];if(f<=b){const t=(f-a)/(b-a||1);return c1.map((v,k)=>Math.round(v+(c2[k]-v)*t));}}return R[R.length-1][1];}
function albCol(a,c){if(c===CLASS.water)return 'rgb(92,136,178)';const v=ramp(ALB_RAMP,a);if(c===CLASS.green)return `rgb(${Math.round(v[0]*.62)},${Math.min(255,Math.round(v[1]*.86+34))},${Math.round(v[2]*.6)})`;return `rgb(${v.join(',')})`;}
function req(){if(!raf)raf=requestAnimationFrame(draw);}

// ── Sonnenstunden (15-Minuten-Takt) und Hitze-Risiko ──
const dateTag=()=>dayDate().toDateString();
const viewKey=()=>{const b=map.getBounds();return [b.getSouth(),b.getWest(),b.getNorth(),b.getEast(),map.getZoom()].map(v=>v.toFixed(5)).join(',')+'|'+dateTag();};
let sunJob=0;
// Zwischendurch an den Browser abgeben; MessageChannel wird in Hintergrund-Tabs nicht gedrosselt (setTimeout schon)
const yieldNow=()=>new Promise(r=>{if(typeof MessageChannel==='undefined')return setTimeout(r,0);const c=new MessageChannel();c.port1.onmessage=()=>{c.port1.close();r();};c.port2.postMessage(0);});
async function computeSunHours(){
  const key=viewKey();if(SUNH&&SUNH.key===key)return SUNH;
  if(!LAB.on||tooFar())return null;
  const job=++sunJob;
  await Promise.all([ensure('b'),ensureTrees()]);if(job!==sunJob||key!==viewKey())return null;
  const s=map.getSize(),SC=Math.min(.5,720/Math.max(s.x,s.y)),w=Math.max(1,Math.round(s.x*SC)),h=Math.max(1,Math.round(s.y*SC)),X=xf(SC);
  const acc=new Float32Array(w*h),[a,b]=dayRange(),step=15;
  if(a==null){SUNH={key,date:dateTag(),hrs:acc,maxH:0,w,h,X,wx:X.ox/X.k,wy:X.oy/X.k,ww:w/X.k,wh:h/X.k};return SUNH;}
  const trees=treesIn(.4),c=map.getCenter(),steps=[];for(let m=a;m<b;m+=step)steps.push([m+Math.min(step,b-m)/2,Math.min(step,b-m)]);
  for(let k=0;k<steps.length;k++){
    const [mid,len]=steps[k],sp=sunPos(atMin(mid),c.lat,c.lng),sun={az:sp.az,alt:Math.max(sp.alt,0.01)};   // sichtbar ab −0,833° (Refraktion); flache Sonne: Schatten bis 600 m
    const g=offscreen(w,h,true);castShadows(g,sun,X,trees,'#00ff00','#ff0000');const d=g.getImageData(0,0,w,h).data;
    for(let i=0,p=0;i<acc.length;i++,p+=4)acc[i]+=len*(d[p]>127?0:d[p+1]>127?0.3:1);    // Baumkronen lassen rund 30 % durch
    if(k%5===4){status(T('Sonnenstunden werden berechnet … ','Computing sun hours … ','Zonuren berekenen … ')+Math.round(100*k/steps.length)+' %',true);await yieldNow();
      if(job!==sunJob||key!==viewKey()||!LAB.on){return null;}}
  }
  status('');
  const hrs=acc.map(v=>v/60),maxH=(b-a)/60;
  const img=document.createElement('canvas');img.width=w;img.height=h;const ig=img.getContext('2d'),id=ig.createImageData(w,h);
  for(let i=0,p=0;i<hrs.length;i++,p+=4){const col=ramp(SUN_RAMP,hrs[i]/Math.max(1,maxH));id.data[p]=col[0];id.data[p+1]=col[1];id.data[p+2]=col[2];id.data[p+3]=200;}
  ig.putImageData(id,0,0);
  SUNH={key,date:dateTag(),img,hrs,w,h,maxH,X,wx:X.ox/X.k,wy:X.oy/X.k,ww:w/X.k,wh:h/X.k};
  return SUNH;
}
const SUN_RAMP=[[0,[44,38,92]],[0.25,[108,70,150]],[0.5,[206,96,74]],[0.75,[236,168,58]],[1,[255,236,150]]];
const HEAT_RAMP=[[0,[214,226,206]],[0.35,[240,214,160]],[0.6,[228,140,84]],[0.8,[192,70,52]],[1,[118,22,36]]];
const RISK_MAX=0.85;
async function computeHeat(){
  const sh=await computeSunHours();if(!sh||!sh.hrs||!sh.maxH)return;
  if(sh.heatImg)return;
  await ensure('s');if(SUNH!==sh)return;
  const {w,h,X}=sh,g=offscreen(w,h,true);
  g.fillStyle='rgb(0,0,255)';g.fillRect(0,0,w,h);                       // ohne BGT-Fläche: als versiegelt gewertet
  const by=new Map();for(const o of S.list){const c=`rgb(${Math.round(o.a*600)},${o.c*60},0)`;if(!by.has(c))by.set(c,[]);by.get(c).push(o);}
  for(const [c,list] of by)chunked(g,list,16,o=>poly(g,o.z,X),c);
  const d=g.getImageData(0,0,w,h).data,risk=new Float32Array(w*h),F=[1,0.8,0.45,0.15];
  for(let i=0,p=0;i<risk.length;i++,p+=4){const unk=d[p+2]>127,a=unk?0.12:d[p]/600,c=unk?0:Math.min(3,Math.round(d[p+1]/60));
    risk[i]=(sh.hrs[i]/sh.maxH)*(1-a)*F[c];}
  const img=document.createElement('canvas');img.width=w;img.height=h;const ig=img.getContext('2d'),id=ig.createImageData(w,h);
  for(let i=0,p=0;i<risk.length;i++,p+=4){const r=Math.min(1,risk[i]/RISK_MAX),col=ramp(HEAT_RAMP,r);id.data[p]=col[0];id.data[p+1]=col[1];id.data[p+2]=col[2];id.data[p+3]=r<0.08?70:205;}
  ig.putImageData(id,0,0);sh.heatImg=img;sh.risk=risk;
}

// ── Sonnenbahn-Zifferblatt ──
function dial(){
  const c=map.getCenter(),[a,b]=dayRange(),R=36,S=92,o=S/2,pt=s=>{const r=R*(1-Math.max(0,s.alt)/(Math.PI/2)),be=s.az+Math.PI;return [o+r*Math.sin(be),o-r*Math.cos(be)];};
  let path='';if(a!=null)for(let m=a;m<=b;m+=8){const s=sunPos(atMin(m),c.lat,c.lng);if(s.alt<0)continue;const [x,y]=pt(s);path+=(path?'L':'M')+x.toFixed(1)+' '+y.toFixed(1);}
  const s=sunNow();let cur='';
  if(s.alt>0){const [x,y]=pt(s),sl=Math.min(R,R*.32/Math.tan(Math.max(s.alt,.05))),be=s.az+Math.PI;
    cur=`<line x1="${o}" y1="${o}" x2="${(o-sl*Math.sin(be)).toFixed(1)}" y2="${(o+sl*Math.cos(be)).toFixed(1)}" stroke="var(--ink)" stroke-width="3" stroke-linecap="round" opacity=".55"/><circle cx="${o}" cy="${o}" r="2.5" fill="var(--ink)"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.5" fill="#FFD600" stroke="var(--ink)" stroke-width="1.5"/>`;}
  return `<svg class="lab-dial" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" aria-hidden="true"><circle cx="${o}" cy="${o}" r="${R}" fill="var(--soft)" stroke="var(--line2)"/><circle cx="${o}" cy="${o}" r="${R*2/3}" fill="none" stroke="var(--line2)" stroke-dasharray="2 3"/><circle cx="${o}" cy="${o}" r="${R/3}" fill="none" stroke="var(--line2)" stroke-dasharray="2 3"/><text x="${o}" y="8" text-anchor="middle">N</text><text x="${S-2}" y="${o+3}" text-anchor="end">${T('O','E','O')}</text><text x="${o}" y="${S-1}" text-anchor="middle">${T('S','S','Z')}</text><text x="2" y="${o+3}">W</text>${path?`<path d="${path}" fill="none" stroke="#e0913a" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 3.5"/>`:''}${cur}</svg>`;
}
function sunText(){
  const [a,b]=dayRange(),s=sunNow(),be=bearing(s.az);
  const now=s.alt>0?`<b>${T('Sonne','Sun','Zon')} ${Math.round(s.alt/SR)}° ${T('hoch','high','hoog')}</b> · ${T('aus','from','uit')} ${dirName(be)} (${Math.round(be)}°)`:`<b>${T('Sonne unter dem Horizont','Sun below the horizon','Zon onder de horizon')}</b>`;
  const shadow=s.alt>0.02?`<br>${T('10 m hohes Haus wirft','A 10 m building casts','Een gebouw van 10 m werpt')} <b>${nf(Math.min(999,10/Math.tan(s.alt)),1)} m</b> ${T('Schatten','of shade','schaduw')}`:'';
  return `${now}${shadow}<br><span class="lab-mute">${T('Aufgang','Sunrise','Opkomst')} ${a!=null?hhmm(a):'—'} · ${T('Untergang','Sunset','Ondergang')} ${b!=null?hhmm(b):'—'} · ${T('Tageslicht','Daylight','Daglicht')} ${a!=null?nf((b-a)/60,1)+' h':'—'}</span>`;
}

// ── Bedienfeld ──
const IC={
  shadow:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="8" width="7" height="12" rx="1"/><path d="M11 20h9l-5-6h-4" fill="currentColor" fill-opacity=".35"/></svg>',
  sunhours:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  albedo:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5" opacity=".6"/></svg>',
  heat:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z"/><path d="M12 10v6"/></svg>',
  play:'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
  pause:'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
  close:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>'
};
function status(t,busy){const el=dock&&dock.querySelector('.lab-status');if(!el)return;el.innerHTML=t?(busy?'<span class="lab-spin" aria-hidden="true"></span>':'')+`<span>${t}</span>`:'';el.classList.toggle('on',!!t);}
const grad=(R,lo,hi)=>`linear-gradient(90deg,${R.map(r=>`rgb(${r[1].join(',')}) ${((r[0]-lo)/(hi-lo)*100).toFixed(0)}%`).join(',')})`;
function legend(){
  const dk=isDark();
  if(LAB.mode==='shadow')return `<div class="lab-leg"><span><i style="background:${dk?'rgb(12,11,18)':'rgb(146,140,148)'}"></i>${T('Gebäudeschatten','Building shade','Gebouwschaduw')}</span><span><i style="background:${dk?'rgb(44,40,52)':'rgb(204,200,206)'}"></i>${T('Baumschatten','Tree shade','Boomschaduw')}</span><span><i style="background:rgba(72,140,84,.5);border-radius:50%"></i>${T('Baumkrone','Tree crown','Boomkroon')}</span></div>`;
  if(LAB.mode==='sunhours'){const mh=SUNH&&SUNH.maxH&&SUNH.date===dateTag()?SUNH.maxH:null;return `<div class="lab-ramp" style="background:${grad(SUN_RAMP,0,1)}"></div><div class="lab-rl"><span>0 h</span><span>${T('direkte Sonne am Boden','direct sun at ground level','directe zon op maaiveld')}</span><span>${mh?nf(mh,1)+' h':''}</span></div>`;}
  if(LAB.mode==='albedo')return `<div class="lab-ramp" style="background:${grad(ALB_RAMP,0.05,0.35)}"></div><div class="lab-rl"><span>${T('dunkel · speichert Hitze','dark · stores heat','donker · houdt warmte vast')}</span><span>${T('hell · reflektiert','light · reflects','licht · weerkaatst')}</span></div><div class="lab-leg"><span><i style="background:${albCol(0.22,CLASS.green)}"></i>${T('Grün (kühlt durch Verdunstung)','green (cools by evaporation)','groen (koelt door verdamping)')}</span><span><i style="background:${albCol(0.07,CLASS.water)}"></i>${T('Wasser','water','water')}</span></div>`;
  return `<div class="lab-ramp" style="background:${grad(HEAT_RAMP,0,1)}"></div><div class="lab-rl"><span>${T('gering','low','laag')}</span><span>${T('Hitze-Index der Oberfläche · 21. Juni','surface heat index · 21 June','hitte-index oppervlak · 21 juni')}</span><span>${T('hoch','high','hoog')}</span></div>`;
}
const NOTE={
  shadow:()=>T('Schatten aus gemessenen Gebäudehöhen (3D BAG, 70-%-Dachhöhe) und Baumkronen aus dem Baumregister (Größe aus dem Pflanzjahr geschätzt). Zweidimensional: Gelände und Schatten auf Dächern sind nicht dargestellt.','Shadows from measured building heights (3D BAG, 70 % roof height) and tree crowns from the tree register (size estimated from planting year). Two-dimensional: terrain and shade on roofs are not shown.','Schaduw uit gemeten gebouwhoogtes (3D BAG, 70%-dakhoogte) en boomkronen uit het bomenregister (grootte geschat uit plantjaar). Tweedimensionaal: terrein en schaduw op daken niet getoond.'),
  sunhours:()=>T('Für jeden Punkt am Boden: Stunden direkter Sonne von Aufgang bis Untergang, alle 15 Minuten berechnet. Baumkronen lassen rund 30 % Licht durch. Gebäude außerhalb des geladenen Ausschnitts fehlen am Rand.','For every point on the ground: hours of direct sun from sunrise to sunset, computed every 15 minutes. Tree crowns let about 30 % of light through. Buildings outside the loaded area are missing at the edges.','Voor elk punt op de grond: uren directe zon van op- tot ondergang, elke 15 minuten berekend. Boomkronen laten ~30 % licht door. Gebouwen buiten het geladen gebied ontbreken aan de rand.'),
  albedo:()=>T('Rückstrahlung (Albedo) je Material laut BGT — Asphalt, Klinker, Pflaster, Grün, Wasser — nach Literaturwerten (Oke; US EPA). Dächer: Material ist nicht erfasst.','Reflectivity (albedo) per material from the BGT — asphalt, brick, paving, green, water — using literature values (Oke; US EPA). Roofs: material is not recorded.','Weerkaatsing (albedo) per materiaal uit de BGT — asfalt, klinkers, tegels, groen, water — volgens literatuurwaarden (Oke; US EPA). Daken: materiaal niet vastgelegd.'),
  heat:()=>T('Näherung, kein Mikroklimamodell: Sonnenstunden am 21. Juni × aufgenommene Strahlung (1 − Albedo) × Oberflächenart (Grün und Wasser kühlen durch Verdunstung). Zeigt, wo Schatten und hellere Beläge am meisten bringen — keine Lufttemperatur.','Approximation, not a microclimate model: sun hours on 21 June × absorbed radiation (1 − albedo) × surface type (green and water cool by evaporation). Shows where shade and lighter paving help most — not air temperature.','Benadering, geen microklimaatmodel: zonuren op 21 juni × geabsorbeerde straling (1 − albedo) × oppervlaktetype (groen en water koelen door verdamping). Toont waar schaduw en lichtere verharding het meest helpen — geen luchttemperatuur.')
};
function renderDock(){
  const [a,b]=dayRange();
  const modes=[['shadow',T('Schatten','Shadows','Schaduw')],['sunhours',T('Sonnenstunden','Sun hours','Zonuren')],['albedo',T('Oberflächen','Surfaces','Oppervlakken')],['heat',T('Hitze','Heat','Hitte')]];
  const dates=[['today',T('Heute','Today','Vandaag')],['jun',T('21. Juni','21 June','21 juni')],['sep',T('21. Sept.','21 Sept','21 sept')],['dec',T('21. Dez.','21 Dec','21 dec')]];
  const timed=LAB.mode==='shadow',dated=LAB.mode==='shadow'||LAB.mode==='sunhours';
  dock.innerHTML=`<div class="lab-top"><div><b>${T('Straßenlabor','Street lab','Straatlab')}</b><span>${T('Schatten, Sonne und Hitze auf Straßenebene','Shade, sun and heat at street level','Schaduw, zon en hitte op straatniveau')}</span></div><button class="lab-x" aria-label="${T('Straßenlabor schließen','Close street lab','Straatlab sluiten')}">${IC.close}</button></div>
    <div class="lab-seg" role="tablist">${modes.map(([k,l])=>`<button role="tab" data-m="${k}" aria-selected="${LAB.mode===k}" class="${LAB.mode===k?'on':''}">${IC[k]}<span>${l}</span></button>`).join('')}</div>
    ${dated?`<div class="lab-dates" role="group" aria-label="${T('Tag','Day','Dag')}">${dates.map(([k,l])=>`<button data-d="${k}" class="${LAB.dateKey===k?'on':''}" aria-pressed="${LAB.dateKey===k}">${l}</button>`).join('')}</div>`:''}
    ${timed?`<div class="lab-time"><button class="lab-play" aria-label="${LAB.playing?T('Anhalten','Pause','Pauzeren'):T('Tagesverlauf abspielen','Play the day','Dagverloop afspelen')}">${LAB.playing?IC.pause:IC.play}</button>
      <input type="range" class="lab-slider" min="${a!=null?a:300}" max="${b!=null?b:1260}" step="1" value="${clampMin()}" aria-label="${T('Uhrzeit','Time of day','Tijdstip')}">
      <b class="lab-clock">${hhmm(LAB.min)}</b></div>
      <div class="lab-sun"><div class="lab-dialw">${dial()}</div><p class="lab-suntxt">${sunText()}</p></div>`:''}
    <div class="lab-legw">${legend()}</div>
    <div class="lab-status" role="status"></div>
    <details class="lab-how"><summary>${T('Wie wird gerechnet?','How is this computed?','Hoe wordt dit berekend?')}</summary><p>${NOTE[LAB.mode]()}</p><p class="lab-src">${T('Quellen','Sources','Bronnen')}: 3D BAG (TU Delft / 3DGI, CC BY 4.0) · BGT (Kadaster / PDOK) · ${T('Baumregister Gemeente Utrecht','Tree register, Gemeente Utrecht','Bomenregister gemeente Utrecht')} · ${T('Sonnenstand astronomisch berechnet','Sun position computed astronomically','Zonnestand astronomisch berekend')}</p></details>`;
  dock.querySelector('.lab-x').onclick=()=>LAB.close();
  dock.querySelectorAll('[data-m]').forEach(el=>el.onclick=()=>setMode(el.dataset.m));
  dock.querySelectorAll('[data-d]').forEach(el=>el.onclick=()=>{LAB.dateKey=el.dataset.d;LAB.min=clampMin();renderDock();refresh();});
  const sl=dock.querySelector('.lab-slider');if(sl)sl.oninput=()=>{LAB.min=+sl.value;if(LAB.playing){LAB.playing=false;syncPlay();}tick();req();};
  const pl=dock.querySelector('.lab-play');if(pl)pl.onclick=()=>{LAB.playing=!LAB.playing;syncPlay();if(LAB.playing)play();};
}
function clampMin(){const [a,b]=dayRange();if(a==null)return LAB.min;return Math.round(Math.min(Math.max(LAB.min,a),b));}
function syncPlay(){const pl=dock.querySelector('.lab-play');if(pl){pl.innerHTML=LAB.playing?IC.pause:IC.play;pl.setAttribute('aria-label',LAB.playing?T('Anhalten','Pause','Pauzeren'):T('Tagesverlauf abspielen','Play the day','Dagverloop afspelen'));}}
function tick(){
  const sl=dock.querySelector('.lab-slider'),cl=dock.querySelector('.lab-clock'),dw=dock.querySelector('.lab-dialw'),tx=dock.querySelector('.lab-suntxt');
  if(sl&&document.activeElement!==sl)sl.value=LAB.min;if(cl)cl.textContent=hhmm(LAB.min);if(dw)dw.innerHTML=dial();if(tx)tx.innerHTML=sunText();
}
function play(){
  const [a,b]=dayRange();if(a==null){LAB.playing=false;syncPlay();return;}
  if(LAB.min>=b-5)LAB.min=a;
  let last=0;
  (function f(now){if(!LAB.playing||!LAB.on||LAB.mode!=='shadow')return;now=now||performance.now();
    if(last)LAB.min+=Math.min(100,now-last)/1000*75;last=now;              // 75 Minuten pro Sekunde
    if(LAB.min>b){LAB.min=a;}
    tick();draw();requestAnimationFrame(f);})();
}
async function setMode(m){LAB.mode=m;LAB.playing=false;LAB.min=clampMin();renderDock();await refresh();}
let refreshing=0;
async function refresh(){
  if(!LAB.on)return;
  const job=++refreshing;
  if(tooFar()){status(T('Für das Straßenlabor näher heranzoomen.','Zoom in further for the street lab.','Zoom verder in voor het straatlab.'));req();return;}
  try{
    if(LAB.mode==='shadow')await Promise.all([ensure('b'),ensureTrees()]);
    else if(LAB.mode==='sunhours'){req();await computeSunHours();}
    else if(LAB.mode==='albedo')await Promise.all([ensure('s'),ensure('b'),ensureTrees()]);
    else if(LAB.mode==='heat'){req();await computeHeat();}
    if(job!==refreshing)return;
    const lg=dock.querySelector('.lab-legw');if(lg)lg.innerHTML=legend();
    const failed=(B.failed||0)+((LAB.mode==='albedo'||LAB.mode==='heat')?(S.failed||0):0);
    status(failed?T('Ein Teil der Daten konnte nicht geladen werden — Ränder können fehlen.','Some data could not be loaded — edges may be missing.','Een deel van de data kon niet worden geladen — randen kunnen ontbreken.'):'');
  }catch(e){status(T('Daten gerade nicht erreichbar — bitte erneut versuchen.','Data currently unavailable — please try again.','Data momenteel niet bereikbaar — probeer het opnieuw.'));}
  req();
}

// ── Antippen: Werte am Punkt ──
function inPoly(px,py,z){let ins=false;for(let i=0,n=z.length/2,j=n-1;i<n;j=i++){const xi=z[2*i],yi=z[2*i+1],xj=z[2*j],yj=z[2*j+1];if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi))ins=!ins;}return ins;}
function pointInfo(e){
  if(!LAB.on)return;const p=e.containerPoint,[wx,wy]=w20(e.latlng.lat,e.latlng.lng);let html='';
  const bld=B.list.find(b=>inPoly(wx,wy,b.z));
  if(bld)html=bld.h!=null?`${T('Gebäude','Building','Gebouw')} · <b>${nf(bld.h,1)} m</b> ${T('hoch','tall','hoog')}<small>${T('gemessen, 3D BAG','measured, 3D BAG','gemeten, 3D BAG')}</small>`:`${T('Gebäude','Building','Gebouw')}<small>${T('ohne Höhenmessung','no height measurement','zonder hoogtemeting')}</small>`;
  else if((LAB.mode==='sunhours'||LAB.mode==='heat')&&SUNH&&SUNH.hrs&&SUNH.date===dateTag()){
    const ix=Math.floor((wx-SUNH.wx)*SUNH.X.k),iy=Math.floor((wy-SUNH.wy)*SUNH.X.k);
    if(ix>=0&&iy>=0&&ix<SUNH.w&&iy<SUNH.h){const i=iy*SUNH.w+ix;
      html=`<b>${nf(SUNH.hrs[i],1)} h</b> ${T('direkte Sonne','direct sun','directe zon')}<small>${T('von','of','van')} ${nf(SUNH.maxH,1)} h ${T('Tageslicht','daylight','daglicht')}</small>`;
      if(LAB.mode==='heat'&&SUNH.risk)html+=`<br>${T('Hitze-Index','Heat index','Hitte-index')} <b>${Math.round(100*Math.min(1,SUNH.risk[i]/RISK_MAX))}</b> / 100`;}}
  else if(LAB.mode==='albedo'){const o=S.list.slice().reverse().find(s=>inPoly(wx,wy,s.z));
    if(o){const nm=MAT[o.m]?(opt.lang()==='nl'?o.m:MAT[o.m][opt.lang()==='en'?1:0]):(o.m||T('Fläche','surface','vlak'));html=`<b>${nm.charAt(0).toUpperCase()+nm.slice(1)}</b> · Albedo ${nf(o.a,2)}<small>${T('Material laut BGT','material per BGT','materiaal volgens BGT')}</small>`;}}
  if(!html){info.classList.remove('on');return;}
  info.innerHTML=html;const sz=map.getSize();
  info.style.left=Math.max(8,Math.min(p.x+14,sz.x-250))+'px';info.style.top=Math.max(8,p.y-56)+'px';info.classList.add('on');
}

// ── Lebenszyklus ──
let moveT=null;
LAB.init=function(m,o){
  map=m;opt=o;
  cv=document.createElement('canvas');cv.className='lab-canvas';map.getContainer().appendChild(cv);ctx=cv.getContext('2d');
  info=document.createElement('div');info.className='lab-info';info.setAttribute('aria-live','polite');map.getContainer().appendChild(info);
  dock=document.createElement('section');dock.className='lab-dock';dock.setAttribute('aria-label','Straßenlabor');document.body.appendChild(dock);
  map.on('move zoom resize viewreset',()=>{if(LAB.on){req();info.classList.remove('on');}});
  // Zoom-Animation: Ebene mitskalieren wie Leaflets eigene Ebenen
  map.on('zoomanim',e=>{if(!LAB.on)return;const s=map.getZoomScale(e.zoom),sz=map.getSize(),c=map.latLngToContainerPoint(e.center);
    const tx=sz.x/2*(1-s)-s*(c.x-sz.x/2),ty=sz.y/2*(1-s)-s*(c.y-sz.y/2);
    cv.style.transformOrigin='0 0';cv.style.transition='transform .25s cubic-bezier(0,0,.25,1)';cv.style.transform=`translate(${tx}px,${ty}px) scale(${s})`;});
  map.on('zoomend',()=>{cv.style.transition='none';cv.style.transform='';if(LAB.on)draw();});
  map.on('moveend',()=>{if(!LAB.on)return;clearTimeout(moveT);moveT=setTimeout(refresh,LAB.mode==='sunhours'||LAB.mode==='heat'?450:120);});
  map.on('click',pointInfo);
};
LAB.open=function(latlng){
  if(!map)return;LAB.on=true;document.body.classList.add('lab-on');
  const now=new Date();LAB.min=now.getHours()*60+now.getMinutes();LAB.min=clampMin();
  if(latlng||map.getZoom()<16.5){const z=Math.max(map.getZoom(),17),c=latlng||map.getCenter();if(map.getSize().x)map.flyTo(c,z,{duration:.9});else map.setView(c,z);}
  renderDock();opt.onOpen&&opt.onOpen();refresh();
};
LAB.close=function(){if(!LAB.on)return;LAB.on=false;LAB.playing=false;document.body.classList.remove('lab-on');ctx&&ctx.clearRect(0,0,cv.width,cv.height);info&&info.classList.remove('on');opt.onClose&&opt.onClose();};
LAB.relang=function(){if(LAB.on)renderDock();};
LAB.redraw=req;
LAB._t={sunText,legend,NOTE,pointInfo,sunPos,toRD,surf,ALB,dayRange,castShadows,signed,inPoly,atMin,get B(){return B},get S(){return S},get SUNH(){return SUNH},get TREES(){return TREES},computeSunHours,computeHeat,ensure,ensureTrees,refresh,draw};
})();

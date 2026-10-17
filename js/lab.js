// ══════════════════════════════════════════════════════════════
// Straßenlabor — Werkzeugkasten für die Straßenebene, live aus offenen
// amtlichen Quellen. Kern: Daten, Projektion, Zeichenfläche, Bedienfeld,
// Werkzeuge „Sonne" und „Hitze". Weitere Werkzeuge melden sich über
// LAB.addTool({...}) an (lab-street.js, lab-water.js, lab-wind.js, lab-area.js).
//   Gebäude + gemessene Höhen  3D BAG (TU Delft / 3DGI, CC BY 4.0)
//   Oberflächen + Funktion     BGT (Kadaster / PDOK), nur aktuell gültige Objekte
//   Bäume                      Bomenkaart der Gemeente Utrecht
//   Sonnenstand                astronomisch berechnet (wie klassische App)
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
// Rijksdriehoek ↔ WGS84 (Schreutelkamp & Strang van Hees, Genauigkeit < 1 m)
function toRD(lat,lon){
  const p=0.36*(lat-52.15517440),l=0.36*(lon-5.38720621);
  const x=155000+190094.945*l-11832.228*p*l-114.221*p*p*l-32.391*l*l*l-0.705*p-2.340*p*p*p*l-0.608*p*l*l*l-0.008*l*l+0.148*p*p*l*l*l;
  const y=463000+309056.544*p+3638.893*l*l+73.077*p*p-157.984*p*l*l+59.788*p*p*p+0.433*l-6.439*p*p*l*l-0.032*p*l+0.092*l*l*l*l-0.054*p*l*l*l*l;
  return [x,y];
}
function fromRD(x,y){
  const X=(x-155000)*1e-5,Y=(y-463000)*1e-5;
  const n=3235.65389*Y-32.58297*X*X-0.2475*Y*Y-0.84978*X*X*Y-0.0655*Y*Y*Y-0.01709*X*X*Y*Y-0.00738*X+0.0053*X**4-0.00039*X*X*Y**3+0.00033*X**4*Y-0.00012*X*Y;
  const e=5260.52916*X+105.94684*X*Y+2.45656*X*Y*Y-0.81885*X**3+0.05594*X*Y**3-0.05607*X**3*Y+0.01199*Y-0.00256*X**3*Y*Y+0.00128*X*Y**4+0.00022*Y*Y-0.00022*X*X+0.00026*X**5;
  return [52.15517440+n/3600,5.38720621+e/3600];
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
const GREENISH=/^(groenvoorziening|grasland|loofbos|gemengd bos|naaldbos|struiken|houtwal|heide|moeras|rietland)/;
function surf(coll,p){
  const fy=p.fysiek_voorkomen||'',fv=(p.plus_fysiek_voorkomen&&ALB[p.plus_fysiek_voorkomen]!=null)?p.plus_fysiek_voorkomen:fy,f=p.functie||'';
  const base={k:coll,f,fy};
  if(coll==='waterdeel')return {...base,a:ALB.water,c:CLASS.water,m:'water'};
  if(coll==='begroeidterreindeel'||GREENISH.test(fv))return {...base,a:ALB[fv]!=null?ALB[fv]:0.20,c:CLASS.green,m:fv||'groenvoorziening'};
  const a=ALB[fv]!=null?ALB[fv]:0.15;
  return {...base,a,c:/^(onverhard|half verhard|zand|grind|schelpen)$/.test(fv)?CLASS.unpaved:CLASS.sealed,m:fv};
}

const LAB=window.LAB={on:false,tool:'sun',mode:'shadow',dateKey:'today',min:14*60,playing:false,base:'map'};
let map,opt,cv,ctx,dock,info,raf=0,dpr=1,PIN=null;
const TILE_LAT=0.004,TILE_LON=0.006;               // ≈ 445 × 410 m
const MAX_TILES=24,MAX_AREA_TILES=30,KEEP_TILES=120,MIN_Z=16;         // höchstens ≈ 2 × 2 km laden (ab Zoom 16); Speicher begrenzen
const B={tiles:new Map(),list:[],key:''};          // Gebäude (3D BAG)
const S={tiles:new Map(),list:[],key:''};          // Oberflächen (BGT)
let TREES=null,GENERA=[],treeLoad=null;             // [lat,lon,kronenradius,höhe,x20,y20,gattung,pflanzjahr,gemessen]
let SUNH=null;                                      // Sonnenstunden-Raster des zuletzt berechneten Ausschnitts
const T=(de,en,nl)=>opt.T(de,en,nl);
const nf=(v,d)=>(+v).toFixed(d).replace('.',opt.lang()==='en'?'.':',');
const fmt=v=>Math.round(v).toLocaleString(opt.lang()==='en'?'en-GB':'de-DE');

// ── Datum & Uhrzeit ──
function dayDate(){
  const now=new Date(),key=(LAB.mode==='heat'||LAB.mode==='gaps')&&LAB.tool==='surface'?'jun':LAB.dateKey;
  if(key==='doy')return new Date(now.getFullYear(),0,Math.max(1,Math.min(366,LAB.doy||1)));   // frei gewählter Tag (3D-Datumsregler)
  const m={today:[now.getMonth(),now.getDate()],jun:[5,21],sep:[8,21],dec:[11,21]}[key];
  return new Date(now.getFullYear(),m[0],m[1]);
}
function atMin(min){const d=dayDate();d.setHours(0,0,0,0);return new Date(d.valueOf()+min*6e4);}
function sunAt(ll){const c=ll||map.getCenter();return sunPos(atMin(LAB.min),c.lat,c.lng);}
const sunNow=()=>sunAt(PIN);
function dayRange(ll){                              // Auf- und Untergang (Sonnenmitte, mit Refraktion)
  const c=ll||PIN||map.getCenter();let a=null,b=null;
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
const m20=()=>40075016.686*Math.cos(map.getCenter().lat*SR)/(256*Math.pow(2,20));
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
function tilesFor(bounds){
  const out=[],s=Math.floor(bounds.getSouth()/TILE_LAT),n=Math.floor(bounds.getNorth()/TILE_LAT),w=Math.floor(bounds.getWest()/TILE_LON),e=Math.floor(bounds.getEast()/TILE_LON);
  for(let y=s;y<=n;y++)for(let x=w;x<=e;x++)out.push([y,x]);return out;
}
const tooFar=()=>map.getZoom()<MIN_Z||tilesFor(map.getBounds().pad(.2)).length>MAX_TILES;
async function fetchBuildings(y,x){
  const s=y*TILE_LAT,w=x*TILE_LON,n=s+TILE_LAT,e=w+TILE_LON;
  const C=[toRD(s,w),toRD(s,e),toRD(n,w),toRD(n,e)],X=C.map(c=>c[0]),Y=C.map(c=>c[1]);
  const bbox=[Math.floor(Math.min(...X)),Math.floor(Math.min(...Y)),Math.ceil(Math.max(...X)),Math.ceil(Math.max(...Y))].join(',');
  const base='https://data.3dbag.nl/api/BAG3D/wfs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BAG3D:lod12&SRSNAME=EPSG:4326&OUTPUTFORMAT=application/json&PROPERTYNAME=geom,b3_h_70p,b3_h_maaiveld,oorspronkelijkbouwjaar,b3_dak_type,b3_opp_dak_plat,b3_opp_dak_schuin,b3_opp_grond&COUNT=2000';
  const out=[];
  for(let start=0;start<10000;start+=2000){
    const r=await fetch(`${base}&STARTINDEX=${start}&BBOX=${bbox},EPSG:28992`);
    if(!r.ok)throw new Error('3D BAG '+r.status);
    const j=await r.json(),fs=j.features||[];
    for(const f of fs){const p=f.properties||{};
      const h=(p.b3_h_70p!=null&&p.b3_h_maaiveld!=null)?Math.max(0,p.b3_h_70p-p.b3_h_maaiveld):null;
      const yr=p.oorspronkelijkbouwjaar>1000&&p.oorspronkelijkbouwjaar<2100?p.oorspronkelijkbouwjaar:null,num=v=>v!=null&&isFinite(v)?+v:null;   // Baujahr, Dachform und Dachflächen für Studio-Diagramme
      for(const ring of outerRings(f.geometry)){const z=pack(ring);out.push({z,h,g:p.b3_h_maaiveld!=null?p.b3_h_maaiveld:null,sg:signed(z)>0,yr,dt:p.b3_dak_type||null,fl:num(p.b3_opp_dak_plat),sl:num(p.b3_opp_dak_schuin),gr:num(p.b3_opp_grond)});}}
    if(fs.length<2000)break;
  }
  return out;
}
// Nur aktuell gültige BGT-Objekte: ohne Filter liefert der Dienst auch alle früheren Fassungen (im Zentrum ~80 %)
const BGT='https://api.pdok.nl/lv/bgt/ogc/v1/collections/';
const CURRENT='&filter=eind_registratie%20IS%20NULL&filter-lang=cql2-text';
const live=p=>p&&!p.eind_registratie&&!p.termination_date;
async function bgtItems(coll,w,s,e,n,onFeature){
  let url=`${BGT}${coll}/items?bbox=${w},${s},${e},${n}&limit=1000&f=json${CURRENT}`;
  for(let k=0;k<15&&url;k++){
    const r=await fetch(url);if(!r.ok)throw new Error('BGT '+r.status);const j=await r.json();
    for(const f of j.features||[])if(live(f.properties))onFeature(f);
    const nx=(j.links||[]).find(l=>l.rel==='next');url=nx?nx.href:null;
  }
}
async function fetchSurfaces(y,x){
  const s=y*TILE_LAT,w=x*TILE_LON,n=s+TILE_LAT,e=w+TILE_LON,out=[];
  for(const coll of ['wegdeel','ondersteunendwegdeel','onbegroeidterreindeel','begroeidterreindeel','waterdeel'])
    await bgtItems(coll,w,s,e,n,f=>{const sf=surf(coll,f.properties||{});for(const ring of outerRings(f.geometry))out.push({z:pack(ring),...sf});});
  return out;
}
// Mit `bounds` (Gebiet statt Ansicht): eigene Liste zurückgeben, die Ansichtsliste bleibt unberührt — so behält z. B. das Studio sein Gebiet auch beim Herauszoomen.
async function ensure(kind,bounds){
  const st=kind==='b'?B:S,fn=kind==='b'?fetchBuildings:fetchSurfaces;
  const want=tilesFor(bounds||map.getBounds().pad(kind==='b'?.2:.04));
  if(want.length>(bounds?MAX_AREA_TILES:MAX_TILES)){if(bounds)return [];st.list=[];st.key='';st.failed=0;return st.list;}
  let loading=false;
  const ps=want.map(([y,x])=>{const k=y+'_'+x;let e=st.tiles.get(k);
    if(!e){loading=true;e={v:undefined};e.p=limited(()=>fn(y,x)).then(v=>{e.v=v;},()=>{e.v=null;setTimeout(()=>st.tiles.delete(k),15000);});st.tiles.set(k,e);}
    else{st.tiles.delete(k);st.tiles.set(k,e);if(e.v===undefined)loading=true;}   // zuletzt genutzt nach hinten
    return e.p;});
  if(loading)status(kind==='b'?T('Gebäude und gemessene Höhen werden geladen …','Loading buildings and measured heights …','Gebouwen en gemeten hoogtes laden …'):T('Oberflächen (BGT) werden geladen …','Loading surfaces (BGT) …','Oppervlakken (BGT) laden …'),true);
  await Promise.all(ps);
  if(bounds){if(loading)status('');const seen=new Set(),out=[];for(const [y,x] of want){const e=st.tiles.get(y+'_'+x),v=e&&e.v;if(!v)continue;
    for(const o of v){const k=o.z[0].toFixed(1)+','+o.z[1].toFixed(1)+','+o.z.length;if(seen.has(k))continue;seen.add(k);out.push(o);}}return out;}
  const key=want.map(t=>t.join('_')).join('|');
  if(key!==st.key||loading){
    const seen=new Set();st.list=[];st.failed=0;
    for(const [y,x] of want){const e=st.tiles.get(y+'_'+x);const v=e&&e.v;if(!v){st.failed++;continue;}
      for(const o of v){const k=o.z[0].toFixed(1)+','+o.z[1].toFixed(1)+','+o.z.length;if(seen.has(k))continue;seen.add(k);st.list.push(o);}}
    st.key=key;st.idx=null;
  }
  if(loading)status('');
  if(st.tiles.size>KEEP_TILES){const keepK=new Set(want.map(t=>t.join('_')));for(const k of st.tiles.keys()){if(st.tiles.size<=KEEP_TILES)break;if(!keepK.has(k)&&st.tiles.get(k).v!==undefined)st.tiles.delete(k);}}
  return st.list;
}
function ensureTrees(){
  if(TREES)return Promise.resolve(TREES);
  if(!treeLoad)treeLoad=fetch(opt.treesUrl).then(r=>r.ok?r.json():null).catch(()=>null).then(j=>{
    const Y=new Date().getFullYear();GENERA=(j&&j.genera)||[];
    TREES=j?j.t.map(t=>{const age=(t[2]>1800&&t[2]<=Y)?Y-t[2]:25,D=Math.min(12,1+0.35*age),H=Math.min(20,3+0.25*age),q=w20(t[0],t[1]);return [t[0],t[1],D/2,H,q[0],q[1],t[3],t[2],0];}):[];   // Höhe nur Rückfall — gemessen wird mit measureTrees()
    return TREES;});
  return treeLoad;
}
// ── Gemessene Baumhöhen: AHN-Oberfläche (DSM) − Gelände (DTM) am Standort jedes Registerbaums ──
let geoLoad=null;
function geotiff(){if(window.GeoTIFF)return Promise.resolve(window.GeoTIFF);
  if(!geoLoad)geoLoad=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.js';s.onload=()=>res(window.GeoTIFF);s.onerror=rej;document.head.appendChild(s);});
  return geoLoad;}
async function ahn(id,x0,y0,x1,y1,W,H){
  const r=await fetch(`https://service.pdok.nl/rws/ahn/wcs/v1_0?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=${id}&FORMAT=image/tiff&SUBSET=x(${x0},${x1})&SUBSET=y(${y0},${y1})&SCALESIZE=x(${W}),y(${H})`);
  if(!r.ok)throw new Error('AHN '+r.status);const G=await geotiff(),t=await G.fromArrayBuffer(await r.arrayBuffer()),im=await t.getImage();
  return {z:(await im.readRasters())[0],w:im.getWidth(),h:im.getHeight()};
}
const TH={done:new Set(),busy:null,n:0};
async function measureTrees(){
  if(!TREES||!TREES.length||tooFar())return;
  if(TH.busy)return TH.busy;
  const want=tilesFor(map.getBounds().pad(.25)).filter(([y,x])=>!TH.done.has(y+'_'+x));if(!want.length)return;
  TH.busy=(async()=>{
    const s=Math.min(...want.map(t=>t[0]))*TILE_LAT,n=(Math.max(...want.map(t=>t[0]))+1)*TILE_LAT,w=Math.min(...want.map(t=>t[1]))*TILE_LON,e=(Math.max(...want.map(t=>t[1]))+1)*TILE_LON;
    const C=[toRD(s,w),toRD(s,e),toRD(n,w),toRD(n,e)],x0=Math.floor(Math.min(...C.map(c=>c[0]))),x1=Math.ceil(Math.max(...C.map(c=>c[0]))),y0=Math.floor(Math.min(...C.map(c=>c[1]))),y1=Math.ceil(Math.max(...C.map(c=>c[1])));
    const res=Math.max(1,Math.max(x1-x0,y1-y0)/1500),W=Math.round((x1-x0)/res),H=Math.round((y1-y0)/res);
    status(T('Baumhöhen werden gemessen (AHN) …','Measuring tree heights (AHN) …','Boomhoogtes worden gemeten (AHN) …'),true);
    try{
      const [dsm,dtm]=await Promise.all([ahn('dsm_05m',x0,y0,x1,y1,W,H),ahn('dtm_05m',x0,y0,x1,y1,W,H)]);
      const ok=v=>v>-50&&v<400,rx=(x1-x0)/dsm.w,ry=(y1-y0)/dsm.h,rt=Math.max(1,Math.round(1.5/rx)),rg=Math.max(2,Math.round(4/rx));   // Rastergröße so, wie geliefert
      for(const t of TREES){if(t[8]||t[0]<s||t[0]>n||t[1]<w||t[1]>e)continue;
        const [x,y]=toRD(t[0],t[1]),i=Math.floor((x-x0)/rx),j=Math.floor((y1-y)/ry);if(i<0||j<0||i>=dsm.w||j>=dsm.h||dtm.w!==dsm.w)continue;
        let top=-Infinity,gr=Infinity;
        for(let dj=-rg;dj<=rg;dj++)for(let di=-rg;di<=rg;di++){const ii=i+di,jj=j+dj;if(ii<0||jj<0||ii>=dsm.w||jj>=dsm.h)continue;const k=jj*dsm.w+ii;
          if(Math.abs(di)<=rt&&Math.abs(dj)<=rt&&ok(dsm.z[k])&&dsm.z[k]>top)top=dsm.z[k];if(ok(dtm.z[k])&&dtm.z[k]<gr)gr=dtm.z[k];}
        const h=top-gr;if(isFinite(h)&&h>=2&&h<=40){t[3]=h;t[2]=Math.min(t[2],Math.max(1.5,.45*h));t[8]=1;TH.n++;}}
      want.forEach(([y,x])=>TH.done.add(y+'_'+x));
    }catch(err){/* Rückfall: geschätzte Höhen bleiben, Hinweis im Rechenweg */}
    status('');TH.busy=null;req();
  })();
  return TH.busy;
}
function treeAt(wx,wy){if(!TREES)return null;const m=m20();let best=null,bd=Infinity;for(const t of treesIn(.02)){const d=Math.hypot(t[4]-wx,t[5]-wy)*m;if(d<Math.max(1.5,t[2])&&d<bd){bd=d;best=t;}}return best;}
function treeInfo(t){return `<b>${GENERA[t[6]]||T('Baum','Tree','Boom')}</b>${t[7]>1800?` · ${T('gepflanzt','planted','geplant')} ${t[7]}`:''}<br>${t[8]?`<b>${nf(t[3],1)} m</b> ${T('hoch (gemessen, AHN)','tall (measured, AHN)','hoog (gemeten, AHN)')}`:`≈ ${nf(t[3],0)} m ${T('hoch (geschätzt)','tall (estimated)','hoog (geschat)')}`}<small>${T('Krone ≈','crown ≈','kroon ≈')} ${nf(2*t[2],0)} m ${T('(geschätzt) · Baumregister Gemeente Utrecht','(estimated) · tree register, Gemeente Utrecht','(geschat) · bomenregister gemeente Utrecht')}</small>`;}
function treesIn(pad,bounds){
  if(!TREES)return [];const b=(bounds||map.getBounds()).pad(pad),s=b.getSouth(),n=b.getNorth(),w=b.getWest(),e=b.getEast();
  return TREES.filter(t=>t[0]>=s&&t[0]<=n&&t[1]>=w&&t[1]<=e);
}
// Raster-Index (20 m) für schnelle Punktabfragen auf Gebäuden und Flächen
function index(st){
  if(st.idx)return st.idx;const C=20/m20(),cells=new Map();
  for(const o of st.list){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;const z=o.z;
    for(let i=0;i<z.length;i+=2){if(z[i]<x0)x0=z[i];if(z[i]>x1)x1=z[i];if(z[i+1]<y0)y0=z[i+1];if(z[i+1]>y1)y1=z[i+1];}
    for(let cx=Math.floor(x0/C);cx<=Math.floor(x1/C);cx++)for(let cy=Math.floor(y0/C);cy<=Math.floor(y1/C);cy++){const k=cx+'_'+cy;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(o);}}
  st.idx={C,cells};return st.idx;
}
function hits(st,wx,wy){const I=index(st),c=I.cells.get(Math.floor(wx/I.C)+'_'+Math.floor(wy/I.C));return c?c.filter(o=>inPoly(wx,wy,o.z)):[];}

// ── Zeichnen ──
// Schatten: Prisma = verschobener Grundriss ∪ gefegte Kanten, gleich orientiert (nonzero ohne Löcher).
// Wenige Gebäude je Füllung in deckender Farbe: ein einziger Riesenpfad braucht im Browser Sekunden.
function castShadows(g,sun,X,trees,colTree,colBld,batch,blds){
  batch=batch||1;let nb=0;
  const m=mpp()/X.sc,dx=Math.sin(sun.az),dy=Math.cos(sun.az),t=Math.tan(sun.alt);
  if(trees&&trees.length){g.fillStyle=colTree;
    for(let j=0;j<trees.length;j+=48){g.beginPath();
      for(let i=j;i<Math.min(trees.length,j+48);i++){const tr=trees[i],L=Math.min(250,tr[3]*0.65/t)/m,r=tr[2]/m,cx=tr[4]*X.k-X.ox+dx*L,cy=tr[5]*X.k-X.oy-dy*L;g.moveTo(cx+r,cy);g.arc(cx,cy,r,0,2*Math.PI);}
      g.fill();}}
  g.fillStyle=colBld;g.beginPath();
  for(const b of (blds||B.list)){
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
function chunked(g,items,size,add,fill,stroke,lw){if(fill)g.fillStyle=fill;if(stroke){g.strokeStyle=stroke;g.lineWidth=lw;}
  for(let j=0;j<items.length;j+=size){g.beginPath();for(let i=j;i<Math.min(items.length,j+size);i++)add(items[i]);if(fill)g.fill();if(stroke)g.stroke();}}
const photo=()=>LAB.base==='photo';
function drawBuildings(g,X,fill,stroke){chunked(g,B.list,16,b=>poly(g,b.z,X),photo()?'rgba(255,255,255,.06)':fill,photo()?'rgba(255,255,255,.55)':stroke,.7*X.sc);}
function drawCrowns(g,X,fill,stroke){const m=mpp()/X.sc;chunked(g,treesIn(.05),48,t=>{const x=t[4]*X.k-X.ox,y=t[5]*X.k-X.oy,r=Math.max(1.5*X.sc,t[2]/m);g.moveTo(x+r,y);g.arc(x,y,r,0,2*Math.PI);},photo()?null:fill,stroke,.7*X.sc);}
function drawSurfaces(g,X){const by=new Map();for(const o of S.list){const c=albCol(o.a,o.c);if(!by.has(c))by.set(c,[]);by.get(c).push(o);}
  for(const [c,list] of by)chunked(g,list,16,o=>poly(g,o.z,X),c);}
const OFF={};let off=null;                          // getrennte Hilfsflächen: Anzeige (GPU) und Auslesen (CPU)
function offscreen(w,h,read){const k=read?'r':'d';let c=OFF[k];if(!c){c=OFF[k]=document.createElement('canvas');c._g=c.getContext('2d',read?{willReadFrequently:true}:undefined);}
  if(c.width!==w||c.height!==h){c.width=w;c.height=h;}off=c;const g=c._g;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,w,h);return g;}
function size(){const s=map.getSize();dpr=Math.min(2,window.devicePixelRatio||1);if(cv.width!==Math.round(s.x*dpr)||cv.height!==Math.round(s.y*dpr)){cv.width=Math.round(s.x*dpr);cv.height=Math.round(s.y*dpr);cv.style.width=s.x+'px';cv.style.height=s.y+'px';}return s;}
const isDark=()=>opt.dark();
const ALB_RAMP=[[0.05,[34,30,40]],[0.12,[88,76,84]],[0.20,[172,158,146]],[0.28,[224,212,194]],[0.35,[250,246,236]]];
function ramp(R,f){f=Math.max(R[0][0],Math.min(R[R.length-1][0],f));for(let i=1;i<R.length;i++){const [a,c1]=R[i-1],[b,c2]=R[i];if(f<=b){const t=(f-a)/(b-a||1);return c1.map((v,k)=>Math.round(v+(c2[k]-v)*t));}}return R[R.length-1][1];}
function albCol(a,c){if(c===CLASS.water)return 'rgb(92,136,178)';const v=ramp(ALB_RAMP,a);if(c===CLASS.green)return `rgb(${Math.round(v[0]*.62)},${Math.min(255,Math.round(v[1]*.86+34))},${Math.round(v[2]*.6)})`;return `rgb(${v.join(',')})`;}

function draw(){
  raf=0;if(!LAB.on||!ctx)return;size();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);
  const t=tool();if(!t||!t.draw)return;
  if(t.gate!==false&&tooFar())return;
  t.draw(ctx,xf(dpr),api);
}
function req(){if(!raf)raf=requestAnimationFrame(draw);}

// ── Sonnenstunden (15-Minuten-Takt) und Hitze-Index ──
const dateTag=()=>dayDate().toDateString();
const viewKey=()=>{const b=map.getBounds();return [b.getSouth(),b.getWest(),b.getNorth(),b.getEast(),map.getZoom()].map(v=>v.toFixed(5)).join(',')+'|'+dateTag();};
let sunJob=0;
// Zwischendurch an den Browser abgeben; MessageChannel wird in Hintergrund-Tabs nicht gedrosselt (setTimeout schon)
const yieldNow=()=>new Promise(r=>{if(typeof MessageChannel==='undefined')return setTimeout(r,0);const c=new MessageChannel();c.port1.onmessage=()=>{c.port1.close();r();};c.port2.postMessage(0);});
async function computeSunHours(){
  const key=viewKey();if(SUNH&&SUNH.key===key)return SUNH;
  if(!LAB.on||tooFar())return null;
  const job=++sunJob;
  await Promise.all([ensure('b'),ensureTrees().then(measureTrees)]);if(job!==sunJob||key!==viewKey())return null;
  const s=map.getSize(),SC=Math.min(.5,720/Math.max(s.x,s.y)),w=Math.max(1,Math.round(s.x*SC)),h=Math.max(1,Math.round(s.y*SC)),X=xf(SC);
  const acc=new Float32Array(w*h),[a,b]=dayRange(map.getCenter()),step=15;
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
// ── Kühl-Lücken: heiß, sonnig, versiegelt, keine Fahrbahn, noch ohne Baumkrone — nur Teilflächen, zweistufig ──
const GAP_FN=/^(parkeervlak|voetpad|voetgangersgebied|woonerf)$/,GAP_TH=[0.6,0.45];   // Hitze-Index (0–1): hoch | mittel — ganztägig besonnte Platten ≈ 0,85; so bleiben rund 15 % der Kandidaten
const gapCand=o=>o.c===CLASS.sealed&&((o.k==='wegdeel'&&GAP_FN.test(o.f))||(o.k==='ondersteunendwegdeel'&&o.f==='verkeerseiland')||(o.k==='onbegroeidterreindeel'&&o.fy!=='erf'));
const GAP_NM={parkeervlak:['Parkplatz','parking','parkeervlak'],voetpad:['Gehweg','footpath','voetpad'],voetgangersgebied:['Fußgängerbereich','pedestrian area','voetgangersgebied'],woonerf:['Wohnstraße (Spielstraße)','home zone','woonerf'],verkeerseiland:['Verkehrsinsel','traffic island','verkeerseiland']};
async function computeGaps(){
  await computeHeat();const sh=SUNH;if(!sh||!sh.risk)return;if(sh.gap)return sh.gap;
  const {w,h,X}=sh,g=offscreen(w,h,true),m=mpp()/X.sc;
  g.fillStyle='#000';g.fillRect(0,0,w,h);
  chunked(g,S.list.filter(gapCand),16,o=>poly(g,o.z,X),'#fff');
  chunked(g,treesIn(.05),48,t=>{const x=t[4]*X.k-X.ox,y=t[5]*X.k-X.oy,r=Math.max(1,t[2]/m);g.moveTo(x+r,y);g.arc(x,y,r,0,2*Math.PI);},'#000');
  chunked(g,B.list,16,b=>poly(g,b.z,X),'#000');
  const d=g.getImageData(0,0,w,h).data,lv=new Uint8Array(w*h);let nc=0,n1=0,n2=0;
  for(let i=0,p=0;i<lv.length;i++,p+=4){if(d[p]<128)continue;nc++;const r=sh.risk[i]/RISK_MAX;if(r>=GAP_TH[0]){lv[i]=2;n2++;}else if(r>=GAP_TH[1]){lv[i]=1;n1++;}}
  const img=document.createElement('canvas');img.width=w;img.height=h;const ig=img.getContext('2d'),id=ig.createImageData(w,h),C=[null,[143,211,182,200],[24,128,92,235]];
  for(let i=0,p=0;i<lv.length;i++,p+=4){const c=C[lv[i]];if(!c)continue;id.data[p]=c[0];id.data[p+1]=c[1];id.data[p+2]=c[2];id.data[p+3]=c[3];}
  ig.putImageData(id,0,0);const a=(mpp()/X.sc)**2;
  sh.gap={img,lv,hi:n2*a,mid:n1*a,cand:nc*a};return sh.gap;
}
function gapAt(wx,wy){const sh=SUNH;if(!sh||!sh.gap)return 0;const ix=Math.floor((wx-sh.wx)*sh.X.k),iy=Math.floor((wy-sh.wy)*sh.X.k);if(ix<0||iy<0||ix>=sh.w||iy>=sh.h)return 0;return sh.gap.lv[iy*sh.w+ix];}
function sunHoursAt(wx,wy){if(!SUNH||!SUNH.hrs||SUNH.date!==dateTag())return null;const ix=Math.floor((wx-SUNH.wx)*SUNH.X.k),iy=Math.floor((wy-SUNH.wy)*SUNH.X.k);
  if(ix<0||iy<0||ix>=SUNH.w||iy>=SUNH.h)return null;const i=iy*SUNH.w+ix;return {h:SUNH.hrs[i],risk:SUNH.risk?SUNH.risk[i]:null};}

// ── Sonnenbahn am Punkt (wie suncalc.org): Auf-/Untergangsrichtung, Sonnenbahn, Sonne jetzt, Schattenrichtung ──
function drawSunCalc(g,X){
  if(!PIN)return;const [px,py]=w20(PIN.lat,PIN.lng),cx=px*X.k-X.ox,cy=py*X.k-X.oy,sc=X.sc,dark=isDark();
  const R=Math.min(150,0.3*Math.min(cv.width,cv.height)/sc)*sc,[a,b]=dayRange(PIN),ink=dark?'rgba(243,239,231,':'rgba(23,21,28,';
  const at=(s,r)=>{const be=s.az+Math.PI;return [cx+r*Math.sin(be),cy-r*Math.cos(be)];};
  g.save();g.lineCap='round';
  g.fillStyle=dark?'rgba(18,16,22,.18)':'rgba(255,253,246,.28)';g.beginPath();g.arc(cx,cy,R,0,2*Math.PI);g.fill();
  g.strokeStyle=ink+'.28)';g.lineWidth=1*sc;g.setLineDash([2*sc,4*sc]);
  for(const f of [1,2/3,1/3]){g.beginPath();g.arc(cx,cy,R*f,0,2*Math.PI);g.stroke();}
  g.setLineDash([]);
  if(a!=null){
    for(let m=a;m<b;m+=6){const s1=sunPos(atMin(m),PIN.lat,PIN.lng),s2=sunPos(atMin(Math.min(b,m+6)),PIN.lat,PIN.lng);
      const p1=at(s1,R*(1-Math.max(0,s1.alt)/(Math.PI/2))),p2=at(s2,R*(1-Math.max(0,s2.alt)/(Math.PI/2))),c=ramp(SUN_RAMP,Math.max(0,s1.alt)/(65*SR));
      g.strokeStyle=`rgb(${c.join(',')})`;g.lineWidth=4*sc;g.beginPath();g.moveTo(p1[0],p1[1]);g.lineTo(p2[0],p2[1]);g.stroke();}
    const ray=(m,col,lbl)=>{const s=sunPos(atMin(m),PIN.lat,PIN.lng),e=at(s,R*1.18);g.strokeStyle=col;g.lineWidth=2.2*sc;g.setLineDash([6*sc,5*sc]);
      g.beginPath();g.moveTo(cx,cy);g.lineTo(e[0],e[1]);g.stroke();g.setLineDash([]);label(g,lbl,e[0],e[1],sc,col);};
    ray(a,'#e9a23b',`${T('Aufgang','Sunrise','Opkomst')} ${hhmm(a)}`);ray(b,'#d0583c',`${T('Untergang','Sunset','Ondergang')} ${hhmm(b)}`);
  }
  const s=sunNow();
  if(s.alt>0){const sp=at(s,R*(1-s.alt/(Math.PI/2))),edge=at(s,R*1.18),sl=Math.min(R,R*.35/Math.tan(Math.max(s.alt,.05)));
    g.strokeStyle='#FFD600';g.lineWidth=3*sc;g.beginPath();g.moveTo(cx,cy);g.lineTo(edge[0],edge[1]);g.stroke();
    g.strokeStyle=ink+'.75)';g.lineWidth=4*sc;const be=s.az+Math.PI;g.beginPath();g.moveTo(cx,cy);g.lineTo(cx-sl*Math.sin(be),cy+sl*Math.cos(be));g.stroke();
    g.fillStyle='#FFD600';g.strokeStyle=ink+'.9)';g.lineWidth=1.5*sc;g.beginPath();g.arc(sp[0],sp[1],7*sc,0,2*Math.PI);g.fill();g.stroke();}
  g.fillStyle=ink+'.95)';g.beginPath();g.arc(cx,cy,4*sc,0,2*Math.PI);g.fill();
  g.font=`800 ${10*sc}px DM Sans,system-ui,sans-serif`;g.textAlign='center';g.fillStyle=ink+'.6)';g.fillText('N',cx,cy-R-4*sc);
  g.restore();
}
function label(g,txt,x,y,sc,col){g.save();g.font=`700 ${11*sc}px DM Sans,system-ui,sans-serif`;g.textAlign='center';g.textBaseline='middle';
  const w=g.measureText(txt).width+12*sc;g.fillStyle=isDark()?'rgba(28,25,34,.92)':'rgba(255,253,248,.95)';
  g.beginPath();if(g.roundRect)g.roundRect(x-w/2,y-10*sc,w,20*sc,10*sc);else g.rect(x-w/2,y-10*sc,w,20*sc);g.fill();
  g.strokeStyle=col;g.lineWidth=1.5*sc;g.stroke();g.fillStyle=isDark()?'#f3efe7':'#17151c';g.fillText(txt,x,y+.5*sc);g.restore();}

// ── Bedienfeld ──
const IC={
  gaps:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="10" r="4.5"/><path d="M12 14.5V19M3 7V3h4M21 7V3h-4M3 17v4h4M21 17v4h-4"/></svg>',
  sun:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  surface:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z"/><path d="M12 10v6"/></svg>',
  shadow:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="8" width="7" height="12" rx="1"/><path d="M11 20h9l-5-6h-4" fill="currentColor" fill-opacity=".35"/></svg>',
  sunhours:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 18h18"/><path d="M6 18a6 6 0 0 1 12 0"/><path d="M12 6V4M5.6 9.6 4.2 8.2M18.4 9.6l1.4-1.4"/></svg>',
  albedo:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5" opacity=".6"/></svg>',
  heat:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8.5 14.5A3.5 3.5 0 0 0 12 18a3.5 3.5 0 0 0 3.5-3.5c0-2-2-3-2-6 0 0-1 .5-2 2-1-2-1-4-1-4S6 7 6 12c0 1 .5 2 2.5 2.5Z"/></svg>',
  play:'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
  pause:'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
  close:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  ext:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>'
};
function status(t,busy){const el=dock&&dock.querySelector('.lab-status');if(!el)return;el.innerHTML=t?(busy?'<span class="lab-spin" aria-hidden="true"></span>':'')+`<span>${t}</span>`:'';el.classList.toggle('on',!!t);}
const grad=(R,lo,hi)=>`linear-gradient(90deg,${R.map(r=>`rgb(${r[1].join(',')}) ${((r[0]-lo)/(hi-lo)*100).toFixed(0)}%`).join(',')})`;
function seg(modes,cur){return `<div class="lab-seg" role="tablist">${modes.map(([k,l])=>`<button role="tab" data-m="${k}" aria-selected="${cur===k}" class="${cur===k?'on':''}">${IC[k]||''}<span>${l}</span></button>`).join('')}</div>`;}
function dates(){const ds=[['today',T('Heute','Today','Vandaag')],['jun',T('21. Juni','21 June','21 juni')],['sep',T('21. Sept.','21 Sept','21 sept')],['dec',T('21. Dez.','21 Dec','21 dec')]];
  return `<div class="lab-dates" role="group" aria-label="${T('Tag','Day','Dag')}">${ds.map(([k,l])=>`<button data-d="${k}" class="${LAB.dateKey===k?'on':''}" aria-pressed="${LAB.dateKey===k}">${l}</button>`).join('')}</div>`;}
function timeRow(){const [a,b]=dayRange();return `<div class="lab-time"><button class="lab-play" aria-label="${LAB.playing?T('Anhalten','Pause','Pauzeren'):T('Tagesverlauf abspielen','Play the day','Dagverloop afspelen')}">${LAB.playing?IC.pause:IC.play}</button>
      <input type="range" class="lab-slider" min="${a!=null?a:300}" max="${b!=null?b:1260}" step="1" value="${clampMin()}" aria-label="${T('Uhrzeit','Time of day','Tijdstip')}">
      <b class="lab-clock">${hhmm(LAB.min)}</b></div>`;}
function bindTime(root,onTick){
  root.querySelectorAll('[data-d]').forEach(el=>el.onclick=()=>{LAB.dateKey=el.dataset.d;LAB.min=clampMin();renderDock();refresh();});
  const sl=root.querySelector('.lab-slider');if(sl)sl.oninput=()=>{LAB.min=+sl.value;if(LAB.playing){LAB.playing=false;syncPlay();}tick();onTick&&onTick();req();};
  const pl=root.querySelector('.lab-play');if(pl)pl.onclick=()=>{LAB.playing=!LAB.playing;syncPlay();if(LAB.playing)play(onTick);};
}

// ── Schatten wie Shademap: AHN-Oberflächenmodell (Gebäude + Bäume, gemessen) auf der Grafikkarte ──
// Jeder Bildpunkt schaut entlang der Sonnenrichtung, ob irgendwo etwas höher ist als der Sonnenstrahl.
const DSM={data:null,busy:null,seq:0};
const GL={ok:null};
const VS='attribute vec2 a;varying vec2 v;void main(){v=vec2(a.x,1.0-a.y);gl_Position=vec4(a*2.0-1.0,0.0,1.0);}';
// Schatten wie aus einem Guss: zwei Strahlen leicht versetzt (Sonnenscheibe → weiche Kante), Relief aus der
// Oberflächen-Normalen (Dächer, Fassaden), Verschattung enger Straßenräume (Umgebungsverdeckung), warmes Licht auf Sonnenseiten.
const FS='precision highp float;uniform sampler2D t;uniform vec2 da,db,px,r;uniform float k,s,e,dk,ns;uniform vec3 ld;varying vec2 v;'+
  'float H(vec2 u){vec4 q=texture2D(t,u);return (q.r*65280.0+q.g*255.0)/50.0;}'+
  'float Hb(vec2 u){vec2 g=u/px-0.5,f=fract(g),b=(floor(g)+0.5)*px;return mix(mix(H(b),H(b+vec2(px.x,0.0)),f.x),mix(H(b+vec2(0.0,px.y)),H(b+px),f.x),f.y);}'+
  'float Hs(vec2 u){return (2.0*Hb(u)+Hb(u+vec2(px.x,0.0))+Hb(u-vec2(px.x,0.0))+Hb(u+vec2(0.0,px.y))+Hb(u-vec2(0.0,px.y)))/6.0;}'+
  'void main(){float h0=H(v),sh=0.0;for(int i=1;i<=120;i++){float fi=float(i);if(fi>ns)break;float m=fi*s;vec2 u=v+da*m;if(u.x<0.0||u.y<0.0||u.x>1.0||u.y>1.0)break;if(H(u)>h0+m*k+e){sh=1.0;break;}}'+
  'float gx=(Hs(v+vec2(2.0*px.x,0.0))-Hs(v-vec2(2.0*px.x,0.0)))/(4.0*r.x),gy=(Hs(v+vec2(0.0,2.0*px.y))-Hs(v-vec2(0.0,2.0*px.y)))/(4.0*r.y);'+
  'vec3 n=normalize(vec3(-gx,-gy,1.0));float lam=max(dot(n,ld),0.0)/max(ld.z,0.05);lam=mix(1.0,lam,smoothstep(0.3,1.0,length(vec2(gx,gy))));'+
  'float oc=0.0;for(int j=0;j<4;j++){float a=float(j)*1.5708+0.785;vec2 o=vec2(cos(a)*px.x,sin(a)*px.y)*6.0/r.x;oc+=clamp((Hs(v+o)-h0-1.0)/6.0,0.0,1.0);}float ao=clamp(oc/2.5,0.0,1.0);'+
  'float dark=clamp(0.55*sh+0.28*clamp(1.0-lam,0.0,1.0)*(1.0-sh)+0.2*ao,0.0,0.74);'+
  'float warm=(1.0-sh)*clamp((lam-1.0)*0.45,0.0,0.2);'+
  'vec3 sc=mix(vec3(0.15,0.16,0.37),vec3(0.01,0.01,0.07),dk);'+
  'gl_FragColor=dark>=warm?vec4(sc,dark):vec4(1.0,0.82,0.52,warm);}';
function glInit(){
  if(GL.ok!==null)return GL.ok;GL.ok=false;
  try{const cv2=document.createElement('canvas'),gl=cv2.getContext('webgl',{premultipliedAlpha:false,preserveDrawingBuffer:true,antialias:false});
    if(!gl||typeof gl.createShader!=='function')return false;
    const mk=(type,src)=>{const sh=gl.createShader(type);if(!sh)return null;gl.shaderSource(sh,src);gl.compileShader(sh);return gl.getShaderParameter(sh,gl.COMPILE_STATUS)?sh:null;};
    const vs=mk(gl.VERTEX_SHADER,VS),fs=mk(gl.FRAGMENT_SHADER,FS);if(!vs||!fs)return false;
    const p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))return false;
    gl.useProgram(p);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
    for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
    const U=n=>gl.getUniformLocation(p,n);
    Object.assign(GL,{ok:true,cv:cv2,gl,p,tex,u:{da:U('da'),db:U('db'),px:U('px'),r:U('r'),k:U('k'),s:U('s'),e:U('e'),dk:U('dk'),ld:U('ld'),ns:U('ns')},texId:-1,key:'',moved:0,timer:0});
  }catch(err){GL.ok=false;}
  return GL.ok;
}
function viewRD(pad){const b=map.getBounds().pad(pad||0),C=[toRD(b.getSouth(),b.getWest()),toRD(b.getSouth(),b.getEast()),toRD(b.getNorth(),b.getWest()),toRD(b.getNorth(),b.getEast())];
  return [Math.min(...C.map(c=>c[0])),Math.min(...C.map(c=>c[1])),Math.max(...C.map(c=>c[0])),Math.max(...C.map(c=>c[1]))];}
async function loadDsm(){
  if(map.getZoom()<14||!glInit())return null;
  const v=viewRD(0),pad=map.getZoom()<15?.12:.25,[x0,y0,x1,y1]=viewRD(pad).map((n,i)=>i<2?Math.floor(n/10)*10:Math.ceil(n/10)*10);
  const res=Math.max(.5,Math.max(x1-x0,y1-y0)/1400),D=DSM.data;
  if(D&&v[0]>=D.x0&&v[1]>=D.y0&&v[2]<=D.x1&&v[3]<=D.y1&&D.res<=res*1.6)return D;
  if(DSM.busy)return DSM.busy;
  DSM.busy=(async()=>{
    status(T('Oberflächenmodell (AHN) für Schatten wird geladen …','Loading surface model (AHN) for shadows …','Oppervlaktemodel (AHN) voor schaduw laden …'),true);
    try{const W=Math.round((x1-x0)/res),H=Math.round((y1-y0)/res),r=await ahn('dsm_05m',x0,y0,x1,y1,W,H),z=r.z;
      let lo=Infinity,hi=-Infinity;for(let i=0;i<z.length;i++){const q=z[i];if(q>-50&&q<400){if(q<lo)lo=q;if(q>hi)hi=q;}}
      if(!isFinite(lo))throw new Error('leer');
      const px=new Uint8Array(r.w*r.h*4);
      for(let i=0;i<z.length;i++){const q=z[i]>-50&&z[i]<400?z[i]:lo,n=Math.max(0,Math.min(65535,Math.round((q-lo)*50)));px[4*i]=n>>8;px[4*i+1]=n&255;px[4*i+3]=255;}
      DSM.data={id:++DSM.seq,x0,y0,x1,y1,w:r.w,h:r.h,rx:(x1-x0)/r.w,ry:(y1-y0)/r.h,res,lo,hi,px};
      status('');return DSM.data;
    }catch(err){status(T('Oberflächenmodell gerade nicht erreichbar — Schatten nur aus Gebäudedaten (ab Zoom 16).','Surface model currently unavailable — shadows from building data only (zoom 16+).','Oppervlaktemodel momenteel niet bereikbaar — schaduw alleen uit gebouwdata (vanaf zoom 16).'));return null;}
    finally{DSM.busy=null;}
  })();
  return DSM.busy;
}
// Während Bewegung (Abspielen, Regler) halbe Auflösung und weniger Schritte — danach automatisch scharf nachrechnen
function renderShadow(sun){
  const D=DSM.data;if(!D||!glInit())return null;
  const dk=isDark()?1:0,sk=D.id+'|'+sun.az.toFixed(4)+'|'+sun.alt.toFixed(4)+'|'+dk,now=performance.now();
  if(GL.sk!==sk){GL.sk=sk;GL.moved=now;clearTimeout(GL.timer);GL.timer=setTimeout(()=>{if(LAB.on)req();},280);}
  const sharp=Math.max(1,Math.min(1.75,D.rx/mpp())),fast=now-GL.moved<260||LAB.playing,q=fast?.5:sharp,key=sk+'|'+q.toFixed(2);if(GL.key===key)return GL.cv;   // scharf: feiner als das Raster, wenn hineingezoomt
  const gl=GL.gl,w=Math.max(1,Math.round(D.w*q)),h=Math.max(1,Math.round(D.h*q));if(GL.cv.width!==w||GL.cv.height!==h){GL.cv.width=w;GL.cv.height=h;}
  gl.viewport(0,0,w,h);
  if(GL.texId!==D.id){gl.bindTexture(gl.TEXTURE_2D,GL.tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,D.w,D.h,0,gl.RGBA,gl.UNSIGNED_BYTE,D.px);GL.texId=D.id;}
  const b=sun.az+Math.PI,t=Math.tan(Math.max(sun.alt,.01)),maxLen=Math.min(600,(D.hi-D.lo+2)/t),ns=fast?64:120,step=Math.max(D.rx*.8,maxLen/ns),W=D.w*D.rx,H=D.h*D.ry;
  gl.uniform2f(GL.u.da,Math.sin(b)/W,-Math.cos(b)/H);gl.uniform2f(GL.u.db,Math.sin(b)/W,-Math.cos(b)/H);
  gl.uniform2f(GL.u.px,1/D.w,1/D.h);gl.uniform2f(GL.u.r,D.rx,D.ry);gl.uniform1f(GL.u.k,t);gl.uniform1f(GL.u.s,step);gl.uniform1f(GL.u.ns,ns);gl.uniform1f(GL.u.e,.6);gl.uniform1f(GL.u.dk,dk);   // Toleranz 60 cm: kein Selbstschatten im Kronenrauschen
  const c=Math.cos(sun.alt);gl.uniform3f(GL.u.ld,Math.sin(b)*c,-Math.cos(b)*c,Math.sin(sun.alt));
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);GL.key=key;return GL.cv;
}
function drawDsmShadow(g,X,sun,alpha){
  const D=DSM.data,c=D&&renderShadow(sun);if(!c)return false;
  const P=(x,y)=>{const ll=fromRD(x,y),q=w20(ll[0],ll[1]);return [q[0]*X.k-X.ox,q[1]*X.k-X.oy];},tl=P(D.x0,D.y1),tr=P(D.x1,D.y1),bl=P(D.x0,D.y0),cw=c.width,ch=c.height;
  g.save();g.globalAlpha=alpha;g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';if('filter' in g)g.filter=`blur(${(.5*X.sc).toFixed(2)}px)`;g.setTransform((tr[0]-tl[0])/cw,(tr[1]-tl[1])/cw,(bl[0]-tl[0])/ch,(bl[1]-tl[1])/ch,tl[0],tl[1]);g.drawImage(c,0,0);g.restore();return true;
}

// 3D-Ansicht (js/lab-3d.js): echte Körper und Schattenwurf in Echtzeit, Zeitregler bleibt hier
const v3dBtn=()=>{const V=LAB.v3d;if(!V)return '';return `<button class="lab-3dbtn${V.on?' on':''}" id="v3dBtn" ${V.busy?'disabled':''}>${V.busy?'<span class="lab-spin" aria-hidden="true"></span>':'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg>'}<span>${V.on?T('Zurück zur Karte','Back to the map','Terug naar de kaart'):T('In 3D ansehen — Schatten in Echtzeit','View in 3D — real-time shadows','Bekijk in 3D — schaduw in realtime')}</span></button>${V.err?`<p class="wt-warn">${V.err}</p>`:''}`;};
// ── Werkzeug „Sonne": Schatten, Sonnenstunden, Sonnenbahn am Punkt ──
const SUN_TOOL={id:'sun',order:1,icon:IC.sun,gate:false,keepStatus:true,
  label:()=>T('Sonne','Sun','Zon'),
  sub:()=>T('Schatten, Sonnenstunden und Sonnenbahn','Shadows, sun hours and sun path','Schaduw, zonuren en zonnebaan'),
  enter(){if(LAB.mode!=='shadow'&&LAB.mode!=='sunhours')LAB.mode='shadow';if(!PIN)PIN=map.getCenter();},
  render(){const timed=LAB.mode==='shadow';
    return seg([['shadow',T('Schatten','Shadows','Schaduw')],['sunhours',T('Sonnenstunden','Sun hours','Zonuren')]],LAB.mode)+dates()+
      (timed?timeRow()+v3dBtn()+`<div class="lab-sun"><div class="lab-dialw">${dial()}</div><p class="lab-suntxt">${sunText()}</p></div>`:'')+
      `<div class="lab-legw">${legend()}</div><p class="lab-hint">${T('Tippe auf die Karte: Sonnenbahn, Auf- und Untergangsrichtung für diesen Punkt.','Tap the map: sun path, sunrise and sunset direction for that spot.','Tik op de kaart: zonnebaan, op- en ondergangsrichting voor dat punt.')}</p>`;},
  bind(root){bindTime(root);const b=root.querySelector('#v3dBtn');if(b)b.onclick=()=>LAB.v3d.toggle();},
  async load(){
    if(LAB.mode==='shadow'){
      if(map.getZoom()<14){status(T('Für Schatten näher heranzoomen (ab Zoom 14).','Zoom in further for shadows (level 14+).','Zoom verder in voor schaduw (vanaf niveau 14).'));return;}
      const near=!tooFar();await Promise.all([loadDsm(),near?ensure('b'):null,near?ensureTrees().then(measureTrees):null]);
      if(!DSM.data&&!near)status(T('Für Schatten näher heranzoomen.','Zoom in further for shadows.','Zoom verder in voor schaduw.'));
      else if(near&&B.failed)status(T('Ein Teil der Daten konnte nicht geladen werden — Ränder können fehlen.','Some data could not be loaded — edges may be missing.','Een deel van de data kon niet worden geladen — randen kunnen ontbreken.'));
      return;}
    if(tooFar()){status(T('Sonnenstunden ab Zoom 16 — bitte näher heranzoomen.','Sun hours from zoom 16 — please zoom in.','Zonuren vanaf zoom 16 — zoom verder in.'));return;}
    req();await computeSunHours();status('');},
  draw(g,X){
    const dark=isDark();
    if(LAB.mode==='shadow'){
      const sun=sunNow();
      if(sun.alt>0.004){
        const low=sun.alt<15*SR;                                  // tiefe Sonne: wärmeres Licht
        if(!photo()){g.fillStyle=low?(dark?'rgba(255,150,70,.16)':'rgba(255,150,60,.13)'):(dark?'rgba(255,206,120,.11)':'rgba(255,214,120,.10)');g.fillRect(0,0,cv.width,cv.height);}
        if(!drawDsmShadow(g,X,sun,photo()?.8:1)&&!tooFar()){                // Rückfall ohne WebGL/AHN: Prismen aus 3D BAG
          const sz=map.getSize(),og=offscreen(sz.x,sz.y);           // Schatten in CSS-Auflösung (weich), Gebäude scharf in voller Auflösung
          castShadows(og,sun,xf(1),treesIn(.3),dark?'rgb(30,30,44)':'rgb(150,154,180)',dark||photo()?'rgb(0,0,8)':'rgb(24,22,44)',4);   // Baumschatten heller = lichtdurchlässig
          g.globalAlpha=dark?.78:photo()?.5:.44;g.imageSmoothingEnabled=true;g.drawImage(off,0,0,cv.width,cv.height);g.globalAlpha=1;}
      }else{g.fillStyle=dark?'rgba(6,6,16,.5)':'rgba(24,22,44,.34)';g.fillRect(0,0,cv.width,cv.height);}
      if(!tooFar()){drawBuildings(g,X,DSM.data?(dark?'rgba(59,54,68,.88)':'rgba(251,249,244,.88)'):(dark?'#3b3644':'#fbf9f4'),dark?'rgba(255,255,255,.18)':'rgba(23,21,28,.32)');   // Dächer ruhig: Schatten zählen am Boden
        drawCrowns(g,X,DSM.data?null:(dark?'rgba(110,170,110,.38)':'rgba(72,140,84,.36)'),dark?'rgba(150,210,150,.35)':'rgba(31,90,43,.45)');}
    }else{
      if(tooFar())return drawSunCalc(g,X);
      const img=SUNH&&SUNH.img;
      if(img&&SUNH.date===dateTag()){g.imageSmoothingEnabled=true;g.drawImage(img,SUNH.wx*X.k-X.ox,SUNH.wy*X.k-X.oy,SUNH.ww*X.k,SUNH.wh*X.k);}
      drawBuildings(g,X,dark?'rgba(42,38,49,.94)':'rgba(251,249,244,.95)',dark?'rgba(255,255,255,.16)':'rgba(23,21,28,.28)');
      drawCrowns(g,X,null,dark?'rgba(150,210,150,.4)':'rgba(31,90,43,.38)');
    }
    drawSunCalc(g,X);
  },
  click(e){PIN=e.latlng;tick();req();
    const [wx,wy]=w20(e.latlng.lat,e.latlng.lng),bld=hits(B,wx,wy)[0];
    if(bld)return bldInfo(bld);
    const tr=treeAt(wx,wy);if(tr)return treeInfo(tr);
    const v=LAB.mode==='sunhours'&&sunHoursAt(wx,wy);
    if(v)return `<b>${nf(v.h,1)} h</b> ${T('direkte Sonne','direct sun','directe zon')}<small>${T('von','of','van')} ${nf(SUNH.maxH,1)} h ${T('Tageslicht','daylight','daglicht')}</small>`;
    return null;},
  note:()=>LAB.mode==='shadow'?T('Schatten aus gemessenen Gebäudehöhen (3D BAG, 70-%-Dachhöhe) und Bäumen aus dem Baumregister: Höhe gemessen (AHN, Oberfläche − Gelände, Befliegung 2020–2022), Kronengröße aus dem Pflanzjahr geschätzt. Zweidimensional: Gelände und Schatten auf Dächern sind nicht dargestellt. Die Sonnenbahn am Punkt zeigt die Richtung von Auf- und Untergang und den Sonnenstand über den Tag (Mitte = senkrecht über dir).','Shadows from measured building heights (3D BAG, 70 % roof height) and register trees: height measured (AHN, surface − ground, flown 2020–2022), crown size estimated from planting year. Two-dimensional: terrain and shade on roofs are not shown. The sun path at the pin shows sunrise and sunset directions and the sun across the day (centre = straight overhead).','Schaduw uit gemeten gebouwhoogtes (3D BAG, 70%-dakhoogte) en bomen uit het register: hoogte gemeten (AHN, oppervlak − maaiveld, ingewonnen 2020–2022), kroongrootte geschat uit plantjaar. Tweedimensionaal: terrein en schaduw op daken niet getoond. De zonnebaan bij de speld toont op- en ondergangsrichting en de zon over de dag (midden = recht boven je).')
    :T('Für jeden Punkt am Boden: Stunden direkter Sonne von Aufgang bis Untergang, alle 15 Minuten berechnet. Baumkronen lassen rund 30 % Licht durch. Gebäude außerhalb des geladenen Ausschnitts fehlen am Rand.','For every point on the ground: hours of direct sun from sunrise to sunset, computed every 15 minutes. Tree crowns let about 30 % of light through. Buildings outside the loaded area are missing at the edges.','Voor elk punt op de grond: uren directe zon van op- tot ondergang, elke 15 minuten berekend. Boomkronen laten ~30 % licht door. Gebouwen buiten het geladen gebied ontbreken aan de rand.'),
  src:()=>`3D BAG (TU Delft / 3DGI, CC BY 4.0) · AHN (PDOK) · ${T('Baumregister Gemeente Utrecht','Tree register, Gemeente Utrecht','Bomenregister gemeente Utrecht')} · ${T('Sonnenstand astronomisch berechnet','Sun position computed astronomically','Zonnestand astronomisch berekend')}`
};
function bldInfo(b){return b.h!=null?`${T('Gebäude','Building','Gebouw')} · <b>${nf(b.h,1)} m</b> ${T('hoch','tall','hoog')}<small>${T('gemessen, 3D BAG','measured, 3D BAG','gemeten, 3D BAG')}</small>`:`${T('Gebäude','Building','Gebouw')}<small>${T('ohne Höhenmessung','no height measurement','zonder hoogtemeting')}</small>`;}

// ── Zukunft: KNMI'23 (Station De Bilt) + städtische Wärmeinsel (RIVM-Modell) am Punkt ──
let KNMI=null,knmiLoad=null;const UHI=new Map();
function loadKnmi(){if(!knmiLoad)knmiLoad=fetch(opt.knmiUrl||'data/official/knmi23_debilt.json').then(r=>r.ok?r.json():null).catch(()=>null).then(j=>KNMI=j);return knmiLoad;}
function uhiAt(lat,lon){
  const k=lat.toFixed(4)+','+lon.toFixed(4);if(UHI.has(k))return UHI.get(k);
  const [x,y]=toRD(lat,lon),L='Stedelijk_hitte_eiland_effect_01062022_v2';
  const p=fetch(`https://data.rivm.nl/geo/ank/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=${L}&QUERY_LAYERS=${L}&STYLES=&CRS=EPSG:28992&BBOX=${x-50},${y-50},${x+50},${y+50}&WIDTH=101&HEIGHT=101&I=50&J=50&INFO_FORMAT=application/json&FEATURE_COUNT=1`)
    .then(r=>r.json()).then(j=>{const v=j.features&&j.features[0]&&j.features[0].properties.GRAY_INDEX;return v!=null&&v>-50&&v<20?v:null;}).catch(()=>null);
  UHI.set(k,p);return p;
}
function future(){
  if(!KNMI)return '';const I=KNMI.ind,lg=opt.lang()==='en'?'en':opt.lang()==='nl'?'nl':'de',rng=o=>{const v=Object.values(o);return [Math.min(...v),Math.max(...v)];};
  const fmtR=([a,b])=>a===b?nf(a,a<10&&a%1?1:0):`${nf(a,a<10&&a%1?1:0)}–${nf(b,b<10&&b%1?1:0)}`;
  const row=k=>{const r=I[k],r50=rng(r.y[2050]),r00=rng(r.y[2100]),max=Math.max(r00[1],r.ref)*1.05,pc=v=>(100*v/max).toFixed(1);
    return `<div class="fz-row"><div class="fz-l">${r[lg]}</div><div class="fz-bars"><span class="fz-b now" style="width:${pc(r.ref)}%"></span><span class="fz-b r50" style="left:${pc(r50[0])}%;width:${Math.max(.8,pc(r50[1])-pc(r50[0]))}%"></span><span class="fz-b r00" style="left:${pc(r00[0])}%;width:${Math.max(.8,pc(r00[1])-pc(r00[0]))}%"></span></div>
      <div class="fz-n"><b>${fmtR([r.ref,r.ref])}</b><span>→ ${fmtR(r50)}</span><span>→ ${fmtR(r00)}</span></div></div>`;};
  return `<div class="fz"><div class="fz-h"><b>${T('Hitze heute → 2050 → 2100','Heat today → 2050 → 2100','Hitte nu → 2050 → 2100')}</b><span>${T('Tage pro Jahr · KNMI\'23, Station De Bilt, alle sechs Szenarien','days per year · KNMI\'23, De Bilt station, all six scenarios','dagen per jaar · KNMI\'23, station De Bilt, alle zes scenario\'s')}</span></div>
    ${row('tropisch')}${row('nachten')}${row('zomers')}
    <div class="fz-key"><span><i class="now"></i>1991–2020</span><span><i class="r50"></i>2050</span><span><i class="r00"></i>2100</span></div>
    <p class="fz-uhi" id="fzUhi">${T('Wärmeinsel wird abgefragt …','Querying urban heat island …','Hitte-eiland wordt opgevraagd …')}</p></div>`;
}
function uhiText(v){return v==null?T('Wärmeinsel hier: kein Modellwert.','Urban heat island here: no model value.','Hitte-eiland hier: geen modelwaarde.')
  :`${T('Wärmeinsel hier','Urban heat island here','Hitte-eiland hier')}: <b>+${nf(v,1)} °C</b> ${T('im Sommermittel gegenüber dem Umland (RIVM-Modell 2022). Die KNMI-Werte gelten für das Umland — in der Stadt kommt dies hinzu.','as a summer average compared with the countryside (RIVM model 2022). The KNMI values apply to the countryside — the city adds this on top.','als zomergemiddelde t.o.v. het buitengebied (RIVM-model 2022). De KNMI-waarden gelden voor het buitengebied — in de stad komt dit erbij.')}`;}
function fillUhi(){const el=dock&&dock.querySelector('#fzUhi');if(!el)return;const c=PIN||map.getCenter();uhiAt(c.lat,c.lng).then(v=>{const e2=dock.querySelector('#fzUhi');if(e2)e2.innerHTML=uhiText(v);});}

// ── Werkzeug „Hitze": Oberflächen-Albedo und Hitze-Index ──
const SURF_TOOL={id:'surface',order:2,icon:IC.surface,
  label:()=>T('Hitze','Heat','Hitte'),
  sub:()=>T('Oberflächen und Hitze-Index','Surfaces and heat index','Oppervlakken en hitte-index'),
  enter(){if(LAB.mode!=='albedo'&&LAB.mode!=='heat'&&LAB.mode!=='gaps')LAB.mode='heat';if(!KNMI)loadKnmi().then(()=>{if(LAB.tool==='surface')renderDock();});},
  render(){return seg([['albedo',T('Oberflächen','Surfaces','Oppervlakken')],['heat',T('Hitze-Index','Heat index','Hitte-index')],['gaps',T('Kühl-Lücken','Cooling gaps','Koelkansen')]],LAB.mode)+`<div class="lab-legw">${legend()}</div>`+future();},
  bind(){fillUhi();},
  async load(){if(LAB.mode==='albedo')await Promise.all([ensure('s'),ensure('b'),ensureTrees()]);else if(LAB.mode==='gaps'){req();await computeGaps();}else{req();await computeHeat();}},
  draw(g,X){const dark=isDark();
    if(LAB.mode==='gaps'){const G=SUNH&&SUNH.gap;
      if(G){g.imageSmoothingEnabled=true;g.drawImage(G.img,SUNH.wx*X.k-X.ox,SUNH.wy*X.k-X.oy,SUNH.ww*X.k,SUNH.wh*X.k);}
      drawBuildings(g,X,dark?'rgba(42,38,49,.55)':'rgba(251,249,244,.6)',dark?'rgba(255,255,255,.14)':'rgba(23,21,28,.22)');
      drawCrowns(g,X,null,dark?'rgba(150,210,150,.35)':'rgba(31,90,43,.3)');return;}
    if(LAB.mode==='heat'){const img=SUNH&&SUNH.heatImg;
      if(img){g.imageSmoothingEnabled=true;g.drawImage(img,SUNH.wx*X.k-X.ox,SUNH.wy*X.k-X.oy,SUNH.ww*X.k,SUNH.wh*X.k);}
      drawBuildings(g,X,dark?'rgba(42,38,49,.94)':'rgba(251,249,244,.95)',dark?'rgba(255,255,255,.16)':'rgba(23,21,28,.28)');
      drawCrowns(g,X,null,dark?'rgba(150,210,150,.4)':'rgba(31,90,43,.38)');}
    else{drawSurfaces(g,X);
      drawBuildings(g,X,dark?'rgba(60,56,66,.9)':'rgba(206,201,192,.9)',dark?'rgba(255,255,255,.14)':'rgba(23,21,28,.22)');
      drawCrowns(g,X,'rgba(72,140,84,.18)',dark?'rgba(150,210,150,.35)':'rgba(31,90,43,.35)');}},
  click(e){PIN=e.latlng;fillUhi();const [wx,wy]=w20(e.latlng.lat,e.latlng.lng),bld=hits(B,wx,wy)[0];if(bld)return bldInfo(bld);
    if(LAB.mode==='gaps'){const lv=gapAt(wx,wy),o=hits(S,wx,wy).filter(gapCand).pop(),v=sunHoursAt(wx,wy);
      if(!lv)return `<b>${T('Keine Kühl-Lücke','No cooling gap','Geen koelkans')}</b><small>${o?T('Fläche liegt schon im Schatten oder ist nicht heiß genug.','This patch is already shaded or not hot enough.','Dit vlak ligt al in de schaduw of is niet heet genoeg.'):T('Fahrbahn, Grün, Wasser, Gebäude oder privater Hof.','Carriageway, green, water, building or private yard.','Rijbaan, groen, water, gebouw of privéterrein.')}</small>`;
      const nm=o?(GAP_NM[o.f]?T(...GAP_NM[o.f]):T('Platz oder befestigte Fläche','square or paved area','plein of verharding')):T('befestigte Fläche','paved area','verharding');
      return `<b>${T('Kühl-Lücke','Cooling gap','Koelkans')} · ${lv===2?T('hohe Priorität','high priority','hoge prioriteit'):T('mittel','medium','middel')}</b> · ${nm}<small>${v?`${nf(v.h,1)} h ${T('direkte Sonne am 21. Juni','direct sun on 21 June','directe zon op 21 juni')} · `:''}${T('Baum, Entsiegeln oder heller Belag; Leitungen und Zufahrten prüfen','tree, depaving or lighter paving; check cables and access','boom, ontharden of lichte bestrating; kabels en toegang controleren')}</small>`;}
    if(LAB.mode==='heat'){const v=sunHoursAt(wx,wy);if(v)return `<b>${nf(v.h,1)} h</b> ${T('direkte Sonne','direct sun','directe zon')}<small>${T('von','of','van')} ${nf(SUNH.maxH,1)} h ${T('Tageslicht','daylight','daglicht')}</small>`+(v.risk!=null?`<br>${T('Hitze-Index','Heat index','Hitte-index')} <b>${Math.round(100*Math.min(1,v.risk/RISK_MAX))}</b> / 100`:'');return null;}
    const o=hits(S,wx,wy).pop();if(!o)return null;
    const nm=MAT[o.m]?(opt.lang()==='nl'?o.m:MAT[o.m][opt.lang()==='en'?1:0]):(o.m||T('Fläche','surface','vlak'));
    return `<b>${nm.charAt(0).toUpperCase()+nm.slice(1)}</b> · Albedo ${nf(o.a,2)}<small>${T('Material laut BGT','material per BGT','materiaal volgens BGT')}${o.f?' · '+o.f:''}</small>`;},
  note:()=>LAB.mode==='gaps'?T('Kühl-Lücke = Pixel auf Parkplatz, Gehweg, Fußgängerbereich, Wohnstraße, Verkehrsinsel oder öffentlichem Platz (BGT), ohne Gebäude und ohne Baumkrone (Baumregister), mit Hitze-Index ab 0,45 (mittel) bzw. 0,6 (hoch) am 21. Juni; ganztägig besonnte Gehwegplatten erreichen etwa 0,85. Fahrbahnen und Radwege zählen nicht. Bewusst streng: Was hier nicht gefärbt ist, ist nicht automatisch gut.','Cooling gap = pixel on parking, footpath, pedestrian area, home zone, traffic island or public square (BGT), without building or tree crown (tree register), with a heat index of at least 0.45 (medium) or 0.6 (high) on 21 June; pavement tiles in sun all day reach about 0.85. Carriageways and cycle paths do not count. Deliberately strict: what is not coloured is not automatically fine.','Koelkans = pixel op parkeervlak, voetpad, voetgangersgebied, woonerf, verkeerseiland of openbaar plein (BGT), zonder gebouw en zonder boomkroon (bomenregister), met een hitte-index vanaf 0,45 (middel) of 0,6 (hoog) op 21 juni; stoeptegels die de hele dag in de zon liggen halen ongeveer 0,85. Rijbanen en fietspaden tellen niet. Bewust streng: wat niet gekleurd is, is niet automatisch goed.'):LAB.mode==='albedo'?T('Rückstrahlung (Albedo) je Material laut BGT — Asphalt, Klinker, Pflaster, Grün, Wasser — nach Literaturwerten (Oke; US EPA). Nur aktuell gültige Objekte. Dächer: Material ist nicht erfasst.','Reflectivity (albedo) per material from the BGT — asphalt, brick, paving, green, water — using literature values (Oke; US EPA). Current objects only. Roofs: material is not recorded.','Weerkaatsing (albedo) per materiaal uit de BGT — asfalt, klinkers, tegels, groen, water — volgens literatuurwaarden (Oke; US EPA). Alleen actuele objecten. Daken: materiaal niet vastgelegd.')
    :T('Näherung, kein Mikroklimamodell: Sonnenstunden am 21. Juni × aufgenommene Strahlung (1 − Albedo) × Oberflächenart (Grün und Wasser kühlen durch Verdunstung). Zeigt, wo Schatten und hellere Beläge am meisten bringen — keine Lufttemperatur.','Approximation, not a microclimate model: sun hours on 21 June × absorbed radiation (1 − albedo) × surface type (green and water cool by evaporation). Shows where shade and lighter paving help most — not air temperature.','Benadering, geen microklimaatmodel: zonuren op 21 juni × geabsorbeerde straling (1 − albedo) × oppervlaktetype (groen en water koelen door verdamping). Toont waar schaduw en lichtere verharding het meest helpen — geen luchttemperatuur.'),
  src:()=>`BGT (Kadaster / PDOK) · 3D BAG (TU Delft / 3DGI, CC BY 4.0) · ${T('Baumregister Gemeente Utrecht','Tree register, Gemeente Utrecht','Bomenregister gemeente Utrecht')} · KNMI'23 (klimaatscenarios-data.knmi.nl) · RIVM ${T('Wärmeinsel-Modell 2022','urban heat island model 2022','hitte-eilandmodel 2022')}`
};

// ── Sonnenbahn-Zifferblatt und Sonnentext ──
function dial(){
  const c=PIN||map.getCenter(),[a,b]=dayRange(),R=36,S=92,o=S/2,pt=s=>{const r=R*(1-Math.max(0,s.alt)/(Math.PI/2)),be=s.az+Math.PI;return [o+r*Math.sin(be),o-r*Math.cos(be)];};
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
function legend(){
  const dk=isDark();
  if(LAB.mode==='shadow')return `<div class="lab-leg"><span><i style="background:${dk?'rgb(12,11,18)':'rgb(146,140,148)'}"></i>${T('Gebäudeschatten','Building shade','Gebouwschaduw')}</span><span><i style="background:${dk?'rgb(44,40,52)':'rgb(204,200,206)'}"></i>${T('Baumschatten','Tree shade','Boomschaduw')}</span><span><i style="background:rgba(72,140,84,.5);border-radius:50%"></i>${T('Baumkrone','Tree crown','Boomkroon')}</span></div>`;
  if(LAB.mode==='sunhours'){const mh=SUNH&&SUNH.maxH&&SUNH.date===dateTag()?SUNH.maxH:null;return `<div class="lab-ramp" style="background:${grad(SUN_RAMP,0,1)}"></div><div class="lab-rl"><span>0 h</span><span>${T('direkte Sonne am Boden','direct sun at ground level','directe zon op maaiveld')}</span><span>${mh?nf(mh,1)+' h':''}</span></div>`;}
  if(LAB.mode==='gaps'){const G=SUNH&&SUNH.gap;return `<div class="lab-leg"><span><i style="background:rgb(24,128,92)"></i>${T('hohe Priorität','high priority','hoge prioriteit')}</span><span><i style="background:rgb(143,211,182)"></i>${T('mittel','medium','middel')}</span></div>`+
    (G?`<p class="lab-gapst"><b>${fmt(Math.round(G.hi/10)*10)} m²</b> ${T('hohe und','high and','hoge en')} <b>${fmt(Math.round(G.mid/10)*10)} m²</b> ${T('mittlere Kühl-Lücken im Ausschnitt','medium cooling gaps in view','middelgrote koelkansen in beeld')} — ${T('von','of','van')} ${fmt(Math.round(G.cand/10)*10)} m² ${T('Parkplätzen, Gehwegen und Plätzen ohne Baum.','parking, pavements and squares without trees.','parkeervlakken, stoepen en pleinen zonder boom.')}</p>`:'')+
    `<p class="lab-mute">${T('Gefärbt sind nur Teilflächen, nie ganze Straßen: dort passt ein Baum, eine Entsiegelung oder ein hellerer Belag — vor Ort prüfen (Leitungen, Zufahrten).','Only patches are coloured, never whole streets: a tree, depaving or lighter paving fits there — check on site (cables, access).','Alleen deelvlakken zijn gekleurd, nooit hele straten: daar past een boom, ontharding of lichtere bestrating — ter plekke controleren (kabels, toegang).')}</p>`;}
  if(LAB.mode==='albedo')return `<div class="lab-ramp" style="background:${grad(ALB_RAMP,0.05,0.35)}"></div><div class="lab-rl"><span>${T('dunkel · speichert Hitze','dark · stores heat','donker · houdt warmte vast')}</span><span>${T('hell · reflektiert','light · reflects','licht · weerkaatst')}</span></div><div class="lab-leg"><span><i style="background:${albCol(0.22,CLASS.green)}"></i>${T('Grün (kühlt durch Verdunstung)','green (cools by evaporation)','groen (koelt door verdamping)')}</span><span><i style="background:${albCol(0.07,CLASS.water)}"></i>${T('Wasser','water','water')}</span></div>`;
  return `<div class="lab-ramp" style="background:${grad(HEAT_RAMP,0,1)}"></div><div class="lab-rl"><span>${T('gering','low','laag')}</span><span>${T('Hitze-Index der Oberfläche · 21. Juni','surface heat index · 21 June','hitte-index oppervlak · 21 juni')}</span><span>${T('hoch','high','hoog')}</span></div>`;
}

// ── Werkzeug-Verwaltung ──
const TOOLS=[SUN_TOOL,SURF_TOOL];
LAB.addTool=function(def){TOOLS.push(def);TOOLS.sort((a,b)=>a.order-b.order);if(dock&&LAB.on)renderDock();};
const tool=()=>TOOLS.find(t=>t.id===LAB.tool)||TOOLS[0];
function setTool(id){
  const cur=tool();if(cur.id===id){return;}
  LAB.playing=false;cur.leave&&cur.leave(api);if(LAB.v3d&&LAB.v3d.on&&id!=='sun')LAB.v3d.close();LAB.tool=id;hideInfo();
  const t=tool();t.enter&&t.enter(api);renderDock();refresh();opt.onTool&&opt.onTool(id);
}
const BASES=[['map',()=>T('Karte','Map','Kaart')],['photo',()=>T('Luftbild','Aerial','Luchtfoto')],['osm',()=>'OSM']];
function renderDock(){
  const t=tool();
  dock.innerHTML=`<div class="lab-top"><div><b>${T('Straßenlabor','Street lab','Straatlab')}</b><span>${t.sub?t.sub():''}</span></div><button class="lab-x" aria-label="${T('Straßenlabor schließen','Close street lab','Straatlab sluiten')}">${IC.close}</button></div>
    <nav class="lab-tgs" aria-label="${T('Werkzeuge','Tools','Gereedschap')}">${[['see',T('Verstehen','Understand','Begrijpen')],['make',T('Gestalten','Design','Ontwerpen')]].map(([g,l])=>{const L=TOOLS.filter(x=>(x.grp||'see')===g);return L.length?`<div class="lab-tg"><span class="lab-tgc" id="labTg-${g}">${l}</span><div class="lab-tools" role="tablist" aria-labelledby="labTg-${g}" style="--n:${L.length}">${L.map(x=>`<button role="tab" data-t="${x.id}" aria-selected="${x===t}" class="${x===t?'on':''}">${x.icon}<span>${x.label()}</span></button>`).join('')}</div></div>`:'';}).join('')}</nav>
    <div class="lab-body" data-tool="${t.id}">${t.render?t.render(api):''}</div>
    <div class="lab-status" role="status"></div>
    <div class="lab-base"><span>${T('Hintergrund','Background','Achtergrond')}</span>${BASES.map(([k,l])=>`<button data-b="${k}" class="${LAB.base===k?'on':''}" aria-pressed="${LAB.base===k}">${l()}</button>`).join('')}<a class="lab-osm" target="_blank" rel="noopener" href="${osmUrl()}">${T('In OSM öffnen','Open in OSM','Open in OSM')} ${IC.ext}</a></div>
    <details class="lab-how"><summary>${T('Wie wird gerechnet?','How is this computed?','Hoe wordt dit berekend?')}</summary><p>${t.note?t.note(api):''}</p><p class="lab-src">${T('Quellen','Sources','Bronnen')}: ${t.src?t.src(api):''}</p></details>`;
  dock.querySelector('.lab-x').onclick=()=>LAB.close();
  dock.querySelectorAll('.lab-tools [data-t]').forEach(el=>el.onclick=()=>setTool(el.dataset.t));
  dock.querySelectorAll('.lab-body [data-m]').forEach(el=>el.onclick=()=>setMode(el.dataset.m));
  dock.querySelectorAll('.lab-base [data-b]').forEach(el=>el.onclick=()=>{LAB.base=el.dataset.b;opt.setBase&&opt.setBase(LAB.base);dock.querySelectorAll('.lab-base [data-b]').forEach(x=>{x.classList.toggle('on',x.dataset.b===LAB.base);x.setAttribute('aria-pressed',x.dataset.b===LAB.base);});req();});
  t.bind&&t.bind(dock.querySelector('.lab-body'),api);
}
function osmUrl(){const c=map.getCenter();return `https://www.openstreetmap.org/#map=${Math.round(map.getZoom())}/${c.lat.toFixed(5)}/${c.lng.toFixed(5)}`;}
function clampMin(){const [a,b]=dayRange();if(a==null)return LAB.min;return Math.round(Math.min(Math.max(LAB.min,a),b));}
function syncPlay(){const pl=dock.querySelector('.lab-play');if(pl){pl.innerHTML=LAB.playing?IC.pause:IC.play;pl.setAttribute('aria-label',LAB.playing?T('Anhalten','Pause','Pauzeren'):T('Tagesverlauf abspielen','Play the day','Dagverloop afspelen'));}}
function tick(){
  const sl=dock.querySelector('.lab-slider'),cl=dock.querySelector('.lab-clock'),dw=dock.querySelector('.lab-dialw'),tx=dock.querySelector('.lab-suntxt');
  if(sl&&document.activeElement!==sl)sl.value=LAB.min;if(cl)cl.textContent=hhmm(LAB.min);if(dw)dw.innerHTML=dial();if(tx)tx.innerHTML=sunText();
  const t=tool();t.tick&&t.tick(api);
}
function play(onTick,once){
  const [a,b]=dayRange();if(a==null){LAB.playing=false;syncPlay();return;}
  if(LAB.min>=b-5)LAB.min=a;
  let last=0,wrapped=false;const t0=tool(),stopAt=LAB.min;
  (function f(now){if(!LAB.playing||!LAB.on||tool()!==t0)return;now=now||performance.now();
    if(last)LAB.min+=Math.min(100,now-last)/1000*75;last=now;              // 75 Minuten pro Sekunde
    if(LAB.min>b){LAB.min=a;wrapped=true;}
    if(once&&wrapped&&LAB.min>=stopAt){LAB.min=stopAt;LAB.playing=false;syncPlay();tick();draw();return;}   // einmal durch den Tag, zurück zur echten Uhrzeit
    tick();onTick&&onTick();draw();requestAnimationFrame(f);})();
}
async function setMode(m){
  const owner=TOOLS.find(t=>t.id===(m==='albedo'||m==='heat'||m==='gaps'?'surface':m==='shadow'||m==='sunhours'?'sun':LAB.tool));
  if(owner&&owner.id!==LAB.tool){LAB.mode=m;setTool(owner.id);return;}
  LAB.mode=m;LAB.playing=false;LAB.min=clampMin();renderDock();await refresh();
}
let refreshing=0;
async function refresh(){
  if(!LAB.on)return;
  const job=++refreshing,t=tool();
  if(t.gate!==false&&tooFar()){status(T('Für das Straßenlabor näher heranzoomen.','Zoom in further for the street lab.','Zoom verder in voor het straatlab.'));req();return;}
  try{
    if(t.load)await t.load(api);
    if(job!==refreshing)return;
    const lg=dock.querySelector('.lab-legw');if(lg&&(t.id==='sun'||t.id==='surface'))lg.innerHTML=legend();
    const failed=t.gate===false?0:(B.failed||0)+((t.id==='surface'||t.usesSurfaces)?(S.failed||0):0);
    if(!t.keepStatus)status(failed?T('Ein Teil der Daten konnte nicht geladen werden — Ränder können fehlen.','Some data could not be loaded — edges may be missing.','Een deel van de data kon niet worden geladen — randen kunnen ontbreken.'):'');
  }catch(e){status(T('Daten gerade nicht erreichbar — bitte erneut versuchen.','Data currently unavailable — please try again.','Data momenteel niet bereikbaar — probeer het opnieuw.'));}
  req();
}

// ── Antippen ──
function inPoly(px,py,z){let ins=false;for(let i=0,n=z.length/2,j=n-1;i<n;j=i++){const xi=z[2*i],yi=z[2*i+1],xj=z[2*j],yj=z[2*j+1];if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi))ins=!ins;}return ins;}
function showInfo(html,p){if(!html){hideInfo();return;}info.innerHTML=html;const sz=map.getSize();
  info.style.left=Math.max(8,Math.min(p.x+14,sz.x-250))+'px';info.style.top=Math.max(8,p.y-56)+'px';info.classList.add('on');}
function hideInfo(){info&&info.classList.remove('on');}
async function pointInfo(e){
  if(!LAB.on)return;const t=tool();if(!t.click)return;
  const r=t.click(e,api);
  if(r&&typeof r.then==='function'){showInfo(`<span class="lab-spin" aria-hidden="true"></span>`,e.containerPoint);const html=await r;showInfo(html,e.containerPoint);}
  else showInfo(r,e.containerPoint);
}

// ── Schnittstelle für weitere Werkzeuge ──
const api={T,nf,fmt,SR,lang:()=>opt.lang(),dark:isDark,status,req,refresh,rerender:()=>renderDock(),ensure,ensureTrees,treesIn,hits,index,
  get map(){return map},get B(){return B},get S(){return S},get TREES(){return TREES},get GENERA(){return GENERA},get SUNH(){return SUNH},get PIN(){return PIN},set PIN(v){PIN=v;},
  computeSunHours,computeHeat,sunHoursAt,measureTrees,uhiAt,loadKnmi,get KNMI(){return KNMI},geotiff,treeAt,treeInfo,get TH(){return TH},w20,xf,mpp,m20,toRD,fromRD,inPoly,poly,chunked,signed,sunPos,sunNow,sunAt,atMin,dayRange,dayDate,hhmm,bearing,dirName,
  ALB,MAT,CLASS,albCol,ramp,grad,showInfo,hideInfo,offscreen,yieldNow,tooFar,isPhoto:photo,drawBuildings,drawCrowns,drawSurfaces,castShadows,bldInfo,limited,bgtItems,live,
  dates,timeRow,bindTime,seg,label,IC,tool:()=>LAB.tool,setTool,
  cv:()=>cv,dpr:()=>dpr,body:()=>dock.querySelector('.lab-body'),opt:()=>opt};
LAB.api=api;

// ── Lebenszyklus ──
let moveT=null;
LAB.init=function(m,o){
  map=m;opt=o;
  cv=document.createElement('canvas');cv.className='lab-canvas';map.getContainer().appendChild(cv);ctx=cv.getContext('2d');
  info=document.createElement('div');info.className='lab-info';info.setAttribute('aria-live','polite');map.getContainer().appendChild(info);
  dock=document.createElement('section');dock.className='lab-dock';dock.setAttribute('aria-label','Straßenlabor');document.body.appendChild(dock);
  map.on('move zoom resize viewreset',()=>{if(LAB.on){req();hideInfo();}});
  // Zoom-Animation: Ebene mitskalieren wie Leaflets eigene Ebenen
  map.on('zoomanim',e=>{if(!LAB.on)return;const s=map.getZoomScale(e.zoom),sz=map.getSize(),c=map.latLngToContainerPoint(e.center);
    const tx=sz.x/2*(1-s)-s*(c.x-sz.x/2),ty=sz.y/2*(1-s)-s*(c.y-sz.y/2);
    cv.style.transformOrigin='0 0';cv.style.transition='transform .25s cubic-bezier(0,0,.25,1)';cv.style.transform=`translate(${tx}px,${ty}px) scale(${s})`;});
  map.on('zoomend',()=>{cv.style.transition='none';cv.style.transform='';if(LAB.on)draw();});
  map.on('moveend',()=>{if(!LAB.on)return;const a=dock.querySelector('.lab-osm');if(a)a.href=osmUrl();const t=tool();t.moved&&t.moved(api);
    clearTimeout(moveT);moveT=setTimeout(refresh,(LAB.mode==='sunhours'||LAB.mode==='heat')&&(t.id==='sun'||t.id==='surface')?450:150);});
  map.on('click',pointInfo);
};
LAB.open=function(latlng,toolId){
  if(!map)return;LAB.on=true;document.body.classList.add('lab-on');
  if(toolId&&TOOLS.some(t=>t.id===toolId))LAB.tool=toolId;
  const now=new Date();LAB.min=now.getHours()*60+now.getMinutes();
  const zt=LAB.tool==='sun'||LAB.tool==='water'||LAB.tool==='wind'?15:17;                      // Sonne: erst den Stadtteil zeigen, wie Shademap
  if(latlng||map.getZoom()<zt-.5){const z=Math.max(map.getZoom(),zt),c=latlng||map.getCenter();if(map.getSize().x)map.flyTo(c,z,{duration:.9});else map.setView(c,z);}
  PIN=latlng||map.getCenter();LAB.min=clampMin();
  const t=tool();t.enter&&t.enter(api);
  renderDock();opt.onOpen&&opt.onOpen();refresh();
  const calm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(LAB.tool==='sun'&&LAB.mode==='shadow'&&!calm&&!LAB.autoplayed){LAB.autoplayed=true;setTimeout(()=>{if(!LAB.on||LAB.playing||LAB.tool!=='sun')return;LAB.playing=true;syncPlay();play(null,true);},1600);}   // einmal den Tagesverlauf zeigen
};
LAB.close=function(){if(!LAB.on)return;if(LAB.v3d&&LAB.v3d.on)LAB.v3d.close();const t=tool();t.leave&&t.leave(api);LAB.on=false;LAB.playing=false;document.body.classList.remove('lab-on');ctx&&ctx.clearRect(0,0,cv.width,cv.height);hideInfo();
  if(LAB.base!=='map'){LAB.base='map';opt.setBase&&opt.setBase('map');}opt.onClose&&opt.onClose();};
LAB.relang=function(){if(LAB.on)renderDock();};
LAB.redraw=req;
LAB.setTool=setTool;
LAB._t={computeGaps,gapCand,GAP_TH,get SUNH(){return SUNH},sunText,legend,NOTE:{heat:()=>{const m=LAB.mode,t=LAB.tool;LAB.mode='heat';LAB.tool='surface';const r=SURF_TOOL.note();LAB.mode=m;LAB.tool=t;return r;}},pointInfo,sunPos,toRD,fromRD,surf,ALB,dayRange,castShadows,signed,inPoly,atMin,
  get B(){return B},get S(){return S},get SUNH(){return SUNH},get TREES(){return TREES},measureTrees,get TH(){return TH},computeSunHours,get DSM(){return DSM},get GL(){return GL},loadDsm,renderShadow,glInit,computeHeat,ensure,ensureTrees,refresh,draw,setTool,get TOOLS(){return TOOLS}};
})();

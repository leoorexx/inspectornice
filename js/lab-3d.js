// ══════════════════════════════════════════════════════════════
// Straßenlabor · Spielstadt 3D (wie Shadowmap, offen und frei)
//  Licht:     Gebäude (3D BAG, gemessene Höhen) und Registerbäume (AHN-Höhe) auf dem
//             echten Gelände (AHN), Schattenwurf in Echtzeit zum Zeitregler, Sonnenbahn.
//  Wasser:    Grachten mit bewegter Oberfläche; Szenarien Wolkenbruch (Mulden, eigene
//             Rechnung), Deichbruch (LIWO-Tiefen, amtlich) und Wasserstand („Badewanne").
//  Rad:       simulierte Radfahrer:innen auf dem OSM-Radnetz; selbst fahren mit
//             Schattenmesser (Strahl zur Sonne gegen Gebäude und Kronen).
//  Wachstum:  „Stadt wächst" nach Baujahr (BAG).
// Kamera mit Schwung (Trägheit), Augenhöhe, Relief überhöhbar.
// ══════════════════════════════════════════════════════════════
(function(){
'use strict';
const LAB=window.LAB;if(!LAB||!LAB.api)return;
const A=LAB.api,T=(d,e,n)=>A.T(d,e,n);
const V={on:false,busy:false,err:null,R:320,ground:'map',eye:false,grow:null,stats:null,mode:'licht',exag:1,
  water:{kind:null,k:3,level:null,target:null,t:1,busy:false,info:null},bikes:{on:false,n:0,follow:-1,ride:null,shade:null,busy:false,err:null},
  walk:{on:false,n:0,seek:true,shade:null,busy:false},wind:{on:false,busy:false,err:null,dir:null,sp:null,cur:null},fut:{busy:false,err:null,yr:null,info:null,loaded:false,play:false}};
LAB.v3d=V;
let THREE=null,ren,scene,cam,sunL,hemi,sunBall,pathLine,root,buckets=[],crowns=null,trunks=null,el=null,raf=0,dirty=true,lastSun='',clock=0;
let TER=null,terMesh=null,canals=[],waterMesh=null,waterTex=null,bikeMeshes=null,NET=null,AG=[],PLAYER=null;
let dial=null,dialDay='',skyCv=null,skyTx=null,walkMeshes=null,WK=[],windObj=null,WG=null,futObj=null;
const CAM={th:-2.35,ph:1.0,r:620,tx:0,tz:0,yaw:0,pitch:.08,vth:0,vph:0,vr:1,vx:0,vz:0,goal:null};   // Umlauf mit Schwung + Augenhöhe
let C0=null;
const REDUCED=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;

const three=()=>THREE?Promise.resolve(THREE):import('https://cdn.jsdelivr.net/npm/three@0.160.0/+esm').then(m=>(THREE=m));
const loc=(x,y)=>{const ll=A.map.unproject([x,y],20),r=A.toRD(ll.lat,ll.lng);return [r[0]-C0[0],r[1]-C0[1]];};   // Weltpixel → Meter (Ost, Nord)
const sunDir=sun=>{const c=Math.cos(sun.alt);return [-Math.sin(sun.az)*c,Math.sin(sun.alt),Math.cos(sun.az)*c];};   // three: x = Ost, y = oben, z = Süd
const bounds=()=>{const c=A.PIN||A.map.getCenter(),dLat=V.R/111320,dLon=V.R/(111320*Math.cos(c.lat*A.SR));return L.latLngBounds([c.lat-dLat,c.lng-dLon],[c.lat+dLat,c.lng+dLon]);};

// ── Gelände (AHN dtm, 2-m-Raster) ──
async function loadTerrain(){
  const R=V.R,N=321,x0=C0[0]-R,x1=C0[0]+R,y0=C0[1]-R,y1=C0[1]+R;
  const [G,buf]=await Promise.all([A.geotiff(),fetch(`https://service.pdok.nl/rws/ahn/wcs/v1_0?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=dtm_05m&FORMAT=image/tiff&SUBSET=x(${x0},${x1})&SUBSET=y(${y0},${y1})&SCALESIZE=x(${N}),y(${N})`).then(r=>{if(!r.ok)throw new Error('AHN');return r.arrayBuffer();})]);
  const im=await (await G.fromArrayBuffer(buf)).getImage(),Z=(await im.readRasters())[0],w=im.getWidth(),h=im.getHeight(),n=w*h;
  const z=new Float32Array(n),gap=new Uint8Array(n),vals=[];
  for(let i=0;i<n;i++){const v=Z[i];if(v>-50&&v<400){z[i]=v;if(i%5===0)vals.push(v);}else gap[i]=1;}
  vals.sort((a,b)=>a-b);const zref=vals.length?vals[vals.length>>1]:0,lo=vals.length?vals[0]:0;
  // Lücken (Gebäude, Wasser) aus der Umgebung füllen; Wasserflächen später eigene Oberfläche
  let todo=[];for(let i=0;i<n;i++)if(gap[i])todo.push(i);
  for(let pass=0;pass<80&&todo.length;pass++){const next=[],up=[];for(const i of todo){let s=0,c=0;const x=i%w;for(const d of [-1,1,-w,w]){const k=i+d;if(k<0||k>=n||gap[k]||Math.abs((k%w)-x)>1)continue;s+=z[k];c++;}if(c)up.push([i,s/c]);else next.push(i);}for(const [i,v] of up){z[i]=v;gap[i]=0;}todo=next;}
  for(const i of todo)z[i]=lo;
  TER={z,w,h,res:2*R/(w-1),zref,lo,raw:Z};
  return TER;
}
const hAt=(x,zz)=>{if(!TER)return 0;const {w,h,res,z}=TER,c=Math.max(0,Math.min(w-1.001,(x+V.R)/res)),r=Math.max(0,Math.min(h-1.001,(zz+V.R)/res)),i=Math.floor(c),j=Math.floor(r),fx=c-i,fy=r-j,k=j*w+i;
  return z[k]*(1-fx)*(1-fy)+z[k+1]*fx*(1-fy)+z[k+w]*(1-fx)*fy+z[k+w+1]*fx*fy;};   // NAP-Höhe an (Ost, Süd)
const yOf=nap=>(nap-(TER?TER.zref:0))*V.exag;
function terrainGeo(){
  const g=new THREE.PlaneGeometry(2*V.R,2*V.R,TER.w-1,TER.h-1);g.rotateX(-Math.PI/2);const p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,yOf(TER.z[i]));p.needsUpdate=true;g.computeVertexNormals();return g;
}

// ── Gebäude ──
function pushTri(P,N,Cc,a,b,c,n,col){
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],gx=uy*vz-uz*vy,gy=uz*vx-ux*vz,gz=ux*vy-uy*vx;
  if(gx*n[0]+gy*n[1]+gz*n[2]<0){const t=b;b=c;c=t;}
  for(const p of [a,b,c]){P.push(p[0],p[1],p[2]);N.push(n[0],n[1],n[2]);Cc.push(col[0],col[1],col[2]);}
}
function bldGeo(list,colorOf){
  const P=[],N=[],Cc=[];
  for(const b of list){
    let R=[];for(let i=0;i<b.z.length-2;i+=2)R.push(loc(b.z[i],b.z[i+1]));if(R.length<3)continue;
    let ar=0;for(let i=0;i<R.length;i++){const p=R[i],q=R[(i+1)%R.length];ar+=p[0]*q[1]-q[0]*p[1];}if(ar<0)R.reverse();
    let cx=0,cy=0;R.forEach(p=>{cx+=p[0];cy+=p[1];});cx/=R.length;cy/=R.length;
    const g0=yOf(b.g!=null?b.g:hAt(cx,-cy))-.4,h=Math.max(1.5,b.h||3)+.4,col=colorOf(b);   // Sockel 40 cm ins Gelände, damit nichts schwebt
    for(let i=0;i<R.length;i++){const p=R[i],q=R[(i+1)%R.length],dx=q[0]-p[0],dy=q[1]-p[1],Ln=Math.hypot(dx,dy);if(Ln<1e-3)continue;
      const n=[dy/Ln,0,dx/Ln],p0=[p[0],g0,-p[1]],q0=[q[0],g0,-q[1]],q1=[q[0],g0+h,-q[1]],p1=[p[0],g0+h,-p[1]];
      pushTri(P,N,Cc,p0,q0,q1,n,col);pushTri(P,N,Cc,p0,q1,p1,n,col);}
    const tri=THREE.ShapeUtils.triangulateShape(R.map(p=>new THREE.Vector2(p[0],p[1])),[]),rc=col.map(v=>Math.min(1,v*1.05));
    for(const t of tri)pushTri(P,N,Cc,[R[t[0]][0],g0+h,-R[t[0]][1]],[R[t[1]][0],g0+h,-R[t[1]][1]],[R[t[2]][0],g0+h,-R[t[2]][1]],[0,1,0],rc);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setAttribute('color',new THREE.Float32BufferAttribute(Cc,3));
  return g;
}
const hex2=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const BUCKET=y=>y==null||y<1200?null:y<1600?1500:y<1900?Math.floor(y/50)*50:Math.floor(y/10)*10;

// ── Wasser: bewegte Oberfläche (Normalen-Rauschen, verschoben) ──
function rippleTex(){
  const S=256,cv=document.createElement('canvas');cv.width=cv.height=S;const g=cv.getContext('2d');if(!g||typeof g.createImageData!=='function')return null;
  const id=g.createImageData(S,S),hgt=new Float32Array(S*S);
  for(let o=0;o<5;o++){const f=2<<o,amp=1/(o+1);for(let j=0;j<S;j++)for(let i=0;i<S;i++)hgt[j*S+i]+=amp*Math.sin((i/S)*f*2*Math.PI+o*1.7+Math.sin((j/S)*f*Math.PI*2+o)*1.3)*Math.cos((j/S)*f*2*Math.PI+o*.9);}
  for(let j=0;j<S;j++)for(let i=0;i<S;i++){const dx=hgt[j*S+(i+1)%S]-hgt[j*S+(i+S-1)%S],dy=hgt[((j+1)%S)*S+i]-hgt[((j+S-1)%S)*S+i],nx=-dx*.6,ny=-dy*.6,nz=1,l=Math.hypot(nx,ny,nz),p=4*(j*S+i);
    id.data[p]=Math.round((nx/l*.5+.5)*255);id.data[p+1]=Math.round((ny/l*.5+.5)*255);id.data[p+2]=Math.round((nz/l*.5+.5)*255);id.data[p+3]=255;}
  g.putImageData(id,0,0);const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(18,18);return t;
}
const waterMat=(op)=>new THREE.MeshStandardMaterial({color:0x3f7fa8,roughness:.22,metalness:.05,transparent:true,opacity:op==null?.88:op,normalMap:waterTex,normalScale:new THREE.Vector2(.18,.18),depthWrite:false});
function buildCanals(S){
  for(const m of canals){root.remove(m);m.geometry.dispose();}canals=[];
  const ws=S.filter(o=>o.c===3);if(!ws.length||!TER)return;const mat=waterMat(.92);
  for(const o of ws){const P=[];for(let i=0;i<o.z.length-2;i+=2)P.push(loc(o.z[i],o.z[i+1]));if(P.length<3)continue;
    if(!P.some(p=>Math.abs(p[0])<V.R&&Math.abs(p[1])<V.R))continue;
    let lo=Infinity;for(const p of P){const h=hAt(p[0],-p[1]);if(h<lo)lo=h;}const lvl=yOf(lo-.6);   // Wasserspiegel geschätzt: 60 cm unter dem tiefsten Ufer
    const sh=new THREE.Shape(P.map(p=>new THREE.Vector2(p[0],p[1])));const g=new THREE.ShapeGeometry(sh);g.rotateX(-Math.PI/2);g.translate(0,lvl,0);
    const m=new THREE.Mesh(g,mat);m.receiveShadow=true;m.renderOrder=2;root.add(m);canals.push(m);}
}

// ── Szenarien (Wasser): Höhenfeld der Wasseroberfläche auf dem Geländeraster ──
async function liwoDepth(k){   // amtliche Wassertiefe (LIWO, Rijkswaterstaat) als Rohwerte (WCS)
  const R=V.R,u=`https://basisinformatie-overstromingen.nl/geoserver/ows?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=LIWO_Basis__MaximaleWaterdiepteNederland_Kaart${k}&FORMAT=image/tiff&SUBSET=X(${Math.round(C0[0]-R)},${Math.round(C0[0]+R)})&SUBSET=Y(${Math.round(C0[1]-R)},${Math.round(C0[1]+R)})`;
  const [G,buf]=await Promise.all([A.geotiff(),fetch(u).then(r=>{if(!r.ok)throw new Error('LIWO');return r.arrayBuffer();})]);
  const im=await (await G.fromArrayBuffer(buf)).getImage(),Z=(await im.readRasters())[0],w=im.getWidth(),h=im.getHeight();
  const out=new Float32Array(TER.w*TER.h);
  for(let j=0;j<TER.h;j++)for(let i=0;i<TER.w;i++){const ii=Math.min(w-1,Math.floor(i/TER.w*w)),jj=Math.min(h-1,Math.floor(j/TER.h*h)),v=Z[jj*w+ii];out[j*TER.w+i]=v>0&&v<30?v:0;}
  return out;
}
function rainDepth(){   // Mulden (eigene Rechnung wie im Werkzeug Wasser), Gebäude als Wände
  const W=LAB.water;if(!W||!W.sinkDepth)return null;
  const n=TER.w*TER.h,wall=new Uint8Array(n),out=new Uint8Array(n),z=new Float32Array(TER.z);
  const cv=document.createElement('canvas');cv.width=TER.w;cv.height=TER.h;const g=cv.getContext('2d');
  if(g&&typeof g.getImageData==='function'){g.fillStyle='#fff';const k=1/TER.res;
    for(const b of V._blds||[]){g.beginPath();for(let i=0;i<b.z.length;i+=2){const p=loc(b.z[i],b.z[i+1]),x=(p[0]+V.R)*k,y=(V.R-p[1])*k;i?g.lineTo(x,y):g.moveTo(x,y);}g.closePath();g.fill();}
    const d=g.getImageData(0,0,TER.w,TER.h).data;for(let i=0;i<n;i++)wall[i]=d[4*i+3]>127?1:0;}
  for(let i=0;i<n;i++){const v=TER.raw[i];if(!(v>-50&&v<400)&&!wall[i]){out[i]=1;}}
  return W.sinkDepth(z,TER.w,TER.h,wall,out);
}
function setWater(depth,level){   // depth: Tiefe je Rasterpunkt (m) oder level: einheitlicher Wasserstand (NAP)
  if(waterMesh){root.remove(waterMesh);waterMesh.geometry.dispose();if(waterMesh.material.alphaMap)waterMesh.material.alphaMap.dispose();waterMesh.material.dispose();waterMesh=null;}
  if(!depth&&level==null)return;
  const g=new THREE.PlaneGeometry(2*V.R,2*V.R,TER.w-1,TER.h-1);g.rotateX(-Math.PI/2);
  const am=new Uint8Array(TER.w*TER.h*4),col=new Float32Array(TER.w*TER.h*3);
  g.userData={depth,level};
  const mat=waterMat(.9);mat.vertexColors=true;mat.alphaMap=new THREE.DataTexture(am,TER.w,TER.h);mat.alphaMap.flipY=false;mat.alphaMap.magFilter=mat.alphaMap.minFilter=THREE.LinearFilter;mat.alphaMap.needsUpdate=true;
  g.setAttribute('color',new THREE.BufferAttribute(col,3));
  waterMesh=new THREE.Mesh(g,mat);waterMesh.renderOrder=3;waterMesh.receiveShadow=true;root.add(waterMesh);
  waterMesh.userData={am,col};
  updateWater(0);
}
function updateWater(t){   // t = 0 … 1: Wasser steigt (je Mulde von unten bzw. Wasserstand linear)
  if(!waterMesh)return;const g=waterMesh.geometry,{depth,level}=g.userData,{am,col}=waterMesh.userData,p=g.attributes.position,n=p.count,te=ease(Math.max(0,Math.min(1,t)));
  let wet=0;
  for(let i=0;i<n;i++){const z0=TER.z[i];let d=0;
    d=level!=null?Math.max(0,(TER.lo+(level-TER.lo)*te)-z0):depth[i]*te;
    const show=d>(level!=null?.02:.1);if(show)wet++;
    p.setY(i,yOf(z0+(show?d:-.3))+.03);
    am[4*i]=am[4*i+1]=am[4*i+2]=show?Math.round(255*Math.min(1,.55+d/1.2)):0;am[4*i+3]=255;   // Ränder weich (lineare Filterung)
    const k=Math.min(1,d/2);col[3*i]=.55-.35*k;col[3*i+1]=.78-.38*k;col[3*i+2]=.92-.32*k;}
  p.needsUpdate=true;g.computeVertexNormals();waterMesh.material.alphaMap.needsUpdate=true;g.attributes.color.needsUpdate=true;
  V.water.wetShare=wet/n;dirty=true;
}
async function scenario(kind){
  const Wt=V.water;if(Wt.busy||!TER)return;
  if(Wt.kind===kind&&kind!=='level'){Wt.kind=null;setWater(null,null);panel();return;}
  Wt.busy=true;Wt.kind=kind;Wt.info=null;panel();
  try{
    if(kind==='rain'){const d=rainDepth();setWater(d,null);let a=0,v=0;for(const x of d)if(x>=.1){a++;v+=x;}Wt.info={a:a*TER.res*TER.res,v:v*TER.res*TER.res};}
    if(kind==='dike'){const d=await liwoDepth(Wt.k);setWater(d,null);let mx=0,a=0;for(const x of d){if(x>mx)mx=x;if(x>=.05)a++;}Wt.info={max:mx,a:a*TER.res*TER.res};}
    if(kind==='level'){if(Wt.level==null)Wt.level=Math.round((TER.zref+1)*10)/10;setWater(null,Wt.level);}
    Wt.t=0;Wt.t0=performance.now();
  }catch(e){Wt.kind=null;Wt.err=T('Wasserdaten gerade nicht erreichbar.','Water data currently unavailable.','Waterdata nu niet bereikbaar.');}
  Wt.busy=false;panel();
}
function waterTick(now){const Wt=V.water;if(!waterMesh||Wt.t>=1)return;Wt.t=REDUCED()?1:Math.min(1,(now-Wt.t0)/4200);updateWater(Wt.t);if(Wt.t>=1)panel();}

// ── Radfahrer:innen (Simulation auf dem OSM-Radnetz) ──
const OVP=['https://overpass-api.de/api/interpreter','https://z.overpass-api.de/api/interpreter','https://lz4.overpass-api.de/api/interpreter'];
async function overpass(q){for(const u of OVP){try{const r=await fetch(u,{method:'POST',body:new URLSearchParams({data:q})});if(r.ok)return await r.json();}catch(e){}}throw new Error('Overpass');}
// Wegenetz: amtlich aus dem Nationalen Wegebestand (NWB, Rijkswaterstaat/PDOK) mit Knoten-IDs; Rückfall OpenStreetMap
const BIKE_OK=new Set(['','RB','FP']);   // RB = Fahrbahn, FP = Radweg; ohne Fußwege (VP), Fußgängerzonen (VZ), Autobahnen
const WALK_OK=new Set(['','RB','FP','VP','VZ']);   // zu Fuß zusätzlich Fußwege und Fußgängerzonen
async function loadNwb(){
  const b=bounds(),P=(lon,lat)=>{const r=A.toRD(lat,lon);return [r[0]-C0[0],-(r[1]-C0[1])];};
  let url=`https://api.pdok.nl/rws/nationaal-wegenbestand-wegen/ogc/v1/collections/wegvakken/items?bbox=${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}&limit=1000&f=json`;
  const nodes=new Map(),edges=[];
  for(let k=0;k<8&&url;k++){const j=await fetch(url).then(r=>{if(!r.ok)throw new Error('NWB');return r.json();});
    for(const f of j.features||[]){const pr=f.properties||{},bst=pr.bst_code||'',g=f.geometry;if(!g||!WALK_OK.has(bst))continue;
      const lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
      for(const ln of lines){const pts=ln.map(c=>P(c[0],c[1]));if(pts.length<2)continue;const a=pr.jte_id_beg,b2=pr.jte_id_end;if(a==null||b2==null)continue;
        const e={a,b:b2,pts,cyc:bst==='FP',t:bst,len:0,cum:[0]};for(let i=1;i<pts.length;i++){e.len+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);e.cum.push(e.len);}
        if(e.len<1)continue;edges.push(e);for(const [id,p] of [[a,pts[0]],[b2,pts[pts.length-1]]]){if(!nodes.has(id))nodes.set(id,{p,e:[]});nodes.get(id).e.push(edges.length-1);}}}
    const nx=(j.links||[]).find(l=>l.rel==='next');url=nx?nx.href:null;}
  if(!edges.length)throw new Error('leer');
  NET={nodes,edges,src:'NWB'};return NET;
}
async function loadNet(){
  try{return await loadNwb();}catch(e){}
  const b=bounds(),q=`[out:json][timeout:25];way["highway"~"^(cycleway|residential|living_street|tertiary|secondary|unclassified|path|service)$"]["bicycle"!~"^(no|dismount)$"]["access"!~"^(no|private)$"](${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()});out geom;`;
  const j=await overpass(q),cnt=new Map();
  for(const w of j.elements||[])(w.nodes||[]).forEach((id,i)=>cnt.set(id,(cnt.get(id)||0)+(i===0||i===w.nodes.length-1?2:1)));
  const nodes=new Map(),edges=[];
  const P=(lat,lon)=>{const r=A.toRD(lat,lon);return [r[0]-C0[0],-(r[1]-C0[1])];};   // (Ost, Süd)
  for(const w of j.elements||[]){if(!w.geometry||!w.nodes)continue;const cyc=w.tags&&(w.tags.highway==='cycleway'||w.tags.bicycle==='designated');let cur=[],a=w.nodes[0];
    w.nodes.forEach((id,i)=>{const g=w.geometry[i];if(!g)return;cur.push(P(g.lat,g.lon));if(!nodes.has(id))nodes.set(id,{p:P(g.lat,g.lon),e:[]});
      if(i>0&&(cnt.get(id)>1||i===w.nodes.length-1)){if(cur.length>1){const e={a,b:id,pts:cur,cyc,len:0,cum:[0]};for(let k=1;k<cur.length;k++){e.len+=Math.hypot(cur[k][0]-cur[k-1][0],cur[k][1]-cur[k-1][1]);e.cum.push(e.len);}
        if(e.len>1){edges.push(e);nodes.get(a).e.push(edges.length-1);nodes.get(id).e.push(edges.length-1);}}cur=[P(g.lat,g.lon)];a=id;}});}
  NET={nodes,edges,src:'OSM'};return NET;
}
const posOn=(e,s)=>{let k=1;while(k<e.cum.length-1&&e.cum[k]<s)k++;const t=(s-e.cum[k-1])/Math.max(1e-6,e.cum[k]-e.cum[k-1]),p=e.pts[k-1],q=e.pts[k];return [p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,Math.atan2(q[0]-p[0],q[1]-p[1])];};
function nextEdge(ag,node,turn){   // an Kreuzungen: Radwege bevorzugt, kein Wenden außer in Sackgassen; turn (Spieler): −1 links, 0 geradeaus, 1 rechts
  const N=NET.nodes.get(node),all=N.e.filter(i=>i!==ag.e),bk=all.filter(i=>BIKE_OK.has(NET.edges[i].t||'')),opts=ag.kind==='walk'||!bk.length?all:bk;if(!opts.length)return {e:ag.e,dir:-ag.dir};
  const seek=ag.kind==='walk'&&V.walk.seek&&A.sunNow().alt>.05;
  const head=ag.h;let best=null,bs=-Infinity;
  for(const i of opts){const e=NET.edges[i],dir=e.a===node?1:-1,p=posOn(e,dir>0?Math.min(e.len,3):Math.max(0,e.len-3)),q=NET.nodes.get(node).p,ang=Math.atan2(p[0]-q[0],p[1]-q[1]);
    let da=ang-head;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;
    let sc=turn==null?(ag.kind==='walk'?(e.t==='VP'||e.t==='VZ'?1.6:1):(e.cyc?2:1))*Math.random()+Math.cos(da)*.4:-Math.abs(da+turn*Math.PI/2);   // rechts abbiegen = negativer Winkel
    if(seek&&shadedAt(posOn(e,dir>0?Math.min(e.len,8):Math.max(0,e.len-8))))sc+=1.4;   // Schattensucher: schattige Wege bevorzugt
    if(sc>bs){bs=sc;best={e:i,dir};}}
  return best;
}
function stepAgent(ag,dt,turn){
  const e=NET.edges[ag.e];ag.s+=ag.v*dt*ag.dir;
  if(ag.s>e.len||ag.s<0){const node=ag.dir>0?e.b:e.a,nx=nextEdge(ag,node,turn);ag.e=nx.e;ag.dir=nx.dir;ag.s=nx.dir>0?0:NET.edges[nx.e].len;}
  const p=posOn(NET.edges[ag.e],ag.s),h=ag.dir>0?p[2]:p[2]+Math.PI;let dh=h-ag.h;while(dh>Math.PI)dh-=2*Math.PI;while(dh<-Math.PI)dh+=2*Math.PI;ag.h+=dh*Math.min(1,dt*8);   // weich einlenken
  const off=ag.kind==='walk'?((NET.edges[ag.e].t||'RB')==='RB'?3.2:.7)*ag.side:.9*ag.side;ag.x=p[0]-Math.cos(ag.h)*off;ag.z=p[1]+Math.sin(ag.h)*off;   // rechts (Rad) bzw. auf dem Gehweg
}
function merge(list){   // nicht-indizierte Geometrien zusammenführen (Position + Normale)
  const gs=list.map(g=>g.index?g.toNonIndexed():g),n=gs.reduce((s,g)=>s+g.attributes.position.count,0),P=new Float32Array(3*n),N=new Float32Array(3*n);let o=0;
  for(const g of gs){P.set(g.attributes.position.array,3*o);N.set(g.attributes.normal.array,3*o);o+=g.attributes.position.count;}
  const m=new THREE.BufferGeometry();m.setAttribute('position',new THREE.BufferAttribute(P,3));m.setAttribute('normal',new THREE.BufferAttribute(N,3));return m;
}
function bikeGeo(){   // Low-Poly-Radfahrer:in: Räder, Rahmen, Lenker — Oberkörper leicht vorgebeugt, Kopf
  const wheel=z=>{const g=new THREE.TorusGeometry(.34,.04,6,14);g.rotateY(Math.PI/2);g.translate(0,.36,z);return g;};
  const tube=(len,r,rx,y,z)=>{const g=new THREE.CylinderGeometry(r,r,len,5);g.rotateX(rx);g.translate(0,y,z);return g;};
  const bike=merge([wheel(.55),wheel(-.55),tube(1.05,.03,Math.PI/2,.62,0),tube(.62,.03,.35,.62,-.3),tube(.5,.03,-.3,.7,.45),(()=>{const g=new THREE.CylinderGeometry(.025,.025,.55,5);g.rotateZ(Math.PI/2);g.translate(0,.96,.5);return g;})()]);
  const torso=new THREE.CapsuleGeometry(.2,.48,3,8);torso.rotateX(.42);torso.translate(0,1.28,.1);
  const head=new THREE.SphereGeometry(.15,10,8);head.translate(0,1.78,.32);
  const leg=x=>{const g=new THREE.CylinderGeometry(.075,.07,.72,6);g.rotateX(-.25);g.translate(x,.72,.02);return g;};
  const body=merge([torso,head,leg(.11),leg(-.11)]);
  return {body,bike};
}
async function startBikes(){
  const B=V.bikes;if(B.busy)return;B.busy=true;B.err=null;panel();
  try{if(!NET)await loadNet();
    const n=Math.min(140,Math.max(20,Math.round(NET.edges.length*.35)));AG=[];
    const be=NET.edges.map((e,i)=>i).filter(i=>BIKE_OK.has(NET.edges[i].t||''));
    for(let i=0;i<n;i++){const e=be[Math.floor(Math.random()*be.length)];AG.push({e,dir:Math.random()<.5?1:-1,s:Math.random()*NET.edges[e].len,v:3.6+Math.random()*2.4,h:0,x:0,z:0,side:1,wob:Math.random()*6});}
    if(!bikeMeshes){const g=bikeGeo(),cols=[0xe3b500,0xd0583c,0x2f6fa8,0x3f7f6a,0x7a4ea8,0xf3efe7,0x17151c];
      const mb=new THREE.InstancedMesh(g.body,new THREE.MeshStandardMaterial({roughness:.7}),160),mk=new THREE.InstancedMesh(g.bike,new THREE.MeshStandardMaterial({color:0x2a2830,roughness:.6}),160);
      const c=new THREE.Color();for(let i=0;i<160;i++){c.setHex(cols[i%cols.length]);mb.setColorAt(i,c);}mb.castShadow=mk.castShadow=true;mb.frustumCulled=mk.frustumCulled=false;root.add(mb,mk);bikeMeshes={mb,mk};}
    B.on=true;B.n=AG.length;
  }catch(e){B.err=T('Wegenetz gerade nicht erreichbar.','Road network currently unreachable.','Wegennet nu niet bereikbaar.');}
  B.busy=false;panel();
}
const O3=()=>new THREE.Object3D();let _o=null;
function bikeTick(dt,now){
  const B=V.bikes;if(!B.on||!bikeMeshes||!NET)return;_o=_o||O3();const {mb,mk}=bikeMeshes;
  AG.forEach((ag,i)=>{stepAgent(ag,dt,null);const y=yOf(hAt(ag.x,ag.z));_o.position.set(ag.x,y,ag.z);_o.rotation.set(Math.sin(now/300+ag.wob)*.04,ag.h,0);_o.updateMatrix();mk.setMatrixAt(i,_o.matrix);mb.setMatrixAt(i,_o.matrix);});
  let k=AG.length;if(PLAYER){rideTick(dt,now);const y=yOf(hAt(PLAYER.x,PLAYER.z));_o.position.set(PLAYER.x,y,PLAYER.z);_o.rotation.set(0,PLAYER.h,0);_o.scale.set(1.15,1.15,1.15);_o.updateMatrix();mk.setMatrixAt(k,_o.matrix);mb.setMatrixAt(k,_o.matrix);mb.setColorAt(k,new THREE.Color(0xFFD600));_o.scale.set(1,1,1);k++;}
  mb.count=mk.count=k;mb.instanceMatrix.needsUpdate=mk.instanceMatrix.needsUpdate=true;if(mb.instanceColor)mb.instanceColor.needsUpdate=true;
  const f=B.follow>=0?AG[B.follow]:PLAYER;
  if(f){const y=yOf(hAt(f.x,f.z)),bx=f.x-Math.sin(f.h)*7.5,bz=f.z-Math.cos(f.h)*7.5,t=Math.min(1,dt*3);
    cam.position.lerp(new THREE.Vector3(bx,y+3.2,bz),t);cam.lookAt(f.x+Math.sin(f.h)*6,y+1.4,f.z+Math.cos(f.h)*6);cam.fov=60;cam.updateProjectionMatrix();}
  dirty=true;
}
// Selbst fahren: Pfeile/WASD — links/rechts an der nächsten Kreuzung, hoch/runter Tempo
const KEYS={turn:0,acc:0};
function rideStart(){
  if(!NET||!NET.edges.length)return;let best=0,bd=Infinity;NET.edges.forEach((e,i)=>{const p=e.pts[0],d=Math.hypot(p[0]-CAM.tx,p[1]-CAM.tz);if(d<bd){bd=d;best=i;}});
  PLAYER={e:best,dir:1,s:0,v:5,h:0,x:0,z:0,side:1,t:0,sh:0,last:0};V.bikes.follow=-1;V.bikes.ride=true;V.bikes.shade=null;panel();
}
function rideStop(){PLAYER=null;V.bikes.ride=false;placeCam();panel();}
const ray=()=>new THREE.Raycaster();let _ray=null;
function rideTick(dt,now){
  PLAYER.v=Math.max(1.5,Math.min(9,PLAYER.v+KEYS.acc*dt*2));stepAgent(PLAYER,dt,KEYS.turn||0);
  if(now-PLAYER.last>250){PLAYER.last=now;const sun=A.sunNow();if(sun.alt>.01){_ray=_ray||ray();const d=sunDir(sun),y=yOf(hAt(PLAYER.x,PLAYER.z))+1.3;_ray.set(new THREE.Vector3(PLAYER.x,y,PLAYER.z),new THREE.Vector3(d[0],d[1],d[2]).normalize());_ray.far=500;
    const hit=_ray.intersectObjects([...buckets.filter(m=>m.visible),crowns].filter(Boolean),false).length>0;PLAYER.t+=.25;if(hit)PLAYER.sh+=.25;V.bikes.shade=PLAYER.sh/PLAYER.t;const s=el&&el.querySelector('.v3-shade b');if(s)s.textContent=Math.round(100*V.bikes.shade)+' %';}}
  const sp=el&&el.querySelector('.v3-speed b');if(sp)sp.textContent=Math.round(PLAYER.v*3.6);
}

// ── Zu Fuß: Fußgänger:innen auf Geh- und Fußwegen; bei Sonne suchen sie Schatten ──
function shadedAt(p){const sun=A.sunNow();if(sun.alt<=.01)return true;_ray=_ray||ray();const d=sunDir(sun),y=yOf(hAt(p[0],p[1]))+1.5;
  _ray.set(new THREE.Vector3(p[0],y,p[1]),new THREE.Vector3(d[0],d[1],d[2]).normalize());_ray.far=400;
  return _ray.intersectObjects([...buckets.filter(m=>m.visible),crowns].filter(Boolean),false).length>0;}
function walkGeo(){const body=new THREE.CapsuleGeometry(.19,.62,3,8);body.translate(0,.95,0);const head=new THREE.SphereGeometry(.13,10,8);head.translate(0,1.6,0);
  const leg=x=>{const g=new THREE.CylinderGeometry(.065,.06,.7,6);g.translate(x,.35,0);return g;};return merge([body,head,leg(.09),leg(-.09)]);}
async function startWalk(){
  const W=V.walk;if(W.busy)return;W.busy=true;panel();
  try{if(!NET)await loadNet();const core=NET.edges.map((e,i)=>i).filter(i=>{const p=NET.edges[i].pts[0];return Math.abs(p[0])<V.R*.75&&Math.abs(p[1])<V.R*.75;});W.core=core.length?core:NET.edges.map((e,i)=>i);
    const n=Math.min(240,Math.max(40,Math.round(W.core.length*.8)));WK=[];
    for(let i=0;i<n;i++){const e=W.core[Math.floor(Math.random()*W.core.length)];WK.push({kind:'walk',e,dir:Math.random()<.5?1:-1,s:Math.random()*NET.edges[e].len,v:1.05+Math.random()*.55,h:0,x:0,z:0,side:Math.random()<.5?1:-1,wob:Math.random()*6});}
    if(!walkMeshes){const cols=[0x2f6fa8,0xd0583c,0x3f7f6a,0xe3b500,0x7a4ea8,0x8a6a3a,0xf3efe7,0x46424f];walkMeshes=new THREE.InstancedMesh(walkGeo(),new THREE.MeshStandardMaterial({roughness:.75}),240);
      const c=new THREE.Color();for(let i=0;i<240;i++){c.setHex(cols[(i*5)%cols.length]);walkMeshes.setColorAt(i,c);}walkMeshes.castShadow=true;walkMeshes.frustumCulled=false;root.add(walkMeshes);}
    W.on=true;W.n=WK.length;W.t=0;W.sh=0;W.last=0;
  }catch(e){V.bikes.err=T('Wegenetz gerade nicht erreichbar.','Road network currently unreachable.','Wegennet nu niet bereikbaar.');}
  W.busy=false;panel();
}
function walkTick(dt,now){
  const W=V.walk;if(!W.on||!walkMeshes||!NET)return;_o=_o||O3();
  WK.forEach((ag,i)=>{stepAgent(ag,dt,null);if(Math.abs(ag.x)>V.R*.95||Math.abs(ag.z)>V.R*.95){ag.e=W.core[Math.floor(Math.random()*W.core.length)];ag.s=Math.random()*NET.edges[ag.e].len;stepAgent(ag,0,null);}   
    const y=yOf(hAt(ag.x,ag.z))+Math.abs(Math.sin(now/180+ag.wob))*.08;_o.position.set(ag.x,y,ag.z);_o.rotation.set(0,ag.h,0);_o.scale.set(1.5,1.5,1.5);_o.updateMatrix();walkMeshes.setMatrixAt(i,_o.matrix);});_o.scale.set(1,1,1);
  walkMeshes.count=WK.length;walkMeshes.instanceMatrix.needsUpdate=true;
  if(now-W.last>500&&WK.length){W.last=now;let n=0,k=0;for(let j=0;j<12;j++){const ag=WK[Math.floor(Math.random()*WK.length)];k++;if(shadedAt([ag.x,ag.z]))n++;}   // Stichprobe
    W.t+=k;W.sh+=n;if(W.t>1200){W.t/=2;W.sh/=2;}W.shade=W.sh/W.t;const s2=el&&el.querySelector('.v3-wsh b');if(s2)s2.textContent=Math.round(100*W.shade)+' %';}
  dirty=true;
}
// ── Wind: Strömung zwischen den Gebäuden (Veranschaulichung nach einfachen Regeln, keine Strömungssimulation) ──
// Teilchen meist auf Straßenhöhe, ein Teil über den Dächern (dort ungebremst).
const WCS=3;   // Rastergröße in Metern
function windGrid(){
  const n=Math.ceil(2*V.R/WCS),H=new Float32Array(n*n);
  for(const b of V._blds||[]){const R=[];for(let i=0;i<b.z.length-2;i+=2){const q=loc(b.z[i],b.z[i+1]);R.push([q[0],-q[1]]);}if(R.length<3)continue;
    let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;R.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z0=Math.min(z0,p[1]);z1=Math.max(z1,p[1]);});
    const c0=Math.max(0,Math.floor((x0+V.R)/WCS)),c1=Math.min(n-1,Math.floor((x1+V.R)/WCS)),r0=Math.max(0,Math.floor((z0+V.R)/WCS)),r1=Math.min(n-1,Math.floor((z1+V.R)/WCS));
    for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){const x=-V.R+(c+.5)*WCS,z=-V.R+(r+.5)*WCS;let ins=false;for(let i=0,j=R.length-1;i<R.length;j=i++){const [xi,zi]=R[i],[xj,zj]=R[j];if(((zi>z)!==(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi)+xi))ins=!ins;}if(ins)H[r*n+c]=Math.max(H[r*n+c],b.h||8);}}
  return {n,H};
}
function windField(dirFrom){
  const G=WG,n=G.n,H=G.H,a=dirFrom*Math.PI/180,ux=-Math.sin(a),uz=Math.cos(a),F=new Float32Array(n*n);   // Strömungsrichtung (Ost, Süd)
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){const k=r*n+c;if(H[k]>0){F[k]=0;continue;}
    let f=1;for(let s2=1;s2<=24;s2++){const cc=Math.round(c-ux*s2),rr=Math.round(r-uz*s2);if(cc<0||rr<0||cc>=n||rr>=n)break;const h=H[rr*n+cc];if(h>0){const d=s2*WCS;if(d<4*h)f=.22+.78*(d/(4*h));break;}}   // Windschatten bis 4 × Gebäudehöhe
    let L=0,Rt=0;for(let s2=1;s2<=3;s2++){const lc=Math.round(c+uz*s2),lr=Math.round(r-ux*s2),rc=Math.round(c-uz*s2),rr=Math.round(r+ux*s2);if(lc>=0&&lr>=0&&lc<n&&lr<n&&H[lr*n+lc]>0)L=1;if(rc>=0&&rr>=0&&rc<n&&rr<n&&H[rr*n+rc]>0)Rt=1;}
    if(f>.85)f*=L&&Rt?1.45:L||Rt?1.15:1;   // Düse zwischen zwei Fassaden, Eckeffekt an einer
    F[k]=f;}
  G.F=F;G.ux=ux;G.uz=uz;
}
async function startWind(){
  const W=V.wind;if(W.busy)return;W.busy=true;W.err=null;panel();
  try{const c=A.PIN||A.map.getCenter();
    if(W.cur==null){const j=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat.toFixed(4)}&longitude=${c.lng.toFixed(4)}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`).then(r=>r.ok?r.json():null).catch(()=>null);
      const cu=j&&j.current;W.cur=cu?{sp:cu.wind_speed_10m,dir:cu.wind_direction_10m}:{sp:4,dir:240,fallback:true};}
    if(W.dir==null){W.dir=Math.round(W.cur.dir);W.sp=W.cur.sp;}
    if(!WG)WG=windGrid();windField(W.dir);
    if(!windObj){const N=1600,g=new THREE.BufferGeometry();   // Kometen-Spur: vorn breit, hinten spitz — zeigt die Richtung
      g.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,.5, .5,0,.5, 0,0,-.5],3));g.computeVertexNormals();
      const mesh=new THREE.InstancedMesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide,transparent:true,opacity:.92,fog:false}),N);mesh.frustumCulled=false;mesh.renderOrder=8;
      const c0=new THREE.Color(0x38b2d8);for(let i=0;i<N;i++)mesh.setColorAt(i,c0);root.add(mesh);
      windObj={mesh,N,p:Array.from({length:N},()=>({x:0,z:0,y:0,vx:0,vz:0,age:1e9,life:1}))};}
    windObj.mesh.visible=true;W.on=true;
  }catch(e){W.err=T('Winddaten gerade nicht erreichbar.','Wind data currently unavailable.','Winddata nu niet bereikbaar.');}
  W.busy=false;panel();
}
function windTick(dt){
  const W=V.wind;if(!W.on||!windObj||!WG||!WG.F||V.mode!=='wind')return;const G=WG,n=G.n,R=V.R,M=windObj.mesh;_o=_o||O3();const col=new THREE.Color();
  const cell=(x,z)=>{const c=Math.floor((x+R)/WCS),r=Math.floor((z+R)/WCS);return c<0||r<0||c>=n||r>=n?-1:r*n+c;};
  const spawn=p=>{let k=0;do{p.x=(Math.random()*2-1)*R;p.z=(Math.random()*2-1)*R;k++;}while(k<8&&G.H[cell(p.x,p.z)]>0);p.y=2+Math.pow(Math.random(),1.6)*28;p.vx=G.ux;p.vz=G.uz;p.age=0;p.life=3+Math.random()*5;};
  const sp=Math.max(1,W.sp||4)*3;   // dreifach schneller dargestellt
  windObj.p.forEach((p,i)=>{
    if(p.age>p.life)spawn(p);p.age+=dt;
    let vx=p.vx+(G.ux-p.vx)*Math.min(1,dt*1.5),vz=p.vz+(G.uz-p.vz)*Math.min(1,dt*1.5);const m=Math.hypot(vx,vz)||1;vx/=m;vz/=m;
    let k=cell(p.x+vx*4,p.z+vz*4);
    if(k>=0&&G.H[k]>0&&p.y<G.H[k]+2){let ok=false;for(const da of [.45,-.45,.9,-.9,1.35,-1.35]){const ca=Math.cos(da),sa=Math.sin(da),tx=vx*ca-vz*sa,tz=vx*sa+vz*ca,k2=cell(p.x+tx*4,p.z+tz*4);if(k2>=0&&!(G.H[k2]>0)){vx=tx;vz=tz;ok=true;break;}}if(!ok){p.age=1e9;}}
    const k0=cell(p.x,p.z);if(k0>=0&&G.H[k0]>0&&p.y<G.H[k0])p.age=1e9;const f=p.y>22?1:k0>=0?(G.F[k0]||0):1;p.vx=vx;p.vz=vz;const ox=p.x,oz=p.z;p.x+=vx*sp*Math.max(.15,f)*dt;p.z+=vz*sp*Math.max(.15,f)*dt;
    if(Math.abs(p.x)>R||Math.abs(p.z)>R)p.age=1e9;
    const gy=yOf(hAt(p.x,p.z))+p.y,len=5+8*Math.min(1.5,f),fade=Math.min(1,p.age*2,Math.max(0,(p.life-p.age)*2));
    _o.position.set(p.x,gy,p.z);_o.rotation.set(0,Math.atan2(vx,vz),0);_o.scale.set(2.2*fade+.1,1,len);_o.updateMatrix();M.setMatrixAt(i,_o.matrix);
    col.setHex(f<.6?0x2b6cb0:f>1.2?0xe8603c:f>1.05?0xf2c230:0x38b2d8);M.setColorAt(i,col);});
  M.instanceMatrix.needsUpdate=true;if(M.instanceColor)M.instanceColor.needsUpdate=true;dirty=true;
}
// ── Zeitreise: Baujahre bis heute, dann Geplantes (BAG: im Bau, genehmigt, Abriss genehmigt; Kanalerneuerung der Gemeente) ──
const RIO3='https://services-eu1.arcgis.com/SMnoOtmU2UWf0vRp/arcgis/rest/services/Rioolvervanging2024_20240411/FeatureServer/0/query';
const YNOW=new Date().getFullYear(),YMAX=YNOW+9;
async function futureLoad(){
  const F=V.fut;if(F.loaded||F.busy)return;F.busy=true;F.err=null;panel();
  const b=bounds(),bb=[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()].map(v=>v.toFixed(5)).join(',');
  const ST=[['Bouw gestart','built'],['Bouwvergunning verleend','permit'],['Sloopvergunning verleend','demo']];
  const bag=await Promise.all(ST.map(([st])=>fetch(`https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?bbox=${bb}&status=${encodeURIComponent(st)}&limit=1000&f=json`).then(r=>r.ok?r.json():null).catch(()=>null)));
  const rio=await fetch(`${RIO3}?geometry=${bb}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=Planjaar,Projectnaa&returnGeometry=true&outSR=4326&f=json`).then(r=>r.ok?r.json():null).catch(()=>null);
  const items=[];
  bag.forEach((j,si)=>{for(const f of (j&&j.features)||[]){const g=f.geometry;if(!g||g.type!=='Polygon')continue;const ring=g.coordinates[0],z=[];for(const [lo,la] of ring){const w=A.w20(la,lo);z.push(w[0],w[1]);}
    const R=[];for(let i=0;i<z.length-2;i+=2)R.push(loc(z[i],z[i+1]));let ar=0;for(let i=0;i<R.length;i++){const p=R[i],q=R[(i+1)%R.length];ar+=p[0]*q[1]-q[0]*p[1];}ar=Math.abs(ar/2);
    if(ar<12)continue;const u=f.properties.aantal_verblijfsobjecten||0,fl=u>0?Math.max(1,Math.min(16,Math.round(u*80/ar))):2;
    const c=R.reduce((s2,p)=>[s2[0]+p[0]/R.length,s2[1]+p[1]/R.length],[0,0]);if(Math.abs(c[0])>V.R||Math.abs(c[1])>V.R)continue;
    items.push({z,h:fl*3.1+1.2,fl,u,k:ST[si][1],doc:(f.properties.documentdatum||'').slice(0,4),c});}});
  const sew=[];for(const f of (rio&&rio.features)||[]){const y=+f.attributes.Planjaar;if(!(y>=YNOW-1&&y<=YMAX))continue;for(const path of (f.geometry&&(f.geometry.paths||f.geometry.rings))||[]){const pts=path.map(([lo,la])=>{const r=A.toRD(la,lo);return [r[0]-C0[0],-(r[1]-C0[1])];});if(pts.length>1)sew.push({y,pts,name:String(f.attributes.Projectnaa||'').trim()});}}
  futObj=new THREE.Group();root.add(futObj);
  const mat=(col,op)=>new THREE.MeshStandardMaterial({vertexColors:true,transparent:op<1,opacity:op,roughness:.8,depthWrite:op>=1});
  const grp={};for(const k of ['built','permit','demo']){const L=items.filter(x=>x.k===k);if(!L.length)continue;
    const col={built:'#f2b84a',permit:'#6fa3e6',demo:'#e0644a'}[k],m=new THREE.Mesh(bldGeo(L,()=>hex2(col)),mat(col,k==='demo'?.45:.72));
    m.castShadow=k!=='demo';m.userData.k=k;futObj.add(m);const e=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry,30),new THREE.LineBasicMaterial({color:k==='demo'?0xa3283a:0x17151c,transparent:true,opacity:.55}));e.userData.k=k;futObj.add(e);grp[k]=L.length;}
  const sm=new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.85,depthWrite:false});
  for(const sw of sew){const P2=[],gy=p=>yOf(hAt(p[0],p[1]))+.35;for(let i=0;i<sw.pts.length-1;i++){const a=sw.pts[i],b2=sw.pts[i+1],dx=b2[0]-a[0],dz=b2[1]-a[1],Ln=Math.hypot(dx,dz)||1,nx=-dz/Ln*1.6,nz=dx/Ln*1.6;
      P2.push(a[0]+nx,gy(a),a[1]+nz,b2[0]+nx,gy(b2),b2[1]+nz,b2[0]-nx,gy(b2),b2[1]-nz,a[0]+nx,gy(a),a[1]+nz,b2[0]-nx,gy(b2),b2[1]-nz,a[0]-nx,gy(a),a[1]-nz);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P2,3));const m=new THREE.Mesh(g,sm);m.userData={k:'sewer',y:sw.y};m.renderOrder=6;futObj.add(m);}
  let km=0;for(const sw of sew)for(let i=1;i<sw.pts.length;i++)km+=Math.hypot(sw.pts[i][0]-sw.pts[i-1][0],sw.pts[i][1]-sw.pts[i-1][1])/1000;
  F.info={built:grp.built||0,permit:grp.permit||0,demo:grp.demo||0,km,ok:!!(bag.some(Boolean)||rio)};F.loaded=true;F.busy=false;
  if(!F.info.ok)F.err=T('Planungsdaten gerade nicht erreichbar.','Planning data currently unavailable.','Plandata nu niet bereikbaar.');
  setYear(F.yr||YNOW);panel();
}
function setYear(yr){
  const F=V.fut;F.yr=yr;let n=0;for(const m of buckets){const show=m.userData.y==null||m.userData.y<=yr;m.visible=show;if(show)n+=m.userData.n;}
  if(futObj)futObj.children.forEach(o=>{const k=o.userData.k;o.visible=k==='built'?yr>=YNOW:k==='permit'?yr>=YNOW+1:k==='demo'?yr>=YNOW+1:k==='sewer'?yr>=o.userData.y:false;});
  const lbl=el&&el.querySelector('.v3-year');if(lbl){lbl.classList.add('on');lbl.innerHTML=`<b>${yr}</b><span>${yr>YNOW?T('geplant laut BAG und Gemeente','planned per BAG and municipality','gepland volgens BAG en gemeente'):`${A.fmt(n)} ${T('Gebäude stehen','buildings standing','gebouwen staan')}`}</span>`;}
  dirty=true;
}
function futTick(now){const F=V.fut;if(!F.play)return;if(!F.t0){F.t0=now;F.y0=F.yr||1600;}const y0=Math.min(F.y0,YNOW-1),t=Math.min(1,(now-F.t0)/16000),yr=Math.round(y0+(YMAX-y0)*ease(t));
  if(yr!==F.yr){setYear(yr);const sl=el&&el.querySelector('#v3Y');if(sl)sl.value=yr;}if(t>=1){F.play=false;F.t0=0;panel();}}

// ── Licht, Himmel, Sonnenbahn ──
function skyCol(alt){const d=alt*180/Math.PI;return d<-4?new THREE.Color(0x1d1b2b):d<6?new THREE.Color(0xe9c7a8):d<18?new THREE.Color(0xdfe2e4):new THREE.Color(0xd6e4ef);}
// Himmel als Verlauf (oben tiefer, am Horizont heller — wärmer bei tiefer Sonne)
function skyGrad(alt){const d=alt*180/Math.PI;
  return d<-6?{top:[14,18,36],hor:[40,38,62]}:d<3?{top:[70,82,128],hor:[238,178,136]}:d<12?{top:[96,134,190],hor:[240,210,178]}:{top:[78,138,206],hor:[212,228,241]};}
function setSky(alt){
  const {top,hor}=skyGrad(alt);if(!skyCv){skyCv=document.createElement('canvas');skyCv.width=2;skyCv.height=256;}
  const g=skyCv.getContext('2d');
  if(g&&typeof g.createLinearGradient==='function'){const gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,`rgb(${top})`);gr.addColorStop(.58,`rgb(${hor})`);gr.addColorStop(1,`rgb(${hor})`);g.fillStyle=gr;g.fillRect(0,0,2,256);
    if(!skyTx){skyTx=new THREE.CanvasTexture(skyCv);skyTx.colorSpace=THREE.SRGBColorSpace;}skyTx.needsUpdate=true;scene.background=skyTx;}
  else scene.background=skyCol(alt);
  scene.fog.color.setRGB(hor[0]/255,hor[1]/255,hor[2]/255,THREE.SRGBColorSpace);
}
// Text als Bildschirm-Etikett (bleibt gleich groß, immer lesbar)
function tag(txt,o={}){
  const size=o.size||30,pad=o.pad||12,c=document.createElement('canvas'),g=c.getContext('2d');if(!g||typeof g.measureText!=='function')return new THREE.Object3D();
  const font=`${o.w||700} ${size}px "DM Sans",system-ui,sans-serif`;g.font=font;const w=Math.ceil(g.measureText(txt).width)+2*pad,h=Math.round(size*1.5);c.width=w;c.height=h;
  g.font=font;g.fillStyle=o.bg||'rgba(23,21,28,.88)';g.beginPath();if(g.roundRect)g.roundRect(0,0,w,h,h/2);else g.rect(0,0,w,h);g.fill();
  g.fillStyle=o.fg||'#f3efe7';g.textBaseline='middle';g.fillText(txt,pad,h/2+1);
  const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;tx.minFilter=THREE.LinearFilter;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,depthTest:false,depthWrite:false,transparent:true,sizeAttenuation:false,fog:false}));
  const k=o.k||.034;sp.scale.set(k*w/h,k,1);sp.renderOrder=30;sp.userData.tag=true;return sp;
}
// Kompassring am Boden: Grad-Striche, Himmelsrichtungen, Sonnen- und Schattenrichtung
function ringTex(){
  const N=1024,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');if(!g||typeof g.arc!=='function')return null;
  const o=N/2,r=N*.44,L=A.lang(),D=L==='en'?['N','E','S','W']:L==='nl'?['N','O','Z','W']:['N','O','S','W'];
  g.strokeStyle='rgba(255,255,255,.92)';g.lineWidth=5;g.beginPath();g.arc(o,o,r,0,2*Math.PI);g.stroke();
  g.strokeStyle='rgba(23,21,28,.35)';g.lineWidth=12;g.beginPath();g.arc(o,o,r+9,0,2*Math.PI);g.stroke();
  for(let d=0;d<360;d+=5){const a=d*Math.PI/180,l=d%30===0?34:d%10===0?20:11;g.strokeStyle=d%90===0?'#FFD600':'rgba(255,255,255,.9)';g.lineWidth=d%30===0?5:3;
    g.beginPath();g.moveTo(o+Math.sin(a)*r,o-Math.cos(a)*r);g.lineTo(o+Math.sin(a)*(r-l),o-Math.cos(a)*(r-l));g.stroke();}
  const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;tx.anisotropy=8;return tx;
}
function buildDial(){
  if(dial){scene.remove(dial);dial.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();}});}
  dial=new THREE.Group();dial.userData={};scene.add(dial);const Rr=V.R*.42,gy=yOf(hAt(0,0))+.6;
  const tx=ringTex();if(tx){const ring=new THREE.Mesh(new THREE.PlaneGeometry(2*Rr/.88,2*Rr/.88),new THREE.MeshBasicMaterial({map:tx,transparent:true,depthTest:false,depthWrite:false,fog:false}));ring.rotation.x=-Math.PI/2;ring.position.y=gy;ring.renderOrder=12;dial.add(ring);}
  const L=A.lang(),DIR=L==='en'?['N','E','S','W']:L==='nl'?['N','O','Z','W']:['N','O','S','W'];
  for(let dg=0;dg<360;dg+=30){const a2=dg*Math.PI/180,rr=Rr*.86,card=dg%90===0,t=tag(card?DIR[dg/90]:dg+'°',card?{size:34,k:.034,bg:'#FFD600',fg:'#17151c',pad:12}:{size:22,k:.024,bg:'rgba(23,21,28,.72)',fg:'#fff',pad:8});
    t.position.set(Math.sin(a2)*rr,gy+1.5,-Math.cos(a2)*rr);dial.add(t);}
  const c=A.PIN||A.map.getCenter(),day=A.dayDate();day.setHours(0,0,0,0);const pts=[],R=V.R*.95,at=m=>A.sunPos(new Date(day.valueOf()+m*6e4),c.lat,c.lng);
  for(let m=0;m<=1440;m+=6){const s2=at(m);if(s2.alt<-.01)continue;const q=sunDir(s2);pts.push(new THREE.Vector3(q[0]*R,q[1]*R,q[2]*R));}
  if(pts.length>1){const tube=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),Math.min(400,pts.length*2),1.1,6,false),new THREE.MeshBasicMaterial({color:0xffc54d,transparent:true,opacity:.9,depthTest:false,fog:false}));tube.renderOrder=14;dial.add(tube);}
  const [a,b]=A.dayRange();
  if(a!=null){for(let hh=Math.ceil(a/60);hh*60<=b;hh++){const s2=at(hh*60);if(s2.alt<.02)continue;const q=sunDir(s2),t=tag(String(hh),{size:24,k:.026,bg:'rgba(250,248,243,.9)',fg:'#17151c',pad:9});t.position.set(q[0]*R,q[1]*R,q[2]*R);dial.add(t);}
    for(const [m,lbl] of [[a,A.hhmm(a)],[b,A.hhmm(b)]]){const q=sunDir({...at(m),alt:.004}),t=tag(lbl,{size:28,k:.032,bg:'#FFD600',fg:'#17151c'});t.position.set(q[0]*R,2,q[2]*R);dial.add(t);}}
  const rg=new THREE.CylinderGeometry(.7,.7,1,8,1,true);rg.translate(0,.5,0);rg.rotateX(Math.PI/2);   // Länge entlang +z, Fuß im Ursprung
  dial.userData.ray=new THREE.Mesh(rg,new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.85,depthTest:false,fog:false}));dial.userData.ray.renderOrder=15;dial.userData.ray.position.set(0,gy,0);dial.add(dial.userData.ray);
  const mk=(col)=>{const m=new THREE.Mesh(new THREE.CircleGeometry(4.2,24),new THREE.MeshBasicMaterial({color:col,depthTest:false,transparent:true,fog:false}));m.rotation.x=-Math.PI/2;m.renderOrder=16;dial.add(m);return m;};
  dial.userData.sunDot=mk(0xffd24a);dial.userData.shDot=mk(0x17151c);dial.userData.Rr=Rr;dial.userData.gy=gy;dial.visible=V.mode==='licht';dialDay=A.dayDate().toDateString()+'|'+A.lang();
}
function updateDial(sun){
  if(!dial)return;const U=dial.userData,d=sunDir(sun),R=V.R*.95,up=sun.alt>0;
  const tip=new THREE.Vector3(d[0]*R,Math.max(.02,d[1])*R,d[2]*R);U.ray.lookAt(tip);U.ray.scale.set(1,1,tip.distanceTo(U.ray.position));U.ray.visible=up;
  const h=Math.hypot(d[0],d[2])||1;U.sunDot.position.set(d[0]/h*U.Rr,U.gy,d[2]/h*U.Rr);U.shDot.position.set(-d[0]/h*U.Rr,U.gy,-d[2]/h*U.Rr);U.sunDot.visible=U.shDot.visible=up;
  if(U.now){dial.remove(U.now);U.now.material.map.dispose();U.now.material.dispose();U.now=null;}
  if(up){U.now=tag(`${A.hhmm(LAB.min)} · ${Math.round(sun.alt/A.SR)}°`,{size:30,k:.036,bg:'#17151c',fg:'#FFD600'});U.now.position.set(d[0]*R,d[1]*R,d[2]*R);U.now.renderOrder=40;dial.add(U.now);}
}
function updateSun(){
  const sun=A.sunNow(),key=sun.alt.toFixed(4)+'|'+sun.az.toFixed(4);if(key===lastSun)return;lastSun=key;
  const d=sunDir(sun),up=sun.alt>0,D=900;
  sunL.position.set(d[0]*D,Math.max(.02,d[1])*D,d[2]*D);sunL.intensity=up?3.4*Math.min(1,.3+sun.alt*2.2):0;
  const warm=Math.max(0,1-sun.alt/(25*A.SR));sunL.color.setRGB(1,.94-.18*warm,.86-.36*warm);
  hemi.intensity=up?.5:.2;setSky(sun.alt);
  sunBall.position.set(d[0]*V.R*.95,d[1]*V.R*.95,d[2]*V.R*.95);sunBall.visible=up;
  if(A.dayDate().toDateString()+'|'+A.lang()!==dialDay)buildDial();
  updateDial(sun);dirty=true;
}

// ── Kamera mit Schwung ──
function placeCam(){
  if(PLAYER||V.bikes.follow>=0)return;
  const gy=yOf(hAt(CAM.tx,CAM.tz));
  if(V.eye){cam.position.set(CAM.tx,gy+1.7,CAM.tz);cam.lookAt(CAM.tx+Math.sin(CAM.yaw)*10,gy+1.7+Math.tan(CAM.pitch)*10,CAM.tz-Math.cos(CAM.yaw)*10);cam.fov=62;}
  else{const s=Math.sin(CAM.ph);cam.position.set(CAM.tx+CAM.r*s*Math.sin(CAM.th),gy+CAM.r*Math.cos(CAM.ph),CAM.tz+CAM.r*s*Math.cos(CAM.th));cam.lookAt(CAM.tx,gy,CAM.tz);cam.fov=38;}
  if(scene&&scene.fog){const r=V.eye?300:CAM.r;scene.fog.near=Math.max(V.R*1.1,r*1.05);scene.fog.far=Math.max(V.R*3,r*2.8);}   // Dunst mit dem Abstand: Übersicht bleibt klar
  cam.updateProjectionMatrix();dirty=true;
}
function inertia(dt){   // Nachlaufen nach dem Loslassen — organisch statt ruckartig
  if(PLAYER||V.bikes.follow>=0||drag)return;const f=Math.pow(.0025,dt);let mv=false;
  if(Math.abs(CAM.vth)+Math.abs(CAM.vph)>1e-4){CAM.th+=CAM.vth*dt;CAM.ph=Math.max(.12,Math.min(1.45,CAM.ph+CAM.vph*dt));CAM.vth*=f;CAM.vph*=f;mv=true;}
  if(Math.abs(CAM.vx)+Math.abs(CAM.vz)>1e-3){CAM.tx+=CAM.vx*dt;CAM.tz+=CAM.vz*dt;CAM.vx*=f;CAM.vz*=f;mv=true;}
  if(Math.abs(CAM.vr-1)>1e-4){CAM.r=Math.max(40,Math.min(1600,CAM.r*Math.pow(CAM.vr,dt*8)));CAM.vr=1+(CAM.vr-1)*Math.pow(.02,dt);mv=true;}
  if(CAM.goal){const g=CAM.goal,t=Math.min(1,(performance.now()-g.t0)/g.dur),e=ease(t);for(const k of ['th','ph','r','tx','tz'])CAM[k]=g.from[k]+(g.to[k]-g.from[k])*e;if(t>=1)CAM.goal=null;mv=true;}
  if(mv)placeCam();
}
const flyCam=(to,dur)=>{CAM.goal={from:{th:CAM.th,ph:CAM.ph,r:CAM.r,tx:CAM.tx,tz:CAM.tz},to:{th:CAM.th,ph:CAM.ph,r:CAM.r,tx:CAM.tx,tz:CAM.tz,...to},t0:performance.now(),dur:REDUCED()?1:(dur||1400)};};
let drag=false;
function controls(cv){
  const pts=new Map();let last=null,pinch=null,down=null,lastT=0;
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);pts.set(e.pointerId,[e.clientX,e.clientY]);last={x:e.clientX,y:e.clientY,b:e.button,sh:e.shiftKey};down={x:e.clientX,y:e.clientY};drag=true;CAM.goal=null;CAM.vth=CAM.vph=CAM.vx=CAM.vz=0;lastT=performance.now();
    if(pts.size===2){const [a,b]=[...pts.values()];pinch=Math.hypot(a[0]-b[0],a[1]-b[1]);}});
  cv.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,[e.clientX,e.clientY]);
    if(pts.size===2){const [a,b]=[...pts.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch){CAM.r=Math.max(40,Math.min(1600,CAM.r*pinch/d));placeCam();}pinch=d;return;}
    if(!last)return;const dx=e.clientX-last.x,dy=e.clientY-last.y,now=performance.now(),dt=Math.max(.008,(now-lastT)/1000);lastT=now;last.x=e.clientX;last.y=e.clientY;
    if(V.bikes.follow>=0&&!PLAYER){V.bikes.follow=-1;panel();}
    if(V.eye){CAM.yaw+=dx*.005;CAM.pitch=Math.max(-.6,Math.min(.9,CAM.pitch+dy*.004));}
    else if(last.b===2||last.sh){const k=CAM.r/900,c=Math.cos(CAM.th),s=Math.sin(CAM.th),mx=-(dx*c+dy*s)*k,mz=-(-dx*s+dy*c)*k;CAM.tx+=mx;CAM.tz+=mz;CAM.vx=mx/dt*.6;CAM.vz=mz/dt*.6;}
    else{CAM.th-=dx*.006;CAM.ph=Math.max(.12,Math.min(1.45,CAM.ph-dy*.005));CAM.vth=-dx*.006/dt*.6;CAM.vph=-dy*.005/dt*.6;}
    placeCam();});
  const up=e=>{pts.delete(e.pointerId);if(pts.size<2)pinch=null;if(!pts.size){last=null;drag=false;if(performance.now()-lastT>90){CAM.vth=CAM.vph=CAM.vx=CAM.vz=0;}}
    if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5)pick(e);down=null;};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('wheel',e=>{e.preventDefault();if(V.eye)return;CAM.goal=null;CAM.vr=Math.max(.9,Math.min(1.1,CAM.vr*Math.exp(e.deltaY*.0009)));},{passive:false});
}
function pick(e){   // Radfahrer:in antippen → mitfahren
  if(!bikeMeshes||!V.bikes.on)return;const r=ren.domElement.getBoundingClientRect(),m=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
  _ray=_ray||ray();_ray.far=5000;_ray.setFromCamera(m,cam);const hit=_ray.intersectObject(bikeMeshes.mb,false)[0];
  if(hit&&hit.instanceId!=null&&hit.instanceId<AG.length){V.bikes.follow=hit.instanceId;panel();}
}
addEventListener('keydown',e=>{if(!V.on||!PLAYER)return;const k=e.key;if(k==='ArrowLeft'||k==='a')KEYS.turn=-1;else if(k==='ArrowRight'||k==='d')KEYS.turn=1;else if(k==='ArrowUp'||k==='w')KEYS.acc=1;else if(k==='ArrowDown'||k==='s')KEYS.acc=-1;else return;e.preventDefault();});
addEventListener('keyup',e=>{const k=e.key;if(['ArrowLeft','a','ArrowRight','d'].includes(k))KEYS.turn=0;if(['ArrowUp','w','ArrowDown','s'].includes(k))KEYS.acc=0;});

// ── Stadt wächst ──
function growTick(now){
  const G=V.grow;if(!G)return;const t=Math.min(1,(now-G.t0)/G.dur),yr=Math.round(G.y0+(G.y1-G.y0)*ease(t));
  let n=0;for(const m of buckets){const show=m.userData.y!=null&&m.userData.y<=yr;m.visible=show||t>=1;if(show)n+=m.userData.n;}
  const lbl=el&&el.querySelector('.v3-year');if(lbl)lbl.innerHTML=`<b>${yr}</b><span>${A.fmt(n)} ${T('Gebäude stehen','buildings standing','gebouwen staan')}</span>`;
  dirty=true;if(t>=1){V.grow=null;setTimeout(()=>{const l=el&&el.querySelector('.v3-year');if(l)l.classList.remove('on');},2400);}
}
function startGrow(){const ys=buckets.map(m=>m.userData.y).filter(v=>v!=null);if(!ys.length)return;
  V.grow={y0:Math.min(...ys),y1:new Date().getFullYear(),t0:performance.now(),dur:REDUCED()?1:14000};const l=el&&el.querySelector('.v3-year');if(l)l.classList.add('on');}

// ── Bau der Szene ──
async function build(){
  const c=A.PIN||A.map.getCenter();C0=A.toRD(c.lat,c.lng);const bb=bounds();
  A.status(T('Spielstadt wird gebaut: Gelände, Gebäude, Bäume, Wasser …','Building the play city: terrain, buildings, trees, water …','Speelstad wordt gebouwd: maaiveld, gebouwen, bomen, water …'),true);
  const [blds,S]=await Promise.all([A.ensure('b',bb),A.ensure('s',bb),A.ensureTrees(),loadTerrain().catch(()=>null)]);
  await A.measureTrees();
  const inR=b=>{const p=loc(b.z[0],b.z[1]);return Math.abs(p[0])<V.R&&Math.abs(p[1])<V.R;};
  const list=blds.filter(inR);V._blds=list;V._S=S;
  root=new THREE.Group();scene.add(root);
  if(!TER){const n=321;TER={z:new Float32Array(n*n),w:n,h:n,res:2*V.R/(n-1),zref:0,lo:0,raw:new Float32Array(n*n).fill(-9999)};}
  // Gelände mit Karte/Luftbild
  terMesh=new THREE.Mesh(terrainGeo(),new THREE.MeshStandardMaterial({color:0xe9e3d6,roughness:1}));terMesh.receiveShadow=true;root.add(terMesh);
  const by=new Map();for(const b of list){const k=BUCKET(b.yr);if(!by.has(k))by.set(k,[]);by.get(k).push(b);}
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0});
  buckets=[];for(const [k,bs] of by){const m=new THREE.Mesh(bldGeo(bs,()=>hex2('#f6f2ea')),mat);m.castShadow=m.receiveShadow=true;m.userData={y:k,n:bs.length};root.add(m);buckets.push(m);}
  const ts=A.treesIn(.02,bb).map(t=>{const p=loc(t[4],t[5]);return {x:p[0],z:-p[1],r:Math.max(1.2,t[2]),h:Math.max(3,t[3])};}).filter(t=>Math.abs(t.x)<V.R&&Math.abs(t.z)<V.R);
  V._ts=ts;
  if(ts.length){const cg=new THREE.IcosahedronGeometry(1,1),tg=new THREE.CylinderGeometry(.18,.25,1,6);
    const cm=new THREE.MeshStandardMaterial({color:0x6f9a5a,roughness:1,flatShading:true}),tm=new THREE.MeshStandardMaterial({color:0x6b5a48,roughness:1});
    crowns=new THREE.InstancedMesh(cg,cm,ts.length);trunks=new THREE.InstancedMesh(tg,tm,ts.length);const col=new THREE.Color();
    ts.forEach((t,i)=>{col.setHSL(.27+((i*37)%10)/200,.32,.42+((i*53)%10)/100);crowns.setColorAt(i,col);});
    placeTrees();crowns.castShadow=crowns.receiveShadow=trunks.castShadow=true;root.add(crowns,trunks);}
  waterTex=rippleTex();buildCanals(S);
  V.stats={b:list.length,t:ts.length,relief:TER?Math.round((Math.max(...TER.z)-TER.lo)*10)/10:null};
  A.status('');dirty=true;paintGround(S);
}
function placeTrees(){   // Bäume auf das (ggf. überhöhte) Gelände stellen
  if(!crowns||!V._ts)return;const o=new THREE.Object3D();
  V._ts.forEach((t,i)=>{const g=yOf(hAt(t.x,t.z)),ch=Math.min(2*t.r,.62*t.h);o.position.set(t.x,g+t.h-ch/2,t.z);o.scale.set(t.r,ch/2,t.r);o.rotation.set(0,i,0);o.updateMatrix();crowns.setMatrixAt(i,o.matrix);
    o.position.set(t.x,g+(t.h-ch)/2,t.z);o.scale.set(1,Math.max(.5,t.h-ch),1);o.rotation.set(0,0,0);o.updateMatrix();trunks.setMatrixAt(i,o.matrix);});
  crowns.instanceMatrix.needsUpdate=trunks.instanceMatrix.needsUpdate=true;
}
function paintGround(S){
  const R=V.R,N=2048,cv=document.createElement('canvas');cv.width=cv.height=N;const g=cv.getContext('2d');if(!g||typeof g.fillRect!=='function')return;
  const apply=canvas=>{const tx=new THREE.CanvasTexture(canvas);tx.colorSpace=THREE.SRGBColorSpace;tx.anisotropy=8;if(terMesh){if(terMesh.material.map)terMesh.material.map.dispose();terMesh.material.dispose();terMesh.material=new THREE.MeshStandardMaterial({map:tx,roughness:1});}dirty=true;};
  if(V.ground==='photo'){const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{g.drawImage(img,0,0,N,N);apply(cv);};
    img.src=`https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=Actueel_orthoHR&STYLES=&CRS=EPSG:28992&BBOX=${C0[0]-R},${C0[1]-R},${C0[0]+R},${C0[1]+R}&WIDTH=${N}&HEIGHT=${N}&FORMAT=image/jpeg`;return;}
  g.fillStyle='#ece6da';g.fillRect(0,0,N,N);
  const px=(e,n)=>[(e+R)/(2*R)*N,(R-n)/(2*R)*N],COL={0:'#dcd6ca',1:'#e4ddcc',2:'#b9c99b',3:'#8fb1cc'};
  const by=new Map();for(const o of S||V._S||[]){const t=LAB.street?LAB.street.typeOf(o):'';const c2=t==='car'||t==='transit'?'#cbc6bd':t==='bike'?'#e3baa8':t==='walk'?'#e8e1d3':COL[o.c]||COL[0];if(!by.has(c2))by.set(c2,[]);by.get(c2).push(o);}
  for(const [c2,os] of by){g.fillStyle=c2;for(let j=0;j<os.length;j+=64){g.beginPath();for(let i=j;i<Math.min(os.length,j+64);i++){const z=os[i].z;for(let k=0;k<z.length;k+=2){const p=loc(z[k],z[k+1]),q=px(p[0],p[1]);k?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]);}g.closePath();}g.fill();}}
  apply(cv);
}
function setExag(x){V.exag=x;if(!TER||!root)return;terMesh.geometry.dispose();terMesh.geometry=terrainGeo();
  const keep=buckets.map(m=>m.visible);buckets.forEach(m=>{root.remove(m);m.geometry.dispose();});
  const by=new Map();for(const b of V._blds){const k=BUCKET(b.yr);if(!by.has(k))by.set(k,[]);by.get(k).push(b);}const mat=buckets[0]&&buckets[0].material;buckets=[];
  for(const [k,bs] of by){const m=new THREE.Mesh(bldGeo(bs,()=>hex2('#f6f2ea')),mat);m.castShadow=m.receiveShadow=true;m.userData={y:k,n:bs.length};root.add(m);buckets.push(m);}
  buckets.forEach((m,i)=>m.visible=keep[i]!==false);buildCanals(V._S||[]);
  placeTrees();
  if(waterMesh)updateWater(V.water.t);placeCam();dirty=true;}

// ── Bedienfeld in der Szene ──
function panel(){
  if(!el)return;const p=el.querySelector('.v3-pane');if(!p)return;const W=V.water,B=V.bikes,m=V.mode;
  el.querySelectorAll('.v3-modes [data-md]').forEach(b=>b.classList.toggle('on',b.dataset.md===m));
  let h='';
  if(m==='licht'){const [a,b]=A.dayRange(),dd=A.dayDate(),doy=Math.round((dd-new Date(dd.getFullYear(),0,0))/864e5),mn=a==null?0:Math.round(Math.min(b,Math.max(a,LAB.min)));
    const dl=dd.toLocaleDateString(A.lang()==='en'?'en-GB':A.lang()==='nl'?'nl-NL':'de-DE',{day:'numeric',month:'short'});
    h=a==null?`<p>${T('Die Sonne geht an diesem Tag nicht auf.','The sun does not rise on this day.','De zon komt deze dag niet op.')}</p>`:`<div class="v3-tl"><span>${A.hhmm(a)}</span><input type="range" id="v3T" min="${Math.round(a)}" max="${Math.round(b)}" step="1" value="${mn}" aria-label="${T('Uhrzeit','Time of day','Tijdstip')}"><span>${A.hhmm(b)}</span><b id="v3Tv">${A.hhmm(mn)}</b></div>
      <div class="v3-tl"><span>1.1.</span><input type="range" id="v3D" min="1" max="365" step="1" value="${doy}" aria-label="${T('Tag im Jahr','Day of year','Dag van het jaar')}"><span>31.12.</span><b id="v3Dv">${dl}</b></div>
      <div class="v3-row"><button data-a="now">${T('Jetzt','Now','Nu')}</button><button data-a="play">${LAB.playing?T('Anhalten','Pause','Pauzeren'):T('Tag abspielen','Play the day','Dag afspelen')}</button><button data-a="eye" class="${V.eye?'on':''}">${V.eye?T('Von oben','From above','Van boven'):T('Augenhöhe','Eye level','Ooghoogte')}</button></div>
      <p class="v3-note">${T('Gelber Strahl: Sonne zum Mittelpunkt. Gelber Punkt am Ring: Sonnenrichtung, dunkler Punkt: wohin die Schatten fallen.','Yellow ray: sun to the centre. Yellow dot on the ring: sun direction; dark dot: where shadows fall.','Gele straal: zon naar het midden. Gele stip op de ring: zonrichting, donkere stip: waar de schaduw valt.')}</p>`;}
  if(m==='wasser'){const k=W.kind;
    h=`<div class="v3-row"><button data-w="rain" class="${k==='rain'?'on':''}">${T('Wolkenbruch','Cloudburst','Wolkbreuk')}</button><button data-w="dike" class="${k==='dike'?'on':''}">${T('Deichbruch','Dike breach','Dijkdoorbraak')}</button><button data-w="level" class="${k==='level'?'on':''}">${T('Wasserstand','Water level','Waterstand')}</button></div>`;
    if(W.busy)h+=`<p><span class="lab-spin" aria-hidden="true"></span> ${T('Wasser wird berechnet …','Computing water …','Water wordt berekend …')}</p>`;
    else if(k==='rain'&&W.info)h+=`<p><b>${A.fmt(W.info.a)} m²</b> ${T('mit mehr als 10 cm Wasser, wenn alle Mulden voll sind (eigene Rechnung, ohne Kanalisation).','with more than 10 cm of water when all hollows are full (own calculation, no sewers).','met meer dan 10 cm water als alle kommen vol zijn (eigen berekening, zonder riool).')}</p>`;
    else if(k==='dike'&&W.info)h+=`<div class="v3-row">${[1,2,3,4,5].map(x=>`<button data-k="${x}" class="${W.k===x?'on':''}">1/${['10','100','1.000','10.000','100.000'][x-1]}</button>`).join('')}</div><p>${W.info.max>0?T(`bis <b>${A.nf(W.info.max,1)} m</b> tief — mögliches Szenario bei einem Deichbruch, ≈ 1× in ${['10','100','1.000','10.000','100.000'][W.k-1]} Jahren (LIWO, Rijkswaterstaat).`,`up to <b>${A.nf(W.info.max,1)} m</b> deep — a possible scenario after a dike breach, ≈ once in ${['10','100','1,000','10,000','100,000'][W.k-1]} years (LIWO).`,`tot <b>${A.nf(W.info.max,1)} m</b> diep — mogelijk scenario bij een dijkdoorbraak, ≈ 1× per ${['10','100','1.000','10.000','100.000'][W.k-1]} jaar (LIWO).`):T('In dieser Klasse bleibt es hier trocken (LIWO).','In this class it stays dry here (LIWO).','In deze klasse blijft het hier droog (LIWO).')}</p>`;
    else if(k==='level')h+=`<div class="v3-lvl"><input type="range" id="v3L" min="${Math.floor((TER?TER.lo:-2)-1)}" max="${Math.ceil((TER?TER.zref:0)+6)}" step="0.1" value="${W.level}"><b>${A.nf(W.level,1)} m NAP</b></div><p>${T('Gedankenexperiment „Badewanne": alles unter dem Wasserstand steht unter Wasser — ohne Deiche und Pumpen.','“Bathtub” thought experiment: everything below the level is flooded — without dikes and pumps.','Gedachte-experiment „badkuip": alles onder de waterstand staat onder water — zonder dijken en gemalen.')}</p>`;
    else h+=`<p>${T('Wähle ein Szenario — das Wasser steigt in der Stadt. Grachten bewegen sich immer.','Pick a scenario — water rises in the city. Canals always move.','Kies een scenario — het water stijgt in de stad. Grachten bewegen altijd.')}</p>`;
    if(W.err)h+=`<p class="v3-err">${W.err}</p>`;}
  if(m==='wind'){const W=V.wind,dn=d=>A.dirName(d);
    h=W.busy?`<p><span class="lab-spin" aria-hidden="true"></span> ${T('Wind und Gebäude werden geladen …','Loading wind and buildings …','Wind en gebouwen laden …')}</p>`:!W.on?`<p>${T('Zeigt, wie der Wind zwischen den Gebäuden durchzieht: Düsen, Ecken, Windschatten.','Shows how wind moves between buildings: gaps, corners, wind shadow.','Laat zien hoe de wind tussen de gebouwen trekt: doorgangen, hoeken, windschaduw.')}</p><div class="v3-row"><button data-a="wind">${T('Wind zeigen','Show wind','Wind tonen')}</button></div>`:
      `<p><b>${T('Wind aus','Wind from','Wind uit')} ${dn(W.dir)}</b> · ${A.nf(W.sp,1)} m/s ${W.dir===Math.round(W.cur.dir)&&!W.cur.fallback?T('(jetzt, Open-Meteo, 10 m Höhe)','(now, Open-Meteo, 10 m height)','(nu, Open-Meteo, 10 m hoogte)'):W.cur.fallback?T('(Beispiel — Wetterdaten nicht erreichbar)','(example — weather data unavailable)','(voorbeeld — weerdata niet bereikbaar)'):T('(selbst gewählt)','(chosen)','(zelf gekozen)')}</p>
      <div class="v3-tl"><span>N</span><input type="range" id="v3W" min="0" max="355" step="5" value="${W.dir}" aria-label="${T('Windrichtung','Wind direction','Windrichting')}"><span>N</span><b>${W.dir}°</b></div>
      <div class="v3-leg"><span><i style="background:#e8603c"></i>${T('Düse — zugig','gap — draughty','doorgang — tochtig')}</span><span><i style="background:#f2c230"></i>${T('Ecke','corner','hoek')}</span><span><i style="background:#38b2d8"></i>${T('freie Strömung','free flow','vrije stroming')}</span><span><i style="background:#2b6cb0"></i>${T('Windschatten','wind shadow','windschaduw')}</span></div>
      <div class="v3-row"><button data-a="windnow">${T('Aktueller Wind','Current wind','Huidige wind')}</button></div>
      <p class="v3-note">${T('Veranschaulichung nach einfachen Regeln (Windschatten bis 4 × Gebäudehöhe, Düsen zwischen nahen Fassaden), dreifach schneller dargestellt — keine Strömungssimulation.','Illustration with simple rules (wind shadow up to 4 × building height, gaps between close façades), shown three times faster — not a flow simulation.','Illustratie met eenvoudige regels (windschaduw tot 4 × gebouwhoogte, doorgangen tussen gevels), drie keer sneller getoond — geen stromingssimulatie.')}</p>`;
    if(W.err)h+=`<p class="v3-err">${W.err}</p>`;}
  if(m==='rad'){h=B.busy?`<p><span class="lab-spin" aria-hidden="true"></span> ${T('Wegenetz wird geladen (NWB) …','Loading road network (NWB) …','Wegennet laden (NWB) …')}</p>`:
    B.ride?`<div class="v3-hud"><span class="v3-speed"><b>${Math.round((PLAYER?PLAYER.v:5)*3.6)}</b> km/h</span><span class="v3-shade"><b>${B.shade==null?'—':Math.round(100*B.shade)+' %'}</b> ${T('im Schatten','in shade','in schaduw')}</span></div><p>${T('Pfeiltasten: links/rechts an der nächsten Kreuzung, hoch/runter Tempo. Der Schattenmesser prüft alle Viertelsekunde, ob Gebäude oder Bäume die Sonne verdecken.','Arrow keys: left/right at the next junction, up/down for speed. The shade meter checks every quarter second whether buildings or trees block the sun.','Pijltjes: links/rechts bij de volgende kruising, omhoog/omlaag snelheid. De schaduwmeter controleert elke kwart seconde of gebouwen of bomen de zon blokkeren.')}</p><div class="v3-row"><button data-a="ridestop">${T('Absteigen','Get off','Afstappen')}</button></div>`
    :`<p>${B.on?T(`${B.n} Radfahrer:innen unterwegs — Simulation auf dem echten Wegenetz (${NET&&NET.src==='OSM'?'OpenStreetMap':'NWB, Rijkswaterstaat'}), keine echten Positionen. Antippen zum Mitfahren.`,`${B.n} cyclists out — a simulation on the real road network (${NET&&NET.src==='OSM'?'OpenStreetMap':'NWB'}), not real positions. Tap one to ride along.`,`${B.n} fietsers onderweg — simulatie op het echte wegennet (${NET&&NET.src==='OSM'?'OpenStreetMap':'NWB'}), geen echte posities. Tik er een aan om mee te rijden.`):T('Lass die Stadt radeln: simulierte Radfahrer:innen auf dem echten Wegenetz (NWB, Radwege bevorzugt).','Let the city cycle: simulated cyclists on the real road network (NWB, cycle paths preferred).','Laat de stad fietsen: gesimuleerde fietsers op het echte wegennet (NWB, fietspaden eerst).')}</p>
      ${V.walk.on?`<div class="v3-hud"><span class="v3-wsh"><b>${V.walk.shade==null?'—':Math.round(100*V.walk.shade)+' %'}</b> ${T('der Fußgänger:innen im Schatten','of pedestrians in shade','van de voetgangers in de schaduw')}</span></div>`:''}
      <div class="v3-row">${B.on?'':`<button data-a="bikes">${T('Radverkehr starten','Start cycling','Fietsverkeer starten')}</button>`}${V.walk.on?`<button data-a="seek" class="${V.walk.seek?'on':''}">${V.walk.seek?T('Suchen Schatten','Seeking shade','Zoeken schaduw'):T('Laufen zufällig','Walking randomly','Lopen willekeurig')}</button>`:`<button data-a="walk">${V.walk.busy?T('Lädt …','Loading …','Laden …'):T('Fußgänger:innen','Pedestrians','Voetgangers')}</button>`}<button data-a="ride">${T('Selbst fahren','Ride yourself','Zelf fietsen')}</button>${B.follow>=0?`<button data-a="unfollow">${T('Nicht mehr folgen','Stop following','Niet meer volgen')}</button>`:''}</div>${B.err?`<p class="v3-err">${B.err}</p>`:''}`;}
  if(m==='wachstum'){const F=V.fut,ys=buckets.map(x=>x.userData.y).filter(v=>v!=null),y0=ys.length?Math.min(...ys):1600,yr=F.yr||YNOW;
    h=`<div class="v3-tl"><span>${y0}</span><input type="range" id="v3Y" min="${y0}" max="${YMAX}" step="1" value="${yr}" aria-label="${T('Jahr','Year','Jaar')}"><span>${YMAX}</span><b>${yr}</b></div>
      <div class="v3-row"><button data-a="grow">${F.play?T('Läuft …','Playing …','Loopt …'):T('Zeitreise abspielen','Play time travel','Tijdreis afspelen')}</button><button data-a="ynow">${T('Heute','Today','Vandaag')}</button></div>
      <div class="v3-leg"><span><i style="background:#f6f2ea;border:1px solid #bbb"></i>${T('Bestand nach Baujahr','existing by year built','bestaand naar bouwjaar')}</span><span><i style="background:#f2b84a"></i>${T('im Bau','under construction','in aanbouw')}${F.info?' '+F.info.built:''}</span><span><i style="background:#6fa3e6"></i>${T('genehmigt','permitted','vergund')}${F.info?' '+F.info.permit:''}</span><span><i style="background:#e0644a"></i>${T('Abriss genehmigt','demolition permitted','sloop vergund')}${F.info?' '+F.info.demo:''}</span><span><i style="background:#ffd24a"></i>${T('Kanal wird erneuert','sewer renewal','riool vernieuwd')}${F.info?' '+A.nf(F.info.km,1)+' km':''}</span></div>
      ${F.busy?`<p><span class="lab-spin" aria-hidden="true"></span> ${T('Planungen werden geladen (BAG, Gemeente) …','Loading plans (BAG, municipality) …','Plannen laden (BAG, gemeente) …')}</p>`:''}
      <p class="v3-note">${T(`Nach ${YNOW}: Gebäude mit Status „Bau begonnen" oder „Baugenehmigung erteilt" (BAG) — Höhe geschätzt aus der Zahl der Wohneinheiten — und Kanalerneuerungen nach Planjahr der Gemeente. Wo die Straße ohnehin aufgemacht wird, lassen sich Bäume günstig mitpflanzen. Projekte ohne Genehmigung fehlen.`,`After ${YNOW}: buildings with status "construction started" or "permit granted" (BAG) — height estimated from the number of units — and sewer renewals by planned year. Where the street is opened anyway, trees are cheap to add. Projects without a permit are missing.`,`Na ${YNOW}: gebouwen met status „bouw gestart" of „bouwvergunning verleend" (BAG) — hoogte geschat uit het aantal eenheden — en rioolvervanging naar planjaar. Waar de straat toch opengaat, zijn bomen goedkoop mee te planten. Projecten zonder vergunning ontbreken.`)}</p>${F.err?`<p class="v3-err">${F.err}</p>`:''}`;}
  p.innerHTML=h;
  p.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>scenario(b.dataset.w));
  p.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{V.water.k=+b.dataset.k;V.water.kind=null;scenario('dike');});
  const lv=p.querySelector('#v3L');if(lv)lv.oninput=()=>{V.water.level=+lv.value;lv.nextElementSibling.textContent=A.nf(V.water.level,1)+' m NAP';if(waterMesh){waterMesh.geometry.userData.level=V.water.level;V.water.t=1;updateWater(1);}};
  const tS=p.querySelector('#v3T');if(tS){tS.oninput=()=>{LAB.min=+tS.value;LAB.playing=false;p.querySelector('#v3Tv').textContent=A.hhmm(LAB.min);lastSun='';dirty=true;};tS.onchange=()=>A.req();}
  const dS=p.querySelector('#v3D');if(dS){dS.oninput=()=>{LAB.dateKey='doy';LAB.doy=+dS.value;const d=A.dayDate();p.querySelector('#v3Dv').textContent=d.toLocaleDateString(A.lang()==='en'?'en-GB':A.lang()==='nl'?'nl-NL':'de-DE',{day:'numeric',month:'short'});lastSun='';dirty=true;};dS.onchange=()=>{panel();A.req();};}
  const wS=p.querySelector('#v3W');if(wS){wS.oninput=()=>{V.wind.dir=+wS.value;wS.nextElementSibling.nextElementSibling.textContent=V.wind.dir+'°';windField(V.wind.dir);};wS.onchange=()=>panel();}
  const yS=p.querySelector('#v3Y');if(yS)yS.oninput=()=>{V.fut.play=false;setYear(+yS.value);yS.nextElementSibling.nextElementSibling.textContent=yS.value;};
  p.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const a=b.dataset.a;
    if(a==='now'){LAB.dateKey='today';const n=new Date();LAB.min=n.getHours()*60+n.getMinutes();LAB.playing=false;lastSun='';panel();A.req();}
    if(a==='walk')startWalk();
    if(a==='seek'){V.walk.seek=!V.walk.seek;V.walk.t=V.walk.sh=0;V.walk.shade=null;panel();}
    if(a==='wind')startWind();
    if(a==='windnow'&&V.wind.cur){V.wind.dir=Math.round(V.wind.cur.dir);windField(V.wind.dir);panel();}
    if(a==='ynow'){V.fut.play=false;setYear(YNOW);panel();}
    if(a==='play'){const pb=document.querySelector('.lab-play');if(pb)pb.click();else LAB.playing=false;setTimeout(panel,30);}
    if(a==='eye'){V.eye=!V.eye;if(V.eye){const s=A.sunNow();CAM.yaw=Math.PI-s.az;CAM.pitch=.08;}placeCam();panel();}
    if(a==='bikes')startBikes();
    if(a==='ride'){(V.bikes.on?Promise.resolve():startBikes()).then(()=>{if(NET)rideStart();});}
    if(a==='ridestop')rideStop();
    if(a==='unfollow'){V.bikes.follow=-1;placeCam();panel();}
    if(a==='grow'){futureLoad();V.fut.play=true;V.fut.t0=0;V.fut.y0=buckets.reduce((m,x)=>x.userData.y!=null?Math.min(m,x.userData.y):m,YNOW);panel();}});
  if(m==='wachstum'&&!V.fut.loaded&&!V.fut.busy)futureLoad();
  if(dial)dial.visible=m==='licht';if(windObj)windObj.mesh.visible=m==='wind'&&V.wind.on;if(m!=='wachstum'&&V.fut.yr!=null&&V.fut.yr!==YNOW){V.fut.play=false;setYear(YNOW);}
  const yl=el.querySelector('.v3-year');if(yl&&m!=='wachstum')yl.classList.remove('on');
}

// ── Ein-/Ausschalten ──
let lastNow=0;
function frame(now){if(!V.on||!ren)return;now=now||performance.now();const dt=Math.min(.05,(now-(lastNow||now))/1000);lastNow=now;
  updateSun();if(V.grow)growTick(now);inertia(dt);waterTick(now);bikeTick(dt,now);walkTick(dt,now);windTick(dt);futTick(now);
  if(LAB.playing&&V.mode==='licht'&&now-(frame._s||0)>120){frame._s=now;const sl=el.querySelector('#v3T'),lb=el.querySelector('#v3Tv');if(sl)sl.value=Math.round(LAB.min);if(lb)lb.textContent=A.hhmm(LAB.min);}
  if(waterTex&&(canals.length||waterMesh)){waterTex.offset.x=(now/1000)*.012;waterTex.offset.y=(now/1000)*.007;dirty=true;}   // Wasser bewegt sich
  const w=el.clientWidth,h=el.clientHeight;if(ren.domElement.width!==Math.round(w*ren.getPixelRatio())||ren.domElement.height!==Math.round(h*ren.getPixelRatio())){ren.setSize(w,h,false);cam.aspect=w/Math.max(1,h);cam.updateProjectionMatrix();dirty=true;}
  if(dirty){ren.render(scene,cam);dirty=false;}}
function loop(now){raf=requestAnimationFrame(loop);frame(now);}
V.open=async function(){
  if(V.on||V.busy)return;V.busy=true;V.err=null;A.rerender();
  try{await three();}catch(e){V.busy=false;V.err=T('3D braucht eine Internetverbindung zur Grafik-Bibliothek (three.js) — gerade nicht erreichbar.','3D needs the graphics library (three.js) — not reachable right now.','3D heeft de grafische bibliotheek (three.js) nodig — nu niet bereikbaar.');A.rerender();return;}
  el=document.createElement('div');el.className='v3d';el.innerHTML=`<div class="v3-bar">
      <button data-v="relief">${T('Relief ×1','Relief ×1','Reliëf ×1')}</button><button data-v="ground">${T('Luftbild','Aerial','Luchtfoto')}</button><button data-v="close" class="v3-x">${T('Zur Karte','Back to map','Naar kaart')}</button></div>
    <div class="v3-play"><div class="v3-modes" role="tablist">${[['licht',T('Licht','Light','Licht')],['wasser',T('Wasser','Water','Water')],['wind',T('Wind','Wind','Wind')],['rad',T('Unterwegs','On the move','Onderweg')],['wachstum',T('Zeitreise','Time travel','Tijdreis')]].map(([k,l])=>`<button role="tab" data-md="${k}">${l}</button>`).join('')}</div><div class="v3-pane"></div></div>
    <div class="v3-year"></div><p class="v3-hint">${T('Ziehen dreht · Rad oder zwei Finger zoomen · rechte Taste oder Umschalt schiebt','Drag to orbit · wheel or pinch to zoom · right button or shift to pan','Slepen draait · wiel of twee vingers zoomen · rechterknop of shift schuift')}</p>`;
  A.map.getContainer().appendChild(el);
  try{ren=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});}catch(e){el.remove();el=null;V.busy=false;V.err=T('Dieses Gerät kann kein WebGL — 3D nicht möglich.','This device has no WebGL — 3D not possible.','Dit apparaat heeft geen WebGL — 3D niet mogelijk.');A.rerender();return;}
  ren.setPixelRatio(Math.min(1.75,devicePixelRatio||1));ren.shadowMap.enabled=true;ren.shadowMap.type=THREE.PCFSoftShadowMap;ren.toneMapping=THREE.ACESFilmicToneMapping;ren.toneMappingExposure=.95;ren.outputColorSpace=THREE.SRGBColorSpace;
  el.prepend(ren.domElement);
  scene=new THREE.Scene();scene.fog=new THREE.Fog(0xd6e4ef,V.R*1.3,V.R*3.4);
  cam=new THREE.PerspectiveCamera(38,1,.5,6000);
  hemi=new THREE.HemisphereLight(0xc9dcf2,0xb9ad95,.5);scene.add(hemi);
  sunL=new THREE.DirectionalLight(0xfff1dc,2.4);sunL.castShadow=true;const sc=sunL.shadow.camera;sc.left=sc.bottom=-V.R*1.05;sc.right=sc.top=V.R*1.05;sc.near=10;sc.far=2400;
  sunL.shadow.mapSize.set(4096,4096);sunL.shadow.bias=-.0004;sunL.shadow.normalBias=.4;sunL.shadow.radius=3;scene.add(sunL,sunL.target);
  sunBall=new THREE.Mesh(new THREE.SphereGeometry(7,24,16),new THREE.MeshBasicMaterial({color:0xffd27a,fog:false}));scene.add(sunBall);
  controls(ren.domElement);
  el.querySelectorAll('.v3-bar [data-v]').forEach(b=>b.onclick=()=>{const v=b.dataset.v;
    if(v==='close')V.close();
    if(v==='relief'){const x=V.exag===1?3:1;b.textContent=T(`Relief ×${x===1?3:1}`,`Relief ×${x===1?3:1}`,`Reliëf ×${x===1?3:1}`);b.classList.toggle('on',x>1);setExag(x);}
    if(v==='ground'){V.ground=V.ground==='map'?'photo':'map';b.textContent=V.ground==='map'?T('Luftbild','Aerial','Luchtfoto'):T('Karte','Map','Kaart');paintGround();}});
  el.querySelectorAll('.v3-modes [data-md]').forEach(b=>b.onclick=()=>{V.mode=b.dataset.md;panel();});
  V.on=true;document.body.classList.add('v3d-on');lastSun='';
  try{await build();}catch(e){V.err=T('3D-Daten konnten nicht geladen werden.','3D data could not be loaded.','3D-data kon niet worden geladen.');}
  CAM.tx=CAM.tz=0;CAM.r=900;CAM.ph=1.2;placeCam();flyCam({th:-2.2,ph:.95,r:560},REDUCED()?1:2200);   // sanfter Anflug
  panel();V.busy=false;A.rerender();dirty=true;frame();if(!raf)raf=requestAnimationFrame(loop);
};
V.close=function(){if(!V.on&&!el)return;V.on=false;V.grow=null;PLAYER=null;V.bikes.on=false;V.bikes.ride=false;V.bikes.follow=-1;V.water.kind=null;V.walk.on=false;V.wind.on=false;V.fut.play=false;V.fut.loaded=false;V.fut.yr=null;V.fut.info=null;WK=[];document.body.classList.remove('v3d-on');cancelAnimationFrame(raf);raf=0;
  if(scene)scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{if(m.map)m.map.dispose();m.dispose();});}});
  if(ren){ren.dispose();ren.forceContextLoss&&ren.forceContextLoss();}if(el)el.remove();el=ren=scene=cam=root=crowns=trunks=pathLine=terMesh=waterMesh=bikeMeshes=walkMeshes=windObj=WG=futObj=dial=skyTx=null;dialDay='';buckets=[];canals=[];TER=null;AG=[];A.rerender();};
V.toggle=()=>V.on?V.close():V.open();
V._t={bldGeo,BUCKET,sunDir,CAM,get buckets(){return buckets},startGrow,frame:t=>{dirty=true;placeCam();frame(t);},scenario,startBikes,rideStart,rideStop,setExag,get TER(){return TER},get NET(){return NET},get AG(){return AG},get PLAYER(){return PLAYER},nextEdge,stepAgent,posOn,hAt,
  get water(){return waterMesh},flyCam,loadNet,windGrid,windField,get WG(){return WG},set WG(v){WG=v;},setYear,futureLoad,get dial(){return dial},startWalk,startWind,shadedAt,skyGrad};
})();

// ══════════════════════════════════════════════════════════════
// Straßenlabor · Werkzeug „Wasser" — wie Climate Central, aber amtlich:
//  0) Starkregen: Mulden im Gelände (AHN, Gebäude als Hindernis, Gewässer als Abfluss),
//     randvoll gefüllt (Priority-Flood) — Obergrenze ohne Kanalisation; dazu die
//     Klimaknelpunte der Gemeente (Straßen unpassierbar, Schäden an Gebäuden).
//  1) Überflutung: LIWO „Maximale waterdiepte Nederland" (Rijkswaterstaat),
//     fünf Wahrscheinlichkeitsklassen von ≈ 1× in 10 bis ≈ 1× in 100.000 Jahren.
//  2) Höhe & Wasserstand: AHN-Geländemodell (0,5 m) mit Wasserstand-Regler —
//     ausdrücklich ein Gedankenexperiment ohne Deiche und Pumpwerke.
// ══════════════════════════════════════════════════════════════
(function(){
'use strict';
const LAB=window.LAB;if(!LAB||!LAB.api)return;
const A=LAB.api,T=(d,e,n)=>A.T(d,e,n);
const LIWO='https://basisinformatie-overstromingen.nl/geoserver/ows',STYLE='LIWO_Basis_Waterdiepte';
const CLS=[{k:1,p:10,n:['große Wahrscheinlichkeit','large probability','grote kans']},{k:2,p:100,n:['mittlere Wahrscheinlichkeit','medium probability','middelgrote kans']},
  {k:3,p:1000,n:['kleine Wahrscheinlichkeit','small probability','kleine kans']},{k:4,p:10000,n:['sehr kleine Wahrscheinlichkeit','very small probability','zeer kleine kans']},
  {k:5,p:100000,n:['extrem kleine Wahrscheinlichkeit','extremely small probability','extreem kleine kans']}];
const lname=k=>`LIWO_Basis:MaximaleWaterdiepteNederland_Kaart${k}`;
const W={mode:'rain',k:3,layer:null,legend:null,level:0,dem:null,demKey:'',img:null,yr:'huidig',cm:20,chLegend:null};
// Plaatsgebonden overstromingskans (LIWO): heute · 2050 (alle Primärdeiche auf Normniveau) · 2100 (dazu Klimawandel)
const YRS=[['huidig',()=>T('heute','today','nu')],['2050',()=>'2050'],['2100',()=>'2100']],CMS=[0,20,50,200];
const chName=(yr,cm)=>`LIWO_Basis:plaatsgebonden_kans_totaal_${yr}_${cm}`;
const CHL={1:['extrem klein: seltener als 1/30.000 pro Jahr','extremely small: below 1/30,000 per year','extreem klein: kleiner dan 1/30.000 per jaar'],2:['sehr klein: 1/30.000 bis 1/3.000 pro Jahr','very small: 1/30,000 to 1/3,000 per year','zeer klein: 1/30.000 tot 1/3.000 per jaar'],
  3:['klein: 1/3.000 bis 1/300 pro Jahr','small: 1/3,000 to 1/300 per year','klein: 1/3.000 tot 1/300 per jaar'],4:['mittel: 1/300 bis 1/30 pro Jahr','medium: 1/300 to 1/30 per year','middelgroot: 1/300 tot 1/30 per jaar'],5:['groß: häufiger als 1/30 pro Jahr','large: above 1/30 per year','groot: vaker dan 1/30 per jaar']};
const chl=v=>{const r=CHL[v];return r?r[A.lang()==='en'?1:A.lang()==='nl'?2:0]:'—';};
const fmtP=p=>p.toLocaleString(A.lang()==='en'?'en-GB':'de-DE');
const per=p=>T(`≈ 1× in ${fmtP(p)} Jahren`,`≈ once in ${fmtP(p)} years`,`≈ 1× per ${fmtP(p)} jaar`);

// ── Amtliche Überflutungskarte (WMS) ──
function pane(){const m=A.map;if(!m.getPane('labWms')){const p=m.createPane('labWms');p.style.zIndex=350;p.style.pointerEvents='none';}return 'labWms';}   // eigene Ebene: der Papier-Filter der Basiskarte darf die amtlichen Farben nicht verfälschen
function showLayer(){
  const L_=window.L;if(!L_)return;
  if(W.layer){A.map.removeLayer(W.layer);W.layer=null;}
  if(W.mode==='chance'){W.layer=L_.tileLayer.wms(LIWO,{layers:chName(W.yr,W.cm),styles:'',format:'image/png',transparent:true,version:'1.3.0',opacity:.7,tileSize:512,pane:pane(),attribution:'LIWO · Rijkswaterstaat'}).addTo(A.map);return;}
  if(W.mode!=='flood')return;
  W.layer=L_.tileLayer.wms(LIWO,{layers:lname(W.k),styles:STYLE,format:'image/png',transparent:true,version:'1.3.0',opacity:.74,tileSize:512,pane:pane(),
    attribution:'LIWO · Rijkswaterstaat'}).addTo(A.map);
}
async function legend(){
  if(W.legend)return W.legend;
  try{const j=await fetch(`${LIWO}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&FORMAT=application/json&LAYER=${lname(3)}&STYLE=${STYLE}`).then(r=>r.json());
    W.legend=j.Legend[0].rules[0].symbolizers[0].Raster.colormap.entries.filter(e=>e.label).map(e=>({c:e.color,l:e.label}));}
  catch(e){W.legend=[];}
  return W.legend;
}
async function chLegend(){
  if(W.chLegend)return W.chLegend;
  try{const j=await fetch(`${LIWO}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&FORMAT=application/json&LAYER=${chName('huidig',20)}`).then(r=>r.json());
    W.chLegend=j.Legend[0].rules[0].symbolizers[0].Raster.colormap.entries.map(e=>({v:+e.quantity,c:e.color,l:e.label}));}catch(e){W.chLegend=[];}
  return W.chLegend;
}
function infoAt(layer,e){
  const m=A.map,crs=m.options.crs,b=m.getBounds(),sw=crs.project(b.getSouthWest()),ne=crs.project(b.getNorthEast()),sz=m.getSize();
  const u=`${LIWO}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=${layer}&QUERY_LAYERS=${layer}&STYLES=&CRS=EPSG:3857&BBOX=${sw.x},${sw.y},${ne.x},${ne.y}&WIDTH=${sz.x}&HEIGHT=${sz.y}&I=${Math.round(e.containerPoint.x)}&J=${Math.round(e.containerPoint.y)}&INFO_FORMAT=application/json`;
  return fetch(u).then(r=>r.json()).then(j=>{const v=j.features&&j.features[0]&&j.features[0].properties.GRAY_INDEX;return v==null?null:v;}).catch(()=>undefined);
}
function depthAt(k,e){
  const m=A.map,crs=m.options.crs,b=m.getBounds(),sw=crs.project(b.getSouthWest()),ne=crs.project(b.getNorthEast()),sz=m.getSize();
  const u=`${LIWO}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=${lname(k)}&QUERY_LAYERS=${lname(k)}&STYLES=&CRS=EPSG:3857&BBOX=${sw.x},${sw.y},${ne.x},${ne.y}&WIDTH=${sz.x}&HEIGHT=${sz.y}&I=${Math.round(e.containerPoint.x)}&J=${Math.round(e.containerPoint.y)}&INFO_FORMAT=application/json`;
  return fetch(u).then(r=>r.json()).then(j=>{const v=j.features&&j.features[0]&&j.features[0].properties.GRAY_INDEX;return v==null||v<=0.02?0:v;}).catch(()=>null);
}

// ── AHN-Geländemodell ──
const geotiff=()=>A.geotiff();
async function loadDem(){
  const m=A.map,b=m.getBounds(),c=[A.toRD(b.getSouth(),b.getWest()),A.toRD(b.getSouth(),b.getEast()),A.toRD(b.getNorth(),b.getWest()),A.toRD(b.getNorth(),b.getEast())];
  const x0=Math.floor(Math.min(...c.map(p=>p[0]))),x1=Math.ceil(Math.max(...c.map(p=>p[0]))),y0=Math.floor(Math.min(...c.map(p=>p[1]))),y1=Math.ceil(Math.max(...c.map(p=>p[1])));
  const key=[x0,y0,x1,y1].join(',');if(W.dem&&W.demKey===key)return W.dem;
  const sz=m.getSize(),Wd=Math.max(64,Math.min(1100,Math.round(sz.x*.75))),Hd=Math.max(64,Math.round(Wd*(y1-y0)/(x1-x0)));
  A.status(T('Höhenmodell (AHN) wird geladen …','Loading elevation model (AHN) …','Hoogtemodel (AHN) laden …'),true);
  const [G,buf]=await Promise.all([geotiff(),fetch(`https://service.pdok.nl/rws/ahn/wcs/v1_0?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=dtm_05m&FORMAT=image/tiff&SUBSET=x(${x0},${x1})&SUBSET=y(${y0},${y1})&SCALESIZE=x(${Wd}),y(${Hd})`).then(r=>{if(!r.ok)throw new Error('AHN '+r.status);return r.arrayBuffer();})]);
  const tiff=await G.fromArrayBuffer(buf),im=await tiff.getImage(),r=await im.readRasters(),z=r[0],w=im.getWidth(),h=im.getHeight();
  let lo=Infinity,hi=-Infinity;const vals=[];for(let i=0;i<z.length;i++){const v=z[i];if(v>-50&&v<400){if(v<lo)lo=v;if(v>hi)hi=v;if(i%7===0)vals.push(v);}}
  vals.sort((p,q)=>p-q);
  W.dem={z,w,h,x0,y0,x1,y1,lo,hi,med:vals.length?vals[vals.length>>1]:null,dx:(x1-x0)/w,dy:(y1-y0)/h};W.demKey=key;W.img=null;A.status('');
  return W.dem;
}
const ELEV=[[-4,[40,52,70]],[-1,[86,104,104]],[0,[128,140,118]],[1,[176,172,132]],[2,[214,201,156]],[4,[234,220,186]],[8,[246,240,224]],[30,[255,255,255]]];
function paint(){
  const D=W.dem;if(!D)return null;
  const c=W.img||document.createElement('canvas');c.width=D.w;c.height=D.h;const g=c.getContext('2d'),id=g.createImageData(D.w,D.h),z=D.z,L=W.level;let below=0,valid=0;
  for(let j=0;j<D.h;j++)for(let i=0;i<D.w;i++){const k=j*D.w+i,v=z[k],p=k*4;
    if(!(v>-50&&v<400)){id.data[p]=226;id.data[p+1]=221;id.data[p+2]=212;id.data[p+3]=150;continue;}            // Gebäude/keine Messung
    valid++;
    const vx=z[k+(i<D.w-1?1:0)]-z[k-(i>0?1:0)],vy=z[k+(j<D.h-1?D.w:0)]-z[k-(j>0?D.w:0)];
    const gx=(vx>-50&&vx<400?vx:0)/(2*D.dx),gy=(vy>-50&&vy<400?vy:0)/(2*D.dy),sh=Math.max(.55,Math.min(1.2,1+(-gx*.7+gy*.7)*.9));   // Schummerung von Nordwesten
    let col=A.ramp(ELEV,v).map(x=>Math.min(255,x*sh));
    if(v<L){below++;const d=Math.min(1,(L-v)/3),wcol=[36+20*(1-d),104-40*d,168-30*d],a=.55+.35*d;col=col.map((x,n)=>x*(1-a)+wcol[n]*a);}
    id.data[p]=col[0];id.data[p+1]=col[1];id.data[p+2]=col[2];id.data[p+3]=225;}
  g.putImageData(id,0,0);W.img=c;W.below=valid?below/valid:0;return c;
}
function demAt(lat,lon){const D=W.dem;if(!D)return null;const [x,y]=A.toRD(lat,lon),i=Math.floor((x-D.x0)/D.dx),j=Math.floor((D.y1-y)/D.dy);if(i<0||j<0||i>=D.w||j>=D.h)return null;const v=D.z[j*D.w+i];return v>-50&&v<400?v:NaN;}

// ── Starkregen: wo Wasser stehen bleibt ──
const RN={key:'',g:null,img:null,t:1,playing:false,stats:null,kp:null,kpLoad:null,busy:false,err:null};
const KP='https://services-eu1.arcgis.com/SMnoOtmU2UWf0vRp/arcgis/rest/services/Klimaatknelpuntenkaart_Utrecht_WFL1/FeatureServer/';
function knelpunten(){   // Gemeente Utrecht: 0 = Straßen unpassierbar, 2 = Schäden an Gebäuden (Wasser); 1 = Hitze
  if(!RN.kpLoad)RN.kpLoad=Promise.all([0,2,1].map(l=>fetch(`${KP}${l}/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`).then(r=>r.json()).then(j=>(j.features||[]).map(f=>({l,name:String((f.properties||{}).Opmerkingen||'').replace(/,\s*(urgentie|ambitie)$/i,''),urg:((f.properties||{}).urg_amb||'urgentie').toLowerCase(),
    rings:(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).map(p=>p[0].map(([x,y])=>A.w20(y,x)))}))).catch(()=>[])))
    .then(a=>{RN.kp=a.flat();A.req();A.rerender();return RN.kp;});
  return RN.kpLoad;
}
// Priority-Flood (Barnes et al. 2014): Rand und Gewässer sind Abfluss, Gebäude Wände; Füllhöhe − Gelände = Mulde
function fillSinks(z,w,h,wall,out){
  const n=w*h,F=new Float32Array(n),done=new Uint8Array(n),HK=new Float32Array(n+8),HI=new Int32Array(n+8);let hs=0;
  const push=(k,i)=>{let c=hs++;while(c>0){const p=(c-1)>>1;if(HK[p]<=k)break;HK[c]=HK[p];HI[c]=HI[p];c=p;}HK[c]=k;HI[c]=i;};
  const pop=()=>{const r=HI[0],k=HK[--hs],i=HI[hs];let c=0;for(;;){let l=2*c+1;if(l>=hs)break;if(l+1<hs&&HK[l+1]<HK[l])l++;if(HK[l]>=k)break;HK[c]=HK[l];HI[c]=HI[l];c=l;}HK[c]=k;HI[c]=i;return r;};
  for(let i=0;i<n;i++){const x=i%w,y=(i/w)|0;if(x===0||y===0||x===w-1||y===h-1||out[i]){F[i]=z[i];done[i]=1;push(z[i],i);}}
  const D=[-1,1,-w,w,-w-1,-w+1,w-1,w+1];
  while(hs){const c=pop(),cx=c%w,fc=F[c];
    for(let d=0;d<8;d++){const nb=c+D[d];if(nb<0||nb>=n||done[nb])continue;const nx=nb%w;if(Math.abs(nx-cx)>1)continue;
      done[nb]=1;const zz=wall[nb]?z[nb]+40:z[nb];F[nb]=zz>fc?zz:fc;push(F[nb],nb);}}
  return F;
}
// Muldentiefe: Gebäude stauen Wasser höchstens 10 cm über das, was das Gelände allein hält —
// sonst würden geschlossene Innenhöfe rechnerisch bis zur Dachhöhe volllaufen.
function sinkDepth(z,w,h,wall,out){
  const F1=fillSinks(z,w,h,wall,out),F2=fillSinks(z,w,h,new Uint8Array(w*h),out),n=w*h,dep=new Float32Array(n);
  for(let i=0;i<n;i++)dep[i]=wall[i]||out[i]?0:Math.max(0,Math.min(F1[i],F2[i]+.1)-z[i]);
  return dep;
}
async function loadRain(){
  const m=A.map;if(m.getZoom()<16)return null;
  const b=m.getBounds(),c=[A.toRD(b.getSouth(),b.getWest()),A.toRD(b.getSouth(),b.getEast()),A.toRD(b.getNorth(),b.getWest()),A.toRD(b.getNorth(),b.getEast())];
  const x0=Math.floor(Math.min(...c.map(p=>p[0]))/10)*10,x1=Math.ceil(Math.max(...c.map(p=>p[0]))/10)*10,y0=Math.floor(Math.min(...c.map(p=>p[1]))/10)*10,y1=Math.ceil(Math.max(...c.map(p=>p[1]))/10)*10;
  const key=[x0,y0,x1,y1].join(',');if(RN.g&&RN.key===key)return RN.g;
  const res=Math.max(.5,Math.max(x1-x0,y1-y0)/900),w=Math.round((x1-x0)/res),h=Math.round((y1-y0)/res);
  A.status(T('Gelände (AHN) und Gebäude für Starkregen werden geladen …','Loading terrain (AHN) and buildings for heavy rain …','Maaiveld (AHN) en gebouwen voor hevige neerslag laden …'),true);
  const bb=L.latLngBounds([b.getSouth(),b.getWest()],[b.getNorth(),b.getEast()]);
  const [G,buf,blds]=await Promise.all([A.geotiff(),fetch(`https://service.pdok.nl/rws/ahn/wcs/v1_0?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=dtm_05m&FORMAT=image/tiff&SUBSET=x(${x0},${x1})&SUBSET=y(${y0},${y1})&SCALESIZE=x(${w}),y(${h})`).then(r=>{if(!r.ok)throw new Error('AHN '+r.status);return r.arrayBuffer();}),A.ensure('b',bb)]);
  const tif=await G.fromArrayBuffer(buf),im=await tif.getImage(),Z=(await im.readRasters())[0],W2=im.getWidth(),H2=im.getHeight(),n=W2*H2,rx=(x1-x0)/W2,ry=(y1-y0)/H2;
  // Gebäude als Wände rastern (Grundrisse aus der 3D BAG)
  const g=A.offscreen(W2,H2,true);g.clearRect(0,0,W2,H2);g.fillStyle='#fff';
  const P=(wx,wy)=>{const ll=A.map.unproject([wx,wy],20),r=A.toRD(ll.lat,ll.lng);return [(r[0]-x0)/rx,(y1-r[1])/ry];};
  for(let j=0;j<blds.length;j+=32){g.beginPath();for(let i=j;i<Math.min(blds.length,j+32);i++){const z=blds[i].z;for(let k=0;k<z.length;k+=2){const q=P(z[k],z[k+1]);k?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]);}g.closePath();}g.fill();}
  const bm=g.getImageData(0,0,W2,H2).data,wall=new Uint8Array(n),out=new Uint8Array(n),z=new Float32Array(n);
  let lo=Infinity;for(let i=0;i<n;i++){const v=Z[i];if(v>-50&&v<400&&v<lo)lo=v;}
  const ok=i=>Z[i]>-50&&Z[i]<400,gap=new Uint8Array(n);
  for(let i=0;i<n;i++){wall[i]=bm[4*i+3]>127?1:0;if(ok(i))z[i]=Z[i];else gap[i]=1;}
  // Lücken ohne Messung: große zusammenhängende (Grachten, Kanäle, Teiche ≥ 150 m²) = Gewässer → Abfluss;
  // kleine (Autos, dichte Kronen) und unter Gebäuden aus der Umgebung auffüllen
  { const seen=new Uint8Array(n),q=new Int32Array(n),minC=Math.ceil(150/(rx*ry));
    for(let i=0;i<n;i++){if(!gap[i]||wall[i]||seen[i])continue;let qh=0,qt=0;q[qt++]=i;seen[i]=1;
      while(qh<qt){const c2=q[qh++],x=c2%W2;for(const d of [-1,1,-W2,W2]){const k=c2+d;if(k<0||k>=n||seen[k]||!gap[k]||wall[k]||Math.abs((k%W2)-x)>1)continue;seen[k]=1;q[qt++]=k;}}
      if(qt>=minC)for(let t=0;t<qt;t++){out[q[t]]=1;z[q[t]]=lo-1;}}
    let todo=[];for(let i=0;i<n;i++)if(gap[i]&&!out[i])todo.push(i);
    for(let pass=0;pass<60&&todo.length;pass++){const next=[],upd=[];
      for(const i of todo){let s2=0,c2=0;const x=i%W2;for(const d of [-1,1,-W2,W2]){const k=i+d;if(k<0||k>=n||Math.abs((k%W2)-x)>1||out[k]||gap[k])continue;s2+=z[k];c2++;}if(c2)upd.push([i,s2/c2]);else next.push(i);}
      for(const [i,v] of upd){z[i]=v;gap[i]=0;}todo=next;}
    for(const i of todo)z[i]=lo;}
  await A.yieldNow();
  const dep=sinkDepth(z,W2,H2,wall,out);
  // Mulden zusammenfassen: größte Tiefe je Mulde (für das „Volllaufen")
  const lab=new Int32Array(n).fill(-1),Dk=[];let nk=0;const q=new Int32Array(n);
  for(let i=0;i<n;i++){if(lab[i]>=0||dep[i]<.02)continue;let qh=0,qt=0,mx=0;q[qt++]=i;lab[i]=nk;
    while(qh<qt){const c2=q[qh++];if(dep[c2]>mx)mx=dep[c2];const x=c2%W2;for(const d of [-1,1,-W2,W2]){const k=c2+d;if(k<0||k>=n||lab[k]>=0||dep[k]<.02||Math.abs((k%W2)-x)>1)continue;lab[k]=nk;q[qt++]=k;}}
    Dk.push(mx);nk++;}
  // Kennzahlen
  let a10=0,a20=0,vol=0;for(let i=0;i<n;i++){const d=dep[i];if(d>=.1)a10++;if(d>=.2)a20++;vol+=d;}
  let deep=0;for(const k of Dk)if(k>=.2)deep++;
  const at=(r)=>{const i=Math.floor((r[0]-x0)/rx),j=Math.floor((y1-r[1])/ry);return i<0||j<0||i>=W2||j>=H2?0:dep[j*W2+i];};
  let bTouch=0;for(const bl of blds){const zz=bl.z;let cx=0,cy=0,np=zz.length/2-1;for(let k=0;k<zz.length-2;k+=2){cx+=zz[k];cy+=zz[k+1];}cx/=np;cy/=np;let hit=false;
    for(let k=0;k<zz.length-2&&!hit;k+=2){const vx=zz[k]-cx,vy=zz[k+1]-cy,L2=Math.hypot(vx,vy)||1,o=1.5/A.m20();const ll=A.map.unproject([zz[k]+vx/L2*o,zz[k+1]+vy/L2*o],20);if(at(A.toRD(ll.lat,ll.lng))>=.2)hit=true;}
    if(hit)bTouch++;}
  RN.g={x0,y0,x1,y1,w:W2,h:H2,rx,ry,dep,lab,Dk};RN.key=key;RN.img=null;
  RN.stats={a10:a10*rx*ry,a20:a20*rx*ry,vol:vol*rx*ry,deep,bTouch,nB:blds.length};A.status('');
  return RN.g;
}
const RCOL=[[.1,[120,178,226]],[.2,[52,120,196]],[.3,[24,72,150]],[.5,[12,40,100]]];
function paintRain(){
  const G=RN.g;if(!G)return null;const c=RN.img||document.createElement('canvas');c.width=G.w;c.height=G.h;const g=c.getContext('2d');if(!g||typeof g.createImageData!=='function')return null;
  const id=g.createImageData(G.w,G.h),t=RN.t;
  for(let i=0;i<G.dep.length;i++){let d=G.dep[i];if(d<.1)continue;if(t<1){const k=G.lab[i];d=k>=0?d-(1-t)*G.Dk[k]:0;if(d<.1)continue;}
    let cc=RCOL[0][1];if(A.bs())cc=A.waterRGB(d);else for(const [v,col] of RCOL)if(d>=v)cc=col;const p=4*i;id.data[p]=cc[0];id.data[p+1]=cc[1];id.data[p+2]=cc[2];id.data[p+3]=Math.round(170+Math.min(1,d/.4)*80);}
  g.putImageData(id,0,0);RN.img=c;return c;
}
function rainAt(lat,lon){const G=RN.g;if(!G)return null;const [x,y]=A.toRD(lat,lon),i=Math.floor((x-G.x0)/G.rx),j=Math.floor((G.y1-y)/G.ry);if(i<0||j<0||i>=G.w||j>=G.h)return null;return G.dep[j*G.w+i];}
function playRain(){if(RN.playing)return;RN.playing=true;const t0=performance.now(),dur=(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)?1:6500;
  const step=now=>{if(!RN.playing||!LAB.on||LAB.tool!=='water'||W.mode!=='rain'){RN.playing=false;return;}RN.t=Math.min(1,(now-t0)/dur);paintRain();A.req();const sl=document.getElementById('rnT');if(sl)sl.value=Math.round(RN.t*100);const sv=document.getElementById('rnV');if(sv)sv.textContent=Math.round(RN.t*100)+' %';
    if(RN.t<1)requestAnimationFrame(step);else{RN.playing=false;A.rerender();}};
  RN.t=0;requestAnimationFrame(step);}
const kpIn=()=>{if(!RN.kp)return [];const b=A.map.getBounds(),nw=A.w20(b.getNorth(),b.getWest()),se=A.w20(b.getSouth(),b.getEast());return RN.kp.filter(k=>k.rings.some(r=>r.some(p=>p[0]>=nw[0]&&p[0]<=se[0]&&p[1]>=nw[1]&&p[1]<=se[1])));};
const KPN=l=>l===0?T('Straße bei Starkregen unpassierbar','Road impassable in heavy rain','Weg onbegaanbaar bij hevige neerslag'):l===2?T('Wasserschäden an Gebäuden','Water damage to buildings','Waterschade aan panden'):T('Hitzestress','Heat stress','Hittestress');

// ── Werkzeug ──
// ── Bausteine-Fassung (Test über ?bausteine=1): gleiche Funktionen, einheitliche Formen ──
// Umschalter statt Pillen, Regler mit Bezeichnung/Wert/Endwerten, eine Legende, eine Wassertiefen-Skala für 2D und 3D.
function renderBS(){
  const modes=A.seg([['rain',T('Starkregen','Heavy rain','Hevige bui')],['flood',T('Deichbruch','Dike breach','Dijkdoorbraak')],['chance',T('Zukunft','Future','Toekomst')],['terrain',T('Höhe','Height','Hoogte')]],W.mode,true);
  const fld=(lbl,inner)=>`<div class="ui-fld"><span class="ui-fl">${lbl}</span>${inner}</div>`;
  const opt=(attr,v,on,l)=>`<button ${attr}="${v}" class="${on?'on':''}" aria-pressed="${on}">${l}</button>`;
  const leg=(title,inner,src)=>`<div class="ui-legend"><b>${title}</b>${inner}<small>${src}</small></div>`;
  const sw=xs=>`<div class="ui-sw">${xs.map(([c,l,k])=>`<span><i class="${k||''}" style="${c?`background:${c}`:''}"></i>${l}</span>`).join('')}</div>`;
  if(W.mode==='rain'){const S=RN.stats,kp=kpIn().filter(k=>k.l!==1);
    return modes+(S?`<div class="ar-grid wt-rg"><div><b>${A.fmt(S.deep)}</b><span>${T('Mulden tiefer als 20 cm','hollows deeper than 20 cm','kommen dieper dan 20 cm')}</span></div><div><b>${A.fmt(S.bTouch)}</b><span>${T('Gebäude grenzen an solche Mulden','buildings border such hollows','gebouwen grenzen aan zulke kommen')}</span></div>
        <div><b>${A.fmt(S.a10)} m²</b><span>${T('Fläche mit mehr als 10 cm Wasser','area with more than 10 cm of water','oppervlak met meer dan 10 cm water')}</span></div><div><b>${A.fmt(S.vol)} m³</b><span>${T('Wasser, wenn alle Mulden voll sind','water when all hollows are full','water als alle kommen vol zijn')}</span></div></div>
      <div class="ui-sl"><div class="ui-sl-h"><span>${T('Mulden füllen sich','Hollows fill up','Kommen lopen vol')}</span><b id="rnV">${Math.round(RN.t*100)} %</b></div>
        <div class="ui-sl-r"><button class="ui-icon pri" id="rnP" aria-label="${RN.playing?T('Regen anhalten','Pause the rain','Regen pauzeren'):T('Regen abspielen','Play the rain','Regen afspelen')}">${RN.playing?'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>':'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7Z"/></svg>'}</button><input id="rnT" class="ui-range" type="range" min="0" max="100" value="${Math.round(RN.t*100)}" style="--track:${A.waterCss()}" aria-label="${T('Füllstand der Mulden','Fill level of the hollows','Vulling van de kommen')}"></div>
        <div class="ui-sl-t"><span>${T('leer','empty','leeg')}</span><span>${T('randvoll','full to the brim','tot de rand vol')}</span></div></div>`
      :RN.busy?`<p class="lab-hint"><span class="lab-spin" aria-hidden="true"></span> ${T('Mulden werden berechnet …','Computing hollows …','Kommen worden berekend …')}</p>`
      :`<p class="lab-hint">${T('Für die Mulden-Rechnung auf ein Viertel zoomen — dann zeigt das Werkzeug, wo Regenwasser stehen bleibt.','Zoom to a neighbourhood for the hollow calculation — the tool then shows where rainwater collects.','Zoom in op een buurt voor de komberekening — dan toont het gereedschap waar regenwater blijft staan.')}</p><button class="ui-btn pri" id="rnZ">${T('Hierhin heranzoomen','Zoom in here','Hier inzoomen')}</button>`)+
      leg(T('Wassertiefe','Water depth','Waterdiepte'),`<div class="ui-ramp" style="background:${A.waterCss()}"></div><div class="ui-ramp-l">${A.waterTicks()}</div>${sw([[null,T('Klimaknelpunt der Gemeente','municipal climate hotspot','klimaatknelpunt gemeente'),'kp-sw']])}`,T('Eigene Rechnung auf dem AHN-Gelände, Obergrenze · gleiche Skala wie in 3D','Own calculation on AHN terrain, upper bound · same scale as in 3D','Eigen berekening op AHN-maaiveld, bovengrens · zelfde schaal als in 3D'))+
      `${kp.length?`<div class="wt-kp">${kp.map(k=>`<p><b>${k.name}</b> · ${KPN(k.l)}${k.urg==='ambitie'?` <small>(${T('Ambition','ambition','ambitie')})</small>`:''}</p>`).join('')}</div>`:''}
      <p class="wt-warn">${T('Gezeigt ab 10 cm — Wasser in Rinnsteinen bis 10 cm ist bei Wolkenbrüchen normal. Obergrenze: Mulden im Gelände, randvoll — ohne Kanalisation, Versickerung und Gräben. Wie voll sie bei einem Wolkenbruch wirklich werden, hängt vom Regen und vom Einzugsgebiet ab. Die Knelpunte sind die amtliche Einschätzung der Gemeente Utrecht.','Shown from 10 cm — up to 10 cm in gutters is normal in cloudbursts. Upper bound: hollows in the terrain, filled to the brim — without sewers, infiltration and ditches. How full they really get in a cloudburst depends on the rain and the catchment. The hotspots are the official assessment of the Gemeente Utrecht.','Getoond vanaf 10 cm — tot 10 cm in goten is normaal bij wolkbreuken. Bovengrens: kommen in het maaiveld, tot de rand gevuld — zonder riolering, infiltratie en sloten. Hoe vol ze bij een wolkbreuk echt worden, hangt af van de bui en het stroomgebied. De knelpunten zijn de officiële inschatting van de gemeente Utrecht.')}</p>
      <p class="lab-hint">${T('Tippe auf die Karte: Wassertiefe in der Mulde an diesem Punkt.','Tap the map: water depth in the hollow at that spot.','Tik op de kaart: waterdiepte in de kom op dat punt.')}</p>`;}
  if(W.mode==='chance')return modes+fld(T('Zeitpunkt','Time horizon','Tijdshorizon'),`<div class="ui-seg" role="group" aria-label="${T('Zeitpunkt','Time horizon','Tijdshorizon')}">${YRS.map(([k,l])=>opt('data-y',k,W.yr===k,l())).join('')}</div>`)+
      fld(T('Wassertiefe mehr als','Water depth more than','Waterdiepte meer dan'),`<div class="ui-seg" role="group" aria-label="${T('Wassertiefe','Water depth','Waterdiepte')}">${CMS.map(c=>opt('data-c',c,W.cm===c,c+' cm')).join('')}</div>`)+
      `<p class="wt-cap"><b>${T('Wahrscheinlichkeit pro Jahr','Probability per year','Kans per jaar')}</b>, ${T('dass hier mehr als','that more than','dat hier meer dan')} ${W.cm} cm ${T('Wasser steht','of water stands here','water staat')} — ${W.yr==='huidig'?T('heute, mit dem aktuellen Zustand der Deiche. Bis 2050 sollen alle Primärdeiche die gesetzliche Norm erfüllen (Waterwet) — der Vergleich steht unter „2050".','today, with the current state of the dikes. By 2050 all primary dikes are to meet the legal standard (Water Act) — compare under “2050”.','nu, met de huidige staat van de dijken. In 2050 moeten alle primaire keringen aan de wettelijke norm voldoen (Waterwet) — vergelijk onder „2050".'):W.yr==='2050'?T('2050, <b>wenn alle Primärdeiche die gesetzliche Norm erfüllen</b> — ein Ziel, keine Vorhersage.','2050, <b>if all primary dikes meet the legal standard</b> — a target, not a forecast.','2050, <b>als alle primaire keringen aan de wettelijke norm voldoen</b> — een doel, geen voorspelling.'):T('2100, Deiche auf Normniveau <b>und</b> Klimawandel berücksichtigt.','2100, dikes at the legal standard <b>and</b> climate change included.','2100, dijken op normniveau <b>en</b> klimaatverandering meegenomen.')}</p>`+
      leg(T('Wahrscheinlichkeit pro Jahr','Probability per year','Kans per jaar'),sw((W.chLegend||[]).slice().reverse().map(e=>[e.c,chl(e.v)])),T('LIWO, Rijkswaterstaat · amtliche Farben','LIWO, Rijkswaterstaat · official colours','LIWO, Rijkswaterstaat · officiële kleuren'))+
      `<p class="lab-hint">${T('Tippe auf die Karte: heute, 2050 und 2100 im Vergleich.','Tap the map: today, 2050 and 2100 compared.','Tik op de kaart: nu, 2050 en 2100 vergeleken.')}</p>`;
  if(W.mode==='flood'){const c=CLS.find(x=>x.k===W.k);
    return modes+fld(T('Etwa einmal in … Jahren','About once in … years','Ongeveer eens per … jaar'),`<div class="ui-seg tight" role="group" aria-label="${T('Wahrscheinlichkeit','Probability','Kans')}">${CLS.map(x=>opt('data-k',x.k,x.k===W.k,fmtP(x.p))).join('')}</div>`)+
      `<p class="wt-cap"><b>${per(c.p)}</b> · ${c.n[A.lang()==='en'?1:A.lang()==='nl'?2:0]} (LIWO). ${T('Maximale Wassertiefe, wenn Deiche brechen oder Gewässer über die Ufer treten.','Maximum water depth if dikes breach or waters overflow.','Maximale waterdiepte bij een dijkdoorbraak of buiten de oevers tredend water.')}</p>`+
      leg(T('Maximale Wassertiefe','Maximum water depth','Maximale waterdiepte'),sw((W.legend||[]).map(e=>[e.c,e.l.replace('.',A.lang()==='en'?'.':',').replace('.',A.lang()==='en'?'.':',')+' m'])),T('LIWO, Rijkswaterstaat · amtliche Farben','LIWO, Rijkswaterstaat · official colours','LIWO, Rijkswaterstaat · officiële kleuren'))+
      `<p class="lab-hint">${T('Tippe auf die Karte: Wassertiefe an diesem Punkt in allen fünf Szenarien.','Tap the map: water depth at that spot in all five scenarios.','Tik op de kaart: waterdiepte op dat punt in alle vijf scenario\'s.')}</p>`;}
  const D=W.dem;
  return modes+`<div class="ui-sl"><div class="ui-sl-h"><label for="wtL">${T('Wasserstand','Water level','Waterstand')}</label><b id="wtV">${A.nf(W.level,1)} m NAP</b></div><input id="wtL" class="ui-range" type="range" min="-3" max="6" step="0.1" value="${W.level}"><div class="ui-sl-t"><span>−3 m</span><span>+6 m</span></div></div>`+
    fld(T('Schnellwahl','Quick pick','Snelkeuze'),`<div class="ui-seg" role="group" aria-label="${T('Schnellwahl Wasserstand','Quick pick water level','Snelkeuze waterstand')}">${[0,1,2,5].map(v=>opt('data-l',v,Math.abs(W.level-v)<.05,`${v>0?'+':''}${v} m`)).join('')}</div>`)+
    `<p class="wt-cap" id="wtS">${D?`${T('Gelände hier','Terrain here','Maaiveld hier')}: ${A.nf(D.lo,1)} ${T('bis','to','tot')} ${A.nf(D.hi,1)} m NAP · ${T('Mitte','median','mediaan')} ${A.nf(D.med,1)} m. <b>${Math.round(100*(W.below||0))} %</b> ${T('des Ausschnitts liegen tiefer als der gewählte Wasserstand.','of the view lie below the chosen water level.','van het beeld ligt lager dan de gekozen waterstand.')}`:T('Zoome auf einen Stadtteil (ab Zoom 14), um das Höhenmodell zu laden.','Zoom to a district (level 14+) to load the elevation model.','Zoom in op een wijk (vanaf niveau 14) om het hoogtemodel te laden.')}</p>`+
    leg(T('Geländehöhe','Ground height','Maaiveldhoogte'),`<div class="ui-ramp" style="background:${A.grad(ELEV.slice(0,7),-4,8)}"></div><div class="ui-ramp-l"><span>−4 m</span><span>NAP 0</span><span>+8 m</span></div>`,'AHN')+
    `<p class="wt-warn">${T('Gedankenexperiment: zeigt nur, welches Gelände tiefer liegt als der Wasserstand — ohne Deiche, Pumpwerke und Kanäle. Das echte Risiko zeigt die amtliche Karte „Überflutung".','Thought experiment: shows only which ground lies lower than the water level — without dikes, pumping stations and canals. The real risk is in the official “Flooding” map.','Gedachte-experiment: toont alleen welk maaiveld lager ligt dan de waterstand — zonder dijken, gemalen en kanalen. Het echte risico staat op de officiële kaart „Overstroming".')}</p>`;
}
LAB.addTool({id:'water',order:4,gate:false,keepStatus:true,
  icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 9c1.7-1.6 3.3-1.6 5 0s3.3 1.6 5 0 3.3-1.6 5 0 3.3 1.6 5 0"/><path d="M2 15c1.7-1.6 3.3-1.6 5 0s3.3 1.6 5 0 3.3-1.6 5 0 3.3 1.6 5 0"/></svg>',
  label:()=>T('Wasser','Water','Water'),
  sub:()=>W.mode==='rain'?T('Starkregen: wo Wasser stehen bleibt','Heavy rain: where water collects','Hevige neerslag: waar water blijft staan'):W.mode==='flood'?T('Amtliche Überflutungstiefen','Official flood depths','Officiële overstromingsdiepten'):W.mode==='chance'?T('Überflutungswahrscheinlichkeit heute, 2050, 2100','Flood probability today, 2050, 2100','Overstromingskans nu, 2050, 2100'):T('Geländehöhe und Wasserstand','Terrain height and water level','Maaiveldhoogte en waterstand'),
  enter(){showLayer();knelpunten();Promise.all([legend(),chLegend()]).then(()=>A.rerender());},
  leave(){if(W.layer){A.map.removeLayer(W.layer);W.layer=null;}},
  render(){
    if(A.bs())return renderBS();
    const modes=A.seg([['rain',T('Starkregen','Heavy rain','Hevige bui')],['flood',T('Deichbruch','Dike breach','Dijkdoorbraak')],['chance',T('Zukunft','Future','Toekomst')],['terrain',T('Höhe','Height','Hoogte')]],W.mode);
    if(W.mode==='rain'){const S=RN.stats,kp=kpIn().filter(k=>k.l!==1);
      return modes+(S?`<div class="ar-grid wt-rg"><div><b>${A.fmt(S.deep)}</b><span>${T('Mulden tiefer als 20 cm','hollows deeper than 20 cm','kommen dieper dan 20 cm')}</span></div><div><b>${A.fmt(S.bTouch)}</b><span>${T('Gebäude grenzen an solche Mulden','buildings border such hollows','gebouwen grenzen aan zulke kommen')}</span></div>
        <div><b>${A.fmt(S.a10)} m²</b><span>${T('Fläche mit mehr als 10 cm Wasser','area with more than 10 cm of water','oppervlak met meer dan 10 cm water')}</span></div><div><b>${A.fmt(S.vol)} m³</b><span>${T('Wasser, wenn alle Mulden voll sind','water when all hollows are full','water als alle kommen vol zijn')}</span></div></div>
        <div class="wt-play"><button class="lab-play" id="rnP" aria-label="${T('Regen abspielen','Play the rain','Regen afspelen')}">${RN.playing?'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>':'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7Z"/></svg>'}</button><input id="rnT" type="range" min="0" max="100" value="${Math.round(RN.t*100)}" aria-label="${T('Füllstand der Mulden','Fill level of the hollows','Vulling van de kommen')}"><span>${T('Mulden laufen voll','hollows fill up','kommen lopen vol')}</span></div>`
        :RN.busy?`<p class="lab-hint"><span class="lab-spin" aria-hidden="true"></span> ${T('Mulden werden berechnet …','Computing hollows …','Kommen worden berekend …')}</p>`
        :`<p class="lab-hint">${T('Für die Mulden-Rechnung auf ein Viertel zoomen — dann zeigt das Werkzeug, wo Regenwasser stehen bleibt.','Zoom to a neighbourhood for the hollow calculation — the tool then shows where rainwater collects.','Zoom in op een buurt voor de komberekening — dan toont het gereedschap waar regenwater blijft staan.')}</p><button class="cta lab-mini" id="rnZ">${T('Hierhin heranzoomen','Zoom in here','Hier inzoomen')}</button>`)+
        `<div class="lab-legw"><div class="wt-leg">${[['10–20 cm',RCOL[0][1]],['20–30 cm',RCOL[1][1]],['30–50 cm',RCOL[2][1]],['> 50 cm',RCOL[3][1]]].map(([l,c])=>`<span><i style="background:rgb(${c.join(',')})"></i>${l}</span>`).join('')}<span><i class="kp-sw"></i>${T('Klimaknelpunt der Gemeente','municipal climate hotspot','klimaatknelpunt gemeente')}</span></div></div>
        ${kp.length?`<div class="wt-kp">${kp.map(k=>`<p><b>${k.name}</b> · ${KPN(k.l)}${k.urg==='ambitie'?` <small>(${T('Ambition','ambition','ambitie')})</small>`:''}</p>`).join('')}</div>`:''}
        <p class="wt-warn">${T('Gezeigt ab 10 cm — Wasser in Rinnsteinen bis 10 cm ist bei Wolkenbrüchen normal. Obergrenze: Mulden im Gelände, randvoll — ohne Kanalisation, Versickerung und Gräben. Wie voll sie bei einem Wolkenbruch wirklich werden, hängt vom Regen und vom Einzugsgebiet ab. Die Knelpunte sind die amtliche Einschätzung der Gemeente Utrecht.','Shown from 10 cm — up to 10 cm in gutters is normal in cloudbursts. Upper bound: hollows in the terrain, filled to the brim — without sewers, infiltration and ditches. How full they really get in a cloudburst depends on the rain and the catchment. The hotspots are the official assessment of the Gemeente Utrecht.','Getoond vanaf 10 cm — tot 10 cm in goten is normaal bij wolkbreuken. Bovengrens: kommen in het maaiveld, tot de rand gevuld — zonder riolering, infiltratie en sloten. Hoe vol ze bij een wolkbreuk echt worden, hangt af van de bui en het stroomgebied. De knelpunten zijn de officiële inschatting van de gemeente Utrecht.')}</p>
        <p class="lab-hint">${T('Tippe auf die Karte: Wassertiefe in der Mulde an diesem Punkt.','Tap the map: water depth in the hollow at that spot.','Tik op de kaart: waterdiepte in de kom op dat punt.')}</p>`;}
    if(W.mode==='chance')return modes+`<div class="wt-chips" role="group" aria-label="${T('Zeitpunkt','Time horizon','Tijdshorizon')}">${YRS.map(([k,l])=>`<button data-y="${k}" class="${W.yr===k?'on':''}" aria-pressed="${W.yr===k}">${l()}</button>`).join('')}</div>
      <div class="wt-chips" role="group" aria-label="${T('Wassertiefe','Water depth','Waterdiepte')}">${CMS.map(c=>`<button data-c="${c}" class="${W.cm===c?'on':''}" aria-pressed="${W.cm===c}">&gt; ${c} cm</button>`).join('')}</div>
      <p class="wt-cap"><b>${T('Wahrscheinlichkeit pro Jahr','Probability per year','Kans per jaar')}</b>, ${T('dass hier mehr als','that more than','dat hier meer dan')} ${W.cm} cm ${T('Wasser steht','of water stands here','water staat')} — ${W.yr==='huidig'?T('heute, mit dem aktuellen Zustand der Deiche. Bis 2050 sollen alle Primärdeiche die gesetzliche Norm erfüllen (Waterwet) — der Vergleich steht unter „2050".','today, with the current state of the dikes. By 2050 all primary dikes are to meet the legal standard (Water Act) — compare under “2050”.','nu, met de huidige staat van de dijken. In 2050 moeten alle primaire keringen aan de wettelijke norm voldoen (Waterwet) — vergelijk onder „2050".'):W.yr==='2050'?T('2050, <b>wenn alle Primärdeiche die gesetzliche Norm erfüllen</b> — ein Ziel, keine Vorhersage.','2050, <b>if all primary dikes meet the legal standard</b> — a target, not a forecast.','2050, <b>als alle primaire keringen aan de wettelijke norm voldoen</b> — een doel, geen voorspelling.'):T('2100, Deiche auf Normniveau <b>und</b> Klimawandel berücksichtigt.','2100, dikes at the legal standard <b>and</b> climate change included.','2100, dijken op normniveau <b>en</b> klimaatverandering meegenomen.')}</p>
      <div class="lab-legw"><div class="wt-leg wt-leg-c">${(W.chLegend||[]).slice().reverse().map(e=>`<span><i style="background:${e.c}"></i>${chl(e.v)}</span>`).join('')}</div></div>
      <p class="lab-hint">${T('Tippe auf die Karte: heute, 2050 und 2100 im Vergleich.','Tap the map: today, 2050 and 2100 compared.','Tik op de kaart: nu, 2050 en 2100 vergeleken.')}</p>`;
    if(W.mode==='flood'){const c=CLS.find(x=>x.k===W.k);
      return modes+`<div class="wt-cls" role="group" aria-label="${T('Wahrscheinlichkeit','Probability','Kans')}">${CLS.map(x=>`<button data-k="${x.k}" class="${x.k===W.k?'on':''}" aria-pressed="${x.k===W.k}"><b>1/${fmtP(x.p)}</b><span>${T('pro Jahr','per year','per jaar')}</span></button>`).join('')}</div>
        <p class="wt-cap"><b>${per(c.p)}</b> · ${c.n[A.lang()==='en'?1:A.lang()==='nl'?2:0]} (LIWO). ${T('Maximale Wassertiefe, wenn Deiche brechen oder Gewässer über die Ufer treten.','Maximum water depth if dikes breach or waters overflow.','Maximale waterdiepte bij een dijkdoorbraak of buiten de oevers tredend water.')}</p>
        <div class="lab-legw"><div class="wt-leg">${(W.legend||[]).map(e=>`<span><i style="background:${e.c}"></i>${e.l.replace('.',A.lang()==='en'?'.':',').replace('.',A.lang()==='en'?'.':',')} m</span>`).join('')}</div></div>
        <p class="lab-hint">${T('Tippe auf die Karte: Wassertiefe an diesem Punkt in allen fünf Szenarien.','Tap the map: water depth at that spot in all five scenarios.','Tik op de kaart: waterdiepte op dat punt in alle vijf scenario\'s.')}</p>`;}
    const D=W.dem;
    return modes+`<div class="wt-lvl"><label for="wtL">${T('Wasserstand','Water level','Waterstand')}</label><input id="wtL" type="range" min="-3" max="6" step="0.1" value="${W.level}"><b id="wtV">${A.nf(W.level,1)} m NAP</b></div>
      <div class="wt-chips">${[0,1,2,5].map(v=>`<button data-l="${v}" class="${Math.abs(W.level-v)<.05?'on':''}">${v>0?'+':''}${v} m</button>`).join('')}</div>
      <p class="wt-cap" id="wtS">${D?`${T('Gelände hier','Terrain here','Maaiveld hier')}: ${A.nf(D.lo,1)} ${T('bis','to','tot')} ${A.nf(D.hi,1)} m NAP · ${T('Mitte','median','mediaan')} ${A.nf(D.med,1)} m. <b>${Math.round(100*(W.below||0))} %</b> ${T('des Ausschnitts liegen tiefer als der gewählte Wasserstand.','of the view lie below the chosen water level.','van het beeld ligt lager dan de gekozen waterstand.')}`:T('Zoome auf einen Stadtteil (ab Zoom 14), um das Höhenmodell zu laden.','Zoom to a district (level 14+) to load the elevation model.','Zoom in op een wijk (vanaf niveau 14) om het hoogtemodel te laden.')}</p>
      <div class="lab-legw"><div class="lab-ramp" style="background:${A.grad(ELEV.slice(0,7),-4,8)}"></div><div class="lab-rl"><span>−4 m</span><span>NAP 0</span><span>+8 m</span></div></div>
      <p class="wt-warn">${T('Gedankenexperiment: zeigt nur, welches Gelände tiefer liegt als der Wasserstand — ohne Deiche, Pumpwerke und Kanäle. Das echte Risiko zeigt die amtliche Karte „Überflutung".','Thought experiment: shows only which ground lies lower than the water level — without dikes, pumping stations and canals. The real risk is in the official “Flooding” map.','Gedachte-experiment: toont alleen welk maaiveld lager ligt dan de waterstand — zonder dijken, gemalen en kanalen. Het echte risico staat op de officiële kaart „Overstroming".')}</p>`;
  },
  bind(root){
    root.querySelectorAll('[data-m]').forEach(el=>el.onclick=()=>{W.mode=el.dataset.m;showLayer();A.rerender();A.refresh();});
    root.querySelectorAll('[data-k]').forEach(el=>el.onclick=()=>{W.k=+el.dataset.k;showLayer();A.rerender();});
    root.querySelectorAll('[data-y]').forEach(el=>el.onclick=()=>{W.yr=el.dataset.y;showLayer();A.rerender();});
    root.querySelectorAll('[data-c]').forEach(el=>el.onclick=()=>{W.cm=+el.dataset.c;showLayer();A.rerender();});
    const sl=root.querySelector('#wtL');if(sl)sl.oninput=()=>{W.level=+sl.value;root.querySelector('#wtV').textContent=A.nf(W.level,1)+' m NAP';paint();A.req();const s=root.querySelector('#wtS b');if(s)s.textContent=Math.round(100*(W.below||0))+' %';root.querySelectorAll('[data-l]').forEach(b=>{const on=Math.abs(W.level-+b.dataset.l)<.05;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);});};
    root.querySelectorAll('[data-l]').forEach(el=>el.onclick=()=>{W.level=+el.dataset.l;paint();A.rerender();A.req();});
    const rz=root.querySelector('#rnZ');if(rz)rz.onclick=()=>A.map.setZoom(16.5);
    const rp=root.querySelector('#rnP');if(rp)rp.onclick=()=>{if(RN.playing){RN.playing=false;A.rerender();}else{playRain();A.rerender();}};
    const rt=root.querySelector('#rnT');if(rt)rt.oninput=()=>{RN.playing=false;RN.t=+rt.value/100;const v=root.querySelector('#rnV');if(v)v.textContent=Math.round(RN.t*100)+' %';paintRain();A.req();};
  },
  async load(){
    if(W.mode==='rain'){knelpunten();if(A.map.getZoom()<16){RN.g=null;RN.stats=null;A.status('');A.rerender();return;}
      RN.busy=true;A.rerender();try{await loadRain();paintRain();}catch(e){A.status(T('Höhenmodell gerade nicht erreichbar.','Elevation model currently unavailable.','Hoogtemodel momenteel niet bereikbaar.'));}RN.busy=false;A.rerender();A.req();return;}
    if(W.mode!=='terrain'){A.status('');return;}
    if(A.map.getZoom()<14){W.dem=null;A.status(T('Für das Höhenmodell näher heranzoomen (ab Zoom 14).','Zoom in further for the elevation model (level 14+).','Zoom verder in voor het hoogtemodel (vanaf niveau 14).'));A.rerender();return;}
    try{await loadDem();paint();A.rerender();}catch(e){A.status(T('Höhenmodell gerade nicht erreichbar.','Elevation model currently unavailable.','Hoogtemodel momenteel niet bereikbaar.'));}
  },
  draw(g,X){
    const dark=A.dark();
    if(W.mode==='rain'){const G=RN.g;
      if(G&&RN.img){const P=(x,y)=>{const ll=A.fromRD(x,y),q=A.w20(ll[0],ll[1]);return [q[0]*X.k-X.ox,q[1]*X.k-X.oy];},tl=P(G.x0,G.y1),tr=P(G.x1,G.y1),bl=P(G.x0,G.y0);
        g.save();g.imageSmoothingEnabled=true;g.setTransform((tr[0]-tl[0])/G.w,(tr[1]-tl[1])/G.w,(bl[0]-tl[0])/G.h,(bl[1]-tl[1])/G.h,tl[0],tl[1]);g.drawImage(RN.img,0,0);g.restore();}
      if(RN.kp){g.save();g.lineWidth=2.2*X.sc;g.setLineDash([7*X.sc,5*X.sc]);for(const k of RN.kp){if(k.l===1)continue;g.strokeStyle=k.l===2?'#b0302a':'#c46b1a';g.fillStyle=k.l===2?'rgba(176,48,42,.08)':'rgba(196,107,26,.08)';
        g.beginPath();for(const r of k.rings){r.forEach((p,i)=>{const x=p[0]*X.k-X.ox,y=p[1]*X.k-X.oy;i?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();}g.fill();g.stroke();}g.restore();
        if(A.map.getZoom()>=14)for(const k of kpIn()){if(k.l===1)continue;const r=k.rings[0];let cx=0,cy=0;r.forEach(p=>{cx+=p[0];cy+=p[1];});cx/=r.length;cy/=r.length;A.label(g,k.name,cx*X.k-X.ox,cy*X.k-X.oy,X.sc,k.l===2?'#b0302a':'#c46b1a');}}
      if(!A.tooFar()&&A.B.list.length)A.drawBuildings(g,X,dark?'rgba(60,56,66,.55)':'rgba(251,249,244,.6)',dark?'rgba(255,255,255,.3)':'rgba(23,21,28,.35)');
      return;}
    if(W.mode==='terrain'&&W.dem&&W.img){const D=W.dem,P=(x,y)=>{const ll=A.fromRD(x,y),q=A.w20(ll[0],ll[1]);return [q[0]*X.k-X.ox,q[1]*X.k-X.oy];};
      const tl=P(D.x0,D.y1),tr=P(D.x1,D.y1),bl=P(D.x0,D.y0);
      g.save();g.imageSmoothingEnabled=true;g.setTransform((tr[0]-tl[0])/D.w,(tr[1]-tl[1])/D.w,(bl[0]-tl[0])/D.h,(bl[1]-tl[1])/D.h,tl[0],tl[1]);g.drawImage(W.img,0,0);g.restore();}
    if(!A.tooFar()&&A.B.list.length)A.drawBuildings(g,X,W.mode==='terrain'?(dark?'rgba(60,56,66,.5)':'rgba(240,236,228,.55)'):null,dark?'rgba(255,255,255,.3)':'rgba(23,21,28,.35)');
  },
  click(e){
    if(W.mode==='rain'){const d=rainAt(e.latlng.lat,e.latlng.lng),[wx,wy]=A.w20(e.latlng.lat,e.latlng.lng),k=(RN.kp||[]).find(k2=>k2.l!==1&&k2.rings.some(r=>{const z=new Float64Array(r.length*2);r.forEach((p,i)=>{z[2*i]=p[0];z[2*i+1]=p[1];});return A.inPoly(wx,wy,z);}));
      if(d==null&&!k)return null;
      return `${d!=null?(d>=.05?`<b>${A.nf(d*100,0)} cm</b> ${T('Wasser, wenn die Mulde voll ist','of water when the hollow is full','water als de kom vol is')}`:T('keine Mulde — Wasser fließt hier ab','no hollow — water drains away here','geen kom — water stroomt hier weg')):''}${k?`<small><b>${k.name}</b>: ${KPN(k.l)} (Gemeente Utrecht)</small>`:''}<small>AHN · 3D BAG</small>`;}
    if(W.mode==='terrain'){const v=demAt(e.latlng.lat,e.latlng.lng);if(v==null)return null;
      if(isNaN(v))return `${T('Gebäude oder keine Messung','Building or no measurement','Gebouw of geen meting')}<small>AHN ${T('misst das Gelände ohne Gebäude','measures the ground without buildings','meet het maaiveld zonder gebouwen')}</small>`;
      return `${T('Gelände','Ground','Maaiveld')} <b>${A.nf(v,2)} m</b> NAP<small>${v<W.level?`${A.nf(W.level-v,2)} m ${T('unter dem gewählten Wasserstand','below the chosen water level','onder de gekozen waterstand')}`:`${A.nf(v-W.level,2)} m ${T('über dem gewählten Wasserstand','above the chosen water level','boven de gekozen waterstand')}`} · AHN</small>`;}
    if(W.mode==='chance')return Promise.all(YRS.map(([y])=>infoAt(chName(y,W.cm),e))).then(vs=>{
      if(vs.every(v=>v===undefined))return T('Überflutungsdaten gerade nicht erreichbar.','Flood data currently unavailable.','Overstromingsdata momenteel niet bereikbaar.');
      const lab=v=>{if(v==null||v<1)return T('nicht erfasst / sehr unwahrscheinlich','not mapped / very unlikely','niet in kaart / zeer onwaarschijnlijk');return chl(Math.round(v));};
      return `<b>&gt; ${W.cm} cm ${T('Wasser','water','water')}</b><table class="wt-tab">${YRS.map(([y,l],i)=>`<tr class="${y===W.yr?'on':''}"><th>${l()}</th><td>${lab(vs[i])}</td></tr>`).join('')}</table><small>${T('2050: alle Primärdeiche auf Normniveau · 2100: dazu Klimawandel · LIWO','2050: all primary dikes at standard · 2100: plus climate change · LIWO','2050: alle primaire keringen op norm · 2100: plus klimaatverandering · LIWO')}</small>`;});
    return Promise.all(CLS.map(c=>depthAt(c.k,e))).then(ds=>{
      if(ds.every(d=>d==null))return T('Überflutungsdaten gerade nicht erreichbar.','Flood data currently unavailable.','Overstromingsdata momenteel niet bereikbaar.');
      return `<b>${T('Wassertiefe hier','Water depth here','Waterdiepte hier')}</b><table class="wt-tab">${CLS.map((c,i)=>`<tr class="${c.k===W.k?'on':''}"><th>1/${fmtP(c.p)}</th><td>${ds[i]==null?'—':ds[i]===0?T('trocken','dry','droog'):A.nf(ds[i],2)+' m'}</td></tr>`).join('')}</table><small>${T('pro Jahr · LIWO, Rijkswaterstaat','per year · LIWO, Rijkswaterstaat','per jaar · LIWO, Rijkswaterstaat')}</small>`;});
  },
  note:()=>W.mode==='rain'?T('Geländemodell AHN (dtm_05m, ohne Gebäude) im Kartenausschnitt; Gebäudegrundrisse der 3D BAG werden als Wände eingesetzt, Flächen ohne Messung (Gewässer) als Abfluss. Mit dem Priority-Flood-Verfahren wird jede Mulde bis zu ihrem Überlaufpunkt gefüllt; Tiefe = Füllhöhe − Gelände. Gebäude stauen höchstens 10 cm zusätzlich (sonst liefen geschlossene Innenhöfe rechnerisch bis zur Dachhöhe voll). Das ist die größtmögliche Wassertiefe in Mulden ohne Kanalisation, Versickerung und Pumpen — nicht die Wassertiefe bei einem bestimmten Regen. „Mulden laufen voll" zeigt schematisch, wie sich Mulden von unten füllen. Klimaknelpunte: Klimaatknelpuntenkaart der Gemeente Utrecht (Straßen unpassierbar, Schäden an Gebäuden).','AHN terrain model (dtm_05m, without buildings) for the map view; 3D BAG footprints act as walls, unmeasured areas (water) as outlets. A priority-flood fill raises every hollow to its spill point; depth = fill level − ground. This is the largest possible water depth in hollows without sewers, infiltration and pumps — not the depth for a specific rainfall. “Hollows fill up” is a schematic of hollows filling from the bottom. Climate hotspots: Gemeente Utrecht climate bottleneck map (roads impassable, damage to buildings).','AHN-maaiveldmodel (dtm_05m, zonder gebouwen) in het kaartbeeld; 3D BAG-contouren als muren, ongemeten vlakken (water) als afvoer. Met priority-flood wordt elke kom tot zijn overlooppunt gevuld; diepte = vulhoogte − maaiveld. Dat is de grootst mogelijke waterdiepte in kommen zonder riolering, infiltratie en gemalen — niet de diepte bij een bepaalde bui. „Kommen lopen vol" toont schematisch hoe kommen van onderaf vollopen. Klimaatknelpunten: klimaatknelpuntenkaart gemeente Utrecht.'):W.mode==='chance'?T('LIWO „plaatsgebonden overstromingskans": Wahrscheinlichkeit pro Jahr, dass an diesem Ort mehr als die gewählte Wassertiefe auftritt — durch Bruch eines Deichs am Haupt- oder Regionalgewässer oder Überflutung ungeschützter Gebiete. „Heute" nach dem aktuellen Zustand der Primärdeiche; „2050": alle Primärdeiche erfüllen exakt die Norm des Wasserrechts; „2100": zusätzlich Klimawandel. Regionale Deiche jeweils mit der Provinznorm, ohne Notmaßnahmen.','LIWO “location-based flood probability”: annual probability that more than the chosen water depth occurs here — from a dike breach along main or regional waters or flooding of unprotected areas. “Today” reflects the current state of the primary dikes; “2050”: all primary dikes meet the legal standard exactly; “2100”: climate change included as well. Regional dikes at the provincial standard, without emergency measures.','LIWO „plaatsgebonden overstromingskans": kans per jaar dat hier meer dan de gekozen waterdiepte optreedt — door een doorbraak langs het hoofd- of regionale watersysteem of overstromen van onbeschermde gebieden. „Nu" volgens de actuele staat van de primaire keringen; „2050": alle primaire keringen voldoen exact aan de norm uit de Waterwet; „2100": daarnaast klimaatverandering. Regionale keringen met de provinciale norm, zonder noodmaatregelen.'):W.mode==='flood'?T('Amtliche „Maximale waterdiepte Nederland" aus dem LIWO (Landelijk Informatiesysteem Water en Overstromingen, Rijkswaterstaat): zusammengesetzt aus vielen Überflutungsszenarien des Landelijk Databestand Overstromingen. Jede Klasse zeigt, wo Überflutungen etwa so selten auftreten können; die Karten zeigen mögliche Überflutungen, die in Wirklichkeit nicht alle gleichzeitig eintreten.','Official “Maximale waterdiepte Nederland” from LIWO (Rijkswaterstaat’s national flood information system), compiled from many flood scenarios of the national flood database. Each class shows where floods of roughly that rarity can occur; the maps show possible floods that would not all happen at the same time.','Officiële „Maximale waterdiepte Nederland" uit LIWO (Rijkswaterstaat), samengesteld uit vele overstromingsscenario\'s uit het Landelijk Databestand Overstromingen. Elke klasse toont waar overstromingen van ongeveer die zeldzaamheid kunnen voorkomen; de kaarten tonen mogelijke overstromingen die niet allemaal tegelijk optreden.')
    :T('Geländehöhe aus dem AHN (Actueel Hoogtebestand Nederland, Laserscanning, Raster 0,5 m, ohne Gebäude) in Metern über NAP (≈ mittlerer Meeresspiegel). Der Regler färbt alles blau, was tiefer liegt als der gewählte Wasserstand — eine „Badewanne" ohne Deiche, Pumpwerke und Kanäle, keine Überflutungsvorhersage.','Ground height from the AHN (national laser-scanned elevation model, 0.5 m grid, without buildings) in metres above NAP (≈ mean sea level). The slider colours everything blue that lies lower than the chosen water level — a “bathtub” without dikes, pumping stations and canals, not a flood forecast.','Maaiveldhoogte uit het AHN (laserscanning, raster 0,5 m, zonder gebouwen) in meter t.o.v. NAP. De schuif kleurt alles blauw wat lager ligt dan de gekozen waterstand — een „badkuip" zonder dijken, gemalen en kanalen, geen overstromingsverwachting.'),
  src:()=>W.mode==='rain'?'AHN (via PDOK) · 3D BAG · Gemeente Utrecht (Klimaatknelpuntenkaart)':W.mode!=='terrain'?'LIWO · Rijkswaterstaat (basisinformatie-overstromingen.nl)':'AHN (Rijkswaterstaat / Waterschappen, via PDOK) · 3D BAG'
});
LAB.water={W,CLS,depthAt,demAt,paint,loadDem,RN,fillSinks,sinkDepth,loadRain,paintRain,knelpunten,rainAt};
})();

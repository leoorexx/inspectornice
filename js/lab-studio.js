// ══════════════════════════════════════════════════════════════
// Straßenlabor · Werkzeug „Studio" (Prinzip wie archiMap, eigene Umsetzung):
// Gebiet → Diagramm in eigenem Stil → Bild, Explosionszeichnung oder
// Lasercut-Modell. Jedes Diagramm misst das Gebiet an einem Ziel oder Richtwert
// (3-30-300, Maatlat 40 % Schatten, WHO-Lärm, Entsiegeln, Baujahr vor erster
// Dämmpflicht, Flachdach-Potenzial). Daten: 3D BAG, BGT, Baumregister, RIVM, LIWO.
// Laser: Platten in mm, Schnitt rot / Gravur blau, Gebäude als Höhenschichten
// (Grundrisse je Schicht vereinigt), ZIP mit SVG + DXF + Anleitung.
// ══════════════════════════════════════════════════════════════
(function(){
'use strict';
const LAB=window.LAB;if(!LAB||!LAB.api||!LAB.area)return;
const A=LAB.api,T=(d,e,n)=>A.T(d,e,n),AREA=LAB.area,AR=AREA.AR;
const ST={dia:'ground',sty:'paper',stats:null,busy:false,wms:null,ov:null,
  laser:{open:false,scale:1000,touched:false,th:3,bed:'600x400',trees:true,roads:true,water:true,green:false,treeD:1,res:null,busy:false,last:null}};
const cl01=x=>Math.max(0,Math.min(1,x));
// Momentaufnahme der Gebietsdaten (Gebäude/Flächen bis 25 % über den Rand) — unabhängig von Zoom und Ansicht
const SN={B:null,S:null};
const src=()=>SN.B&&SN.S?SN:null;
const BL=()=>SN.B||A.B.list,SL=()=>SN.S||A.S.list;
async function snapshot(){const r=AREA.ring();if(!r)return;const bb=L.latLngBounds(r).pad(.25);
  const [b,s2]=await Promise.all([A.ensure('b',bb),A.ensure('s',bb),A.ensureTrees()]);if(b.length||s2.length){SN.B=b;SN.S=s2;}}

// ── Stile (wie eine Farbpalette für Pläne) ──
const STY={
  paper:{n:()=>T('Papier','Paper','Papier'),bg:'#f1ede5',ink:'#17151c',mute:'#8b8578',bld:'#17151c',plate:'#fbf9f4',sealed:'#d6cfc0',unpaved:'#e4dccb',green:'#b7c38c',water:'#9db9d1',tree:'rgba(79,122,58,.5)',treeL:'#2f4f22',shadow:'rgba(28,24,52,.38)',path:'#f7d36b'},
  night:{n:()=>T('Nacht','Night','Nacht'),bg:'#121016',ink:'#f3efe7',mute:'#8f889c',bld:'#f3efe7',plate:'#1c1922',sealed:'#2c2833',unpaved:'#34303b',green:'#3d4a2c',water:'#24405c',tree:'rgba(120,180,110,.45)',treeL:'#a6d39a',shadow:'rgba(0,0,0,.55)',path:'#c9a24a'},
  blue:{n:()=>'Blueprint',bg:'#163f73',ink:'#eaf2ff',mute:'#9fb8dc',bld:'#eaf2ff',plate:'#1b4a85',sealed:'#24558f',unpaved:'#2b5d97',green:'#2f6a8a',water:'#123461',tree:'rgba(234,242,255,.22)',treeL:'#eaf2ff',shadow:'rgba(5,20,45,.5)',path:'#ffd96b'},
  mono:{n:()=>'Mono',bg:'#ffffff',ink:'#000000',mute:'#777777',bld:'#000000',plate:'#ffffff',sealed:'#e2e2e2',unpaved:'#efefef',green:'#cfcfcf',water:'#bdbdbd',tree:'rgba(0,0,0,.18)',treeL:'#000000',shadow:'rgba(0,0,0,.32)',path:'#9a9a9a'}};
const sty=()=>STY[ST.sty]||STY.paper;

// ── Klassen ──
const H_CL=[[6,'< 6 m'],[12,'6–12 m'],[20,'12–20 m'],[40,'20–40 m'],[Infinity,'≥ 40 m']],H_COL=['#f0e2c2','#e6b465','#cf743b','#9b3838','#4e1530'];
const Y_CL=[[1945,()=>T('vor 1945','before 1945','vóór 1945')],[1975,()=>'1945–1974'],[1992,()=>'1975–1991'],[2006,()=>'1992–2005'],[Infinity,()=>T('ab 2006','from 2006','vanaf 2006')]],Y_COL=['#8a2a3a','#c8553d','#e3a04a','#9fb59c','#3f7f6a'];
const cls=(v,C)=>v==null?-1:C.findIndex(c=>v<c[0]);
const roofCls=b=>{const f=b.fl||0,s=b.sl||0;if(f+s<=0)return -1;const r=f/(f+s);return r>=.8?0:r>=.2?1:2;};
const R_COL=['#3f8f6a','#a9c79c',null];
const SEAL_COL={0:'#5b5865',1:'#b9ad97',2:'#7a8c3a',3:'#5c88b2'};
const isPath=o=>{const t=LAB.street?LAB.street.typeOf(o):'';return t==='walk'||t==='bike'||t==='shared';};
const refSun=()=>{const c=A.map.getCenter();return A.sunPos(new Date(Date.UTC(new Date().getFullYear(),5,21,13,0)),c.lat,c.lng);};   // 21. Juni, 15:00 Sommerzeit

// ── Diagramme: Darstellung + Ziel/Richtwert ──
const IC=k=>`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${k}</svg>`;
const DIA=[
  {id:'ground',n:()=>T('Schwarzplan','Figure-ground','Zwartplan'),ic:IC('<rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/><path d="M13 3h8v8M3 13v8h8"/>'),
    goal:()=>T('Dichte: Grundfläche (GRZ) und Geschossfläche (GFZ) je Gebietsfläche','Density: ground coverage and floor area ratio','Dichtheid: bebouwd oppervlak en vloeroppervlak per gebiedsoppervlak'),
    bld:()=>sty().bld},
  {id:'height',n:()=>T('Höhe','Height','Hoogte'),ic:IC('<path d="M4 21V11h5v10M10 21V4h5v17M16 21v-7h4v7"/>'),
    goal:()=>T('Gemessene Gebäudehöhe (3D BAG): Wo Höhe Schatten spendet — und wo sie Wind und Hitze staut','Measured building height (3D BAG): where height gives shade — and where it traps wind and heat','Gemeten gebouwhoogte (3D BAG): waar hoogte schaduw geeft — en waar ze wind en hitte vasthoudt'),
    bld:b=>{const i=cls(b.h,H_CL);return i<0?sty().mute:H_COL[i];},legend:()=>H_CL.map((c,i)=>[H_COL[i],c[1]])},
  {id:'age',n:()=>T('Baujahr & Energie','Build year & energy','Bouwjaar & energie'),ic:IC('<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>'),
    goal:()=>T('Vor 1975 meist ohne Dämmung gebaut (erste Dämmvorschriften ab Mitte der 1970er) — Hinweis auf Gas, CO₂ und Kosten ab ETS 2 (2028), kein Dämmzustand','Before 1975 mostly built without insulation (first insulation rules from the mid-1970s) — a hint at gas, CO₂ and costs under ETS 2 (2028), not the insulation state','Vóór 1975 meestal zonder isolatie gebouwd (eerste isolatie-eisen vanaf midden jaren 70) — een aanwijzing voor gas, CO₂ en kosten onder ETS 2 (2028), geen isolatiestaat'),
    bld:b=>{const i=cls(b.yr,Y_CL);return i<0?sty().mute:Y_COL[i];},legend:()=>Y_CL.map((c,i)=>[Y_COL[i],c[1]()])},
  {id:'roof',n:()=>T('Dächer','Roofs','Daken'),ic:IC('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-5h6v5"/>'),
    goal:()=>T('Flachdächer (3D BAG) — Platz für Gründach, Regenspeicher oder Solar; Statik und heutige Nutzung unbekannt','Flat roofs (3D BAG) — room for green roofs, water storage or solar; structure and current use unknown','Platte daken (3D BAG) — ruimte voor groen dak, waterberging of zon; constructie en huidig gebruik onbekend'),
    bld:b=>{const i=roofCls(b);return i<0?sty().mute:R_COL[i]||sty().plate;},legend:()=>[[R_COL[0],T('Flachdach','flat roof','plat dak')],[R_COL[1],T('teils flach','partly flat','deels plat')],[sty().plate,T('geneigt','pitched','schuin')]]},
  {id:'green',n:()=>'3-30-300',ic:IC('<circle cx="12" cy="9" r="6"/><path d="M12 15v6"/>'),
    goal:()=>T('Ziel 30 % Kronendach (3-30-300-Regel): Bäume aus dem Register mit Krone, dazu Grünflächen der BGT','Target 30 % canopy (3-30-300 rule): register trees with crowns, plus BGT green areas','Doel 30 % kronendak (3-30-300-regel): bomen uit het register met kroon, plus BGT-groen'),
    surf:o=>o.c===2?sty().green:o.c===3?sty().water:null,trees:true,bld:()=>sty().mute},
  {id:'seal',n:()=>T('Versiegelung','Sealing','Verharding'),ic:IC('<path d="M3 7h18M3 12h18M3 17h18"/>'),
    goal:()=>T('Wie viel Boden Regen aufnehmen kann: versiegelt, teilbefestigt, grün, Wasser (BGT) — Ziel: entsiegeln','How much ground can absorb rain: sealed, semi-paved, green, water (BGT) — goal: unseal','Hoeveel bodem regen kan opnemen: verhard, halfverhard, groen, water (BGT) — doel: ontharden'),
    surf:o=>SEAL_COL[o.c],bld:()=>sty().bld,legend:()=>[[SEAL_COL[0],T('versiegelt','sealed','verhard')],[SEAL_COL[1],T('teilbefestigt','semi-paved','halfverhard')],[SEAL_COL[2],T('grün','green','groen')],[SEAL_COL[3],T('Wasser','water','water')],[sty().bld,T('Gebäude','buildings','gebouwen')]]},
  {id:'shade',n:()=>T('Schatten','Shade','Schaduw'),ic:IC('<path d="M3 20h18"/><path d="M6 20c0-5 3-9 6-11 3 2 6 6 6 11"/>'),
    goal:()=>T('Richtwert 40 % Schatten auf Fuß- und Radwegen (Landelijke Maatlat) — hier gemessen am 21. Juni um 15 Uhr, Gebäude und Bäume','Guideline 40 % shade on footpaths and cycle paths (national Maatlat) — measured here on 21 June at 3 pm, buildings and trees','Richtwaarde 40 % schaduw op loop- en fietsroutes (Landelijke Maatlat) — hier gemeten op 21 juni om 15 uur, gebouwen en bomen'),
    surf:o=>isPath(o)?sty().path:o.c===3?sty().water:null,shadow:true,trees:true,bld:()=>sty().bld,legend:()=>[[sty().path,T('Fuß- und Radwege','footpaths and cycle paths','loop- en fietspaden')],[sty().shadow,T('Schatten 21.6., 15 Uhr','shade 21 June, 3 pm','schaduw 21 juni, 15 uur')]]},
  {id:'heat',n:()=>T('Hitzeflächen','Heat surfaces','Hitteoppervlak'),ic:IC('<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z"/>'),
    goal:()=>T('Rückstrahlung (Albedo) der Oberflächen: dunkle Flächen unter 0,12 heizen sich am stärksten auf','Surface reflectance (albedo): dark surfaces below 0.12 heat up the most','Weerkaatsing (albedo) van oppervlakken: donkere vlakken onder 0,12 warmen het sterkst op'),
    surf:o=>A.albCol(o.a,o.c),bld:()=>sty().bld,legend:()=>[[A.albCol(.06,0),T('dunkel, heiß (Asphalt)','dark, hot (asphalt)','donker, heet (asfalt)')],[A.albCol(.2,0),T('mittel (Klinker)','medium (pavers)','middel (klinkers)')],[A.albCol(.3,0),T('hell, kühler','light, cooler','licht, koeler')],[A.albCol(.23,2),T('grün','green','groen')]]},
  {id:'noise',n:()=>T('Lärm','Noise','Geluid'),ic:IC('<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>'),
    goal:()=>T('Straßenverkehrslärm L<sub>den</sub> (RIVM 2022) — WHO-Richtwert 53 dB','Road traffic noise L<sub>den</sub> (RIVM 2022) — WHO guideline 53 dB','Wegverkeerslawaai L<sub>den</sub> (RIVM 2022) — WHO-richtwaarde 53 dB'),
    wms:{url:'https://data.rivm.nl/geo/alo/wms',layer:'rivm_20250101_Geluid_lden_wegverkeer_2022',style:''},bld:()=>sty().bld},
  {id:'flood',n:()=>T('Wasser','Water','Water'),ic:IC('<path d="M2 9c1.7-1.6 3.3-1.6 5 0s3.3 1.6 5 0 3.3-1.6 5 0 3.3 1.6 5 0"/><path d="M2 15c1.7-1.6 3.3-1.6 5 0s3.3 1.6 5 0 3.3-1.6 5 0 3.3 1.6 5 0"/>'),
    goal:()=>T('Mögliche Wassertiefe bei Deichbruch, ≈ 1× in 1.000 Jahren (LIWO, Rijkswaterstaat) — ein Szenario, keine Vorhersage','Possible water depth after a dike breach, ≈ once in 1,000 years (LIWO, Rijkswaterstaat) — a scenario, not a forecast','Mogelijke waterdiepte bij een dijkdoorbraak, ≈ 1× per 1.000 jaar (LIWO, Rijkswaterstaat) — een scenario, geen voorspelling'),
    wms:{url:'https://basisinformatie-overstromingen.nl/geoserver/ows',layer:'LIWO_Basis:MaximaleWaterdiepteNederland_Kaart3',style:'LIWO_Basis_Waterdiepte'},bld:()=>sty().bld}
];
// ── Frameworks wie im Architekturbüro: Himmelssicht, Gehen, Lebensraum ──
const EXT={sky:null,walk:null,hab:null,busy:null};
const GEN_COL=['#3f7f6a','#c49a2b','#7a4ea8','#d0583c','#2f6fa8','#8a6a3a','#9a3a6a'],WCOL=['#3f7f6a','#c49a2b','#d0583c'];
const SKY_RAMP=[[0,[34,28,72]],[.3,[96,64,150]],[.5,[170,120,190]],[.7,[226,200,226]],[1,[250,246,236]]];
DIA.push(
  {id:'sky',n:()=>T('Himmelssicht','Sky view','Hemelzicht'),ic:IC('<path d="M3 18a9 9 0 0 1 18 0"/><path d="M12 9V5M7 11 5 9M17 11l2-2"/>'),ext:'sky',bld:()=>sty().bld,
    goal:()=>T('Anteil des Himmels, den man am Boden sieht (Sky View Factor 0–1, aus dem AHN). Wenig Himmel heißt wenig Tageslicht — und nachts kaum Abkühlung, weil die Wärme zwischen den Häusern bleibt.','Share of the sky visible from the ground (sky view factor 0–1, from AHN). Little sky means little daylight — and little cooling at night, because heat stays between the buildings.','Aandeel van de hemel dat je op de grond ziet (sky view factor 0–1, uit AHN). Weinig hemel betekent weinig daglicht — en \'s nachts weinig afkoeling, omdat de warmte tussen de gebouwen blijft.'),
    legend:()=>[[`rgb(${SKY_RAMP[1][1].join(',')})`,T('wenig Himmel (< 0,4)','little sky (< 0.4)','weinig hemel (< 0,4)')],[`rgb(${SKY_RAMP[2][1].join(',')})`,'0,4–0,6'],[`rgb(${SKY_RAMP[3][1].join(',')})`,T('viel Himmel (> 0,6)','open sky (> 0.6)','veel hemel (> 0,6)')]]},
  {id:'walk',n:()=>T('Gehen','Walking','Lopen'),ic:IC('<circle cx="13" cy="4" r="2"/><path d="M9 21l2-7 3 3v5M9 10l3-2 3 4 3 1M11 14l-2-4"/>'),ext:'walk',bld:()=>sty().mute,
    goal:()=>T('Wie weit man in 5, 10 und 15 Minuten zu Fuß kommt (4,8 km/h) — auf dem amtlichen Wegenetz (NWB) ab der Mitte des Gebiets; dazu Bänke und Spielplätze aus dem Register der Gemeente.','How far you get in 5, 10 and 15 minutes on foot (4.8 km/h) — on the official road network (NWB) from the centre of the area; plus benches and playgrounds from the municipal register.','Hoe ver je in 5, 10 en 15 minuten lopend komt (4,8 km/u) — over het officiële wegennet (NWB) vanaf het midden van het gebied; plus banken en speelplekken uit het gemeenteregister.'),
    legend:()=>[[WCOL[0],T('bis 5 Minuten','up to 5 minutes','tot 5 minuten')],[WCOL[1],T('5–10 Minuten','5–10 minutes','5–10 minuten')],[WCOL[2],T('10–15 Minuten','10–15 minutes','10–15 minuten')]]},
  {id:'habitat',n:()=>T('Lebensraum','Habitat','Leefgebied'),ic:IC('<path d="M5 19c4-1 6-5 6-10 3 3 4 7 3 10"/><path d="M14 9c2-3 5-4 7-4-1 4-3 6-6 7"/>'),ext:'hab',trees:true,treeCol:true,bld:()=>sty().mute,
    surf:o=>o.c===2?sty().green:o.c===3?sty().water:null,
    goal:()=>T('Vielfalt der Stadtbäume nach der 10-20-30-Regel (höchstens 20 % einer Gattung, Santamour) und beobachtete Arten seit 2015 (GBIF). Vielfalt macht das Grün robuster gegen Hitze, Dürre und Schädlinge.','Urban tree diversity by the 10-20-30 rule (at most 20 % of one genus, Santamour) and species observed since 2015 (GBIF). Diversity makes green more robust against heat, drought and pests.','Diversiteit van stadsbomen volgens de 10-20-30-regel (hoogstens 20 % van één geslacht, Santamour) en waargenomen soorten sinds 2015 (GBIF). Diversiteit maakt groen robuuster tegen hitte, droogte en plagen.'),
    legend:()=>EXT.hab&&EXT.hab.top?EXT.hab.top.map(([g,n],i)=>[GEN_COL[i],`${g} · ${A.nf(100*n/EXT.hab.n,0)} %`]).concat([[sty().tree,T('andere Gattungen','other genera','overige geslachten')]]):[]}
);
const dia=()=>DIA.find(d=>d.id===ST.dia)||DIA[0];
const extKey=()=>JSON.stringify([AR.type,AR.r,AR.center&&[+AR.center.lat.toFixed(5),+AR.center.lng.toFixed(5)],AR.pts&&AR.pts.length]);
async function ensureExt(){
  const d=dia();if(!d.ext||!AREA.ring())return;const key=extKey();if(EXT[d.ext]&&EXT[d.ext].key===key)return;
  EXT.busy=d.ext;A.rerender();
  try{EXT[d.ext]=await ({sky:skyCalc,walk:walkCalc,hab:habCalc})[d.ext]();EXT[d.ext].key=key;}catch(e){EXT[d.ext]={err:true,key};}
  EXT.busy=null;A.rerender();A.req();
}
const rdBox=(E,pad)=>{const P=pts(E.z,E),xs=P.map(p=>p[0]+E.ox),ys=P.map(p=>p[1]+E.oy);return [Math.floor(Math.min(...xs)-pad),Math.floor(Math.min(...ys)-pad),Math.ceil(Math.max(...xs)+pad),Math.ceil(Math.max(...ys)+pad)];};
const wOfRD=(x,y)=>{const ll=A.fromRD(x,y);return A.w20(ll[0],ll[1]);};
async function wcs(id,x0,y0,x1,y1,w,h){const G=await A.geotiff(),r=await fetch(`https://service.pdok.nl/rws/ahn/wcs/v1_0?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=${id}&FORMAT=image/tiff&SUBSET=x(${x0},${x1})&SUBSET=y(${y0},${y1})&SCALESIZE=x(${w}),y(${h})`);if(!r.ok)throw new Error('AHN');
  const im=await (await G.fromArrayBuffer(await r.arrayBuffer())).getImage();return {z:(await im.readRasters())[0],w:im.getWidth(),h:im.getHeight()};}
async function skyCalc(){   // Sky View Factor am Boden: 16 Richtungen, Horizont bis 60 m im Oberflächenmodell
  const E=AREA.exportSet(src()),[x0,y0,x1,y1]=rdBox(E,60),res=Math.max(1,Math.max(x1-x0,y1-y0)/420),W=Math.round((x1-x0)/res),H=Math.round((y1-y0)/res);
  const [S,G]=await Promise.all([wcs('dsm_05m',x0,y0,x1,y1,W,H),wcs('dtm_05m',x0,y0,x1,y1,W,H)]);
  const w=S.w,h=S.h,rx=(x1-x0)/w,ry=(y1-y0)/h,ok=v=>v>-50&&v<400,D=[1.5,3,5,8,12,17,23,30,40,50,60],svf=new Float32Array(w*h).fill(-1);
  const P=pts(E.z,E).map(p=>[p[0]+E.ox,p[1]+E.oy]);let sum=0,n=0,low=0;
  for(let j=0;j<h;j++){if(j%30===0)await A.yieldNow();for(let i=0;i<w;i++){const k=j*w+i,g=G.z[k],sv=S.z[k];if(!ok(g)||!ok(sv)||sv-g>1.5)continue;
    let acc=0;for(let d=0;d<16;d++){const a=d*Math.PI/8,dx=Math.cos(a),dy=Math.sin(a);let mt=0;
      for(const s of D){const ii=Math.round(i+dx*s/rx),jj=Math.round(j-dy*s/ry);if(ii<0||jj<0||ii>=w||jj>=h)break;const v=S.z[jj*w+ii];if(ok(v)){const t=(v-g)/s;if(t>mt)mt=t;}}
      acc+=mt*mt/(1+mt*mt);}
    const f=1-acc/16;svf[k]=f;const X=x0+(i+.5)*rx,Y=y1-(j+.5)*ry;if(pIn(X,Y,P)){sum+=f;n++;if(f<.5)low++;}}}
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;const g2=cv.getContext('2d');
  if(g2&&typeof g2.createImageData==='function'){const id=g2.createImageData(w,h);for(let k=0;k<w*h;k++){const f=svf[k];if(f<0)continue;const c=A.ramp(SKY_RAMP,f);id.data[4*k]=c[0];id.data[4*k+1]=c[1];id.data[4*k+2]=c[2];id.data[4*k+3]=225;}g2.putImageData(id,0,0);}
  const nw=wOfRD(x0,y1),se=wOfRD(x1,y0);
  return {img:cv,b:[nw[0],nw[1],se[0],se[1]],mean:n?sum/n:null,low:n?100*low/n:null,n};
}
const WALK_OK=new Set(['','RB','FP','VP','VZ','ERF','PAR']);
let FURN=null;
async function walkCalc(){   // Gehminuten (Dijkstra) auf dem NWB ab der Gebietsmitte
  const c=AR.center||A.map.getCenter(),R=1250,dLat=R/111320,dLon=R/(111320*Math.cos(c.lat*A.SR));
  let url=`https://api.pdok.nl/rws/nationaal-wegenbestand-wegen/ogc/v1/collections/wegvakken/items?bbox=${c.lng-dLon},${c.lat-dLat},${c.lng+dLon},${c.lat+dLat}&limit=1000&f=json`;
  const nodes=new Map(),edges=[];
  for(let k=0;k<10&&url;k++){const j=await fetch(url).then(r=>{if(!r.ok)throw new Error('NWB');return r.json();});
    for(const f of j.features||[]){const pr=f.properties||{};if(!WALK_OK.has(pr.bst_code||'')||!f.geometry||pr.jte_id_beg==null)continue;
      const ls=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[];
      for(const l of ls){if(l.length<2)continue;let len=0;for(let i=1;i<l.length;i++){const a=A.toRD(l[i-1][1],l[i-1][0]),b=A.toRD(l[i][1],l[i][0]);len+=Math.hypot(b[0]-a[0],b[1]-a[1]);}
        const z=new Float64Array(l.length*2);l.forEach((p,i)=>{const q=A.w20(p[1],p[0]);z[2*i]=q[0];z[2*i+1]=q[1];});
        const e={a:pr.jte_id_beg,b:pr.jte_id_end,len,z};edges.push(e);for(const [id,i] of [[e.a,0],[e.b,l.length-1]]){if(!nodes.has(id))nodes.set(id,{x:z[2*i],y:z[2*i+1],e:[],t:Infinity});nodes.get(id).e.push(e);}}}
    const nx=(j.links||[]).find(l=>l.rel==='next');url=nx?nx.href:null;}
  if(!edges.length)throw new Error('leer');
  const [cx,cy]=A.w20(c.lat,c.lng),m=A.m20();let start=null,bd=Infinity;for(const [id,nd] of nodes){const d=Math.hypot(nd.x-cx,nd.y-cy);if(d<bd){bd=d;start=id;}}
  const V=1.333,heap=[];const push=(t,id)=>{heap.push([t,id]);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}};
  const pop=()=>{const r=heap[0],l=heap.pop();if(heap.length){heap[0]=l;let i=0;for(;;){let a=2*i+1;if(a>=heap.length)break;if(a+1<heap.length&&heap[a+1][0]<heap[a][0])a++;if(heap[a][0]>=heap[i][0])break;[heap[a],heap[i]]=[heap[i],heap[a]];i=a;}}return r;};
  nodes.get(start).t=bd*m/V;push(nodes.get(start).t,start);
  while(heap.length){const [t,id]=pop(),nd=nodes.get(id);if(t>nd.t||t>900)continue;for(const e of nd.e){const o=e.a===id?e.b:e.a,on=nodes.get(o),tt=t+e.len/V;if(tt<on.t){on.t=tt;push(tt,o);}}}
  const segs=[[],[],[]];for(const e of edges){const t=Math.min(nodes.get(e.a).t,nodes.get(e.b).t);if(t>900)continue;segs[t<=300?0:t<=600?1:2].push(e.z);}
  // Bänke und Spielplätze (Register): erreichbar über den nächsten Knoten im Umkreis von 60 m
  if(!FURN)FURN=await fetch('data/official/furniture_utr.json').then(r=>r.ok?r.json():null).catch(()=>null);
  const cell=60/m,grid=new Map();for(const [,nd] of nodes){if(!isFinite(nd.t))continue;const k=Math.floor(nd.x/cell)+','+Math.floor(nd.y/cell);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(nd);}
  const reach=(lat,lon)=>{const [x,y]=A.w20(lat,lon),gx=Math.floor(x/cell),gy=Math.floor(y/cell);let best=Infinity;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const nd of grid.get((gx+a)+','+(gy+b))||[]){const d=Math.hypot(nd.x-x,nd.y-y)*m;if(d<=60)best=Math.min(best,nd.t+d/V);}return best;};
  let b5=0,b10=0;const play=[];
  if(FURN){for(const [la,lo] of FURN.bank||[]){if(Math.abs(la-c.lat)>dLat||Math.abs(lo-c.lng)>dLon)continue;const t=reach(la,lo);if(t<=300)b5++;if(t<=600)b10++;}
    for(const [la,lo] of FURN.speelvoorziening||[]){if(Math.abs(la-c.lat)>dLat||Math.abs(lo-c.lng)>dLon)continue;const t=reach(la,lo);if(t<=600&&!play.some(p=>Math.hypot((p[0]-la)*111320,(p[1]-lo)*68500)<40))play.push([la,lo,t]);}}
  const km=k=>segs.slice(0,k+1).flat().reduce((s,z)=>{let l=0;for(let i=2;i<z.length;i+=2)l+=Math.hypot(z[i]-z[i-2],z[i+1]-z[i-1]);return s+l*m;},0)/1000;
  return {segs,origin:[cx,cy],b5,b10,p5:play.filter(p=>p[2]<=300).length,p10:play.length,km5:km(0),km10:km(1)};
}
async function habCalc(){   // Baumgattungen (Register) + beobachtete Arten (GBIF)
  const E=AREA.exportSet(src()),gen=new Map();for(const t of E.trees){const g=A.GENERA[t[6]]||'?';gen.set(g,(gen.get(g)||0)+1);}
  const n=E.trees.length,top=[...gen.entries()].sort((a,b)=>b[1]-a[1]),H=-top.reduce((s,[,c])=>s+(c/n)*Math.log(c/n),0);
  let gb=null;try{const r=AREA.ring();let ll=r.map(([la,lo])=>[lo,la]);let a=0;for(let i=0;i<ll.length;i++){const p=ll[i],q=ll[(i+1)%ll.length];a+=p[0]*q[1]-q[0]*p[1];}if(a<0)ll.reverse();
    const wkt=`POLYGON((${ll.concat([ll[0]]).map(p=>p[0].toFixed(5)+' '+p[1].toFixed(5)).join(',')}))`;
    const j=await fetch(`https://api.gbif.org/v1/occurrence/search?geometry=${encodeURIComponent(wkt)}&year=2015,${new Date().getFullYear()}&limit=0&facet=speciesKey&facetLimit=3000`).then(r=>r.json());
    gb={count:j.count||0,species:j.facets&&j.facets[0]?j.facets[0].counts.length:0};}catch(e){}
  return {n,top:top.slice(0,7),genera:top.length,shannon:n?H:null,maxShare:n?100*top[0][1]/n:null,maxGen:n?top[0][0]:null,gbif:gb};
}

// ── Gebiet in lokalen Metern ──
const area2=z=>Math.abs(A.signed(z))/2;
const pts=(z,E)=>{const P=[];for(let i=0;i<z.length-2;i+=2)P.push(E.loc(z[i],z[i+1]));return P;};
const pIn=(x,y,P)=>{let ins=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))ins=!ins;}return ins;};
const sArea=P=>{let a=0;for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];a+=p[0]*q[1]-q[0]*p[1];}return a/2;};

// ── Kennzahlen ──
async function compute(){
  const r=AREA.ring();if(!r){ST.stats=null;A.rerender();return;}
  ST.busy=true;A.rerender();
  await snapshot();A.measureTrees();
  await AREA.compute(src());
  const s0=AR.stats;if(!s0){ST.busy=false;A.rerender();return;}
  const E=AREA.exportSet(src()),m=A.m20(),m2=m*m,Am=s0.Am;
  const byH=[0,0,0,0,0],byY=[0,0,0,0,0];let foot=0,yKnown=0,flat=0,slant=0,nFlat=0;
  for(const b of E.blds){const a=area2(b.z)*m2;foot+=a;const ih=cls(b.h,H_CL);if(ih>=0)byH[ih]+=a;const iy=cls(b.yr,Y_CL);if(iy>=0){byY[iy]+=a;yKnown+=a;}
    if(b.fl!=null){flat+=b.fl;slant+=b.sl||0;if(roofCls(b)===0)nFlat++;}}
  // Raster: Wege, Schatten 21.6. 15 Uhr, Albedo
  const [x0,y0,x1,y1]=(()=>{let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;const z=E.z;for(let i=0;i<z.length;i+=2){a=Math.min(a,z[i]);c=Math.max(c,z[i]);b=Math.min(b,z[i+1]);d=Math.max(d,z[i+1]);}return [a,b,c,d];})();
  const res=Math.max(.5,Math.max(x1-x0,y1-y0)*m/480),W=Math.max(8,Math.ceil((x1-x0)*m/res)),H=Math.max(8,Math.ceil((y1-y0)*m/res));
  const X={k:m/res,ox:x0*m/res,oy:y0*m/res,sc:A.mpp()/res},g=A.offscreen(W,H,true),rd=()=>g.getImageData(0,0,W,H).data;
  g.clearRect(0,0,W,H);g.fillStyle='#fff';g.beginPath();A.poly(g,E.z,X);g.fill();const mk=rd();
  g.clearRect(0,0,W,H);A.chunked(g,SL().filter(isPath),16,o=>A.poly(g,o.z,X),'#fff');const pa=rd();
  g.clearRect(0,0,W,H);const sun=refSun(),trees=A.treesIn(.05,L.latLngBounds(r));if(sun.alt>.02)A.castShadows(g,sun,X,trees,'#fff','#fff',4,BL());A.chunked(g,BL(),16,b=>A.poly(g,b.z,X),'#fff');const sh=rd();
  g.clearRect(0,0,W,H);const byA=new Map();for(const o of SL()){const v=Math.round(Math.min(.5,o.a||0)*500);if(!byA.has(v))byA.set(v,[]);byA.get(v).push(o);}
  for(const [v,os] of byA)A.chunked(g,os,16,o=>A.poly(g,o.z,X),`rgb(${v},255,0)`);A.chunked(g,BL(),16,b=>A.poly(g,b.z,X),'#000');const al=rd();
  let pin=0,pSh=0,open=0,alb=0,dark=0;
  for(let p=0;p<mk.length;p+=4){if(mk[p+3]<128)continue;
    if(pa[p+3]>127){pin++;if(sh[p+3]>127)pSh++;}
    if(al[p+3]>127&&al[p+1]>127){open++;const a=al[p]/500;alb+=a;if(a<.12)dark++;}}
  ST.stats={Am,n:E.blds.length,foot,gfa:s0.gfa,hmean:s0.hmean,hmax:s0.hmax,byH,byY,yKnown,flat,slant,nFlat,share:s0.share,canopy:s0.canopy,trees:s0.trees,
    pathShade:pin?100*pSh/pin:null,pathM2:pin*res*res,albedo:open?alb/open:null,dark:open?100*dark/open:null,sunAlt:sun.alt,place:placeName()};
  ST.busy=false;A.rerender();A.req();ensureExt();
}
function placeName(){const c=AR.center||A.map.getCenter(),b=A.opt().buurtAt?A.opt().buurtAt(c.lat,c.lng):null;return b?b.name:'';}
const pct=v=>v==null?'—':A.nf(v,0)+' %';
// Kennzahl je Diagramm: große Zahl, Ziel, Balken
function kpi(){
  const s=ST.stats,d=dia();if(!s)return null;const F=A.fmt,sh=k=>s.share[k]||0;
  const k={
    ground:{big:A.nf(s.foot/s.Am,2),unit:'GRZ',sub:`GFZ ${A.nf(s.gfa/s.Am,2)} · ${F(s.n)} ${T('Gebäude','buildings','gebouwen')} · Ø ${s.hmean!=null?A.nf(s.hmean,1)+' m':'—'}`},
    height:{big:s.hmean!=null?A.nf(s.hmean,1):'—',unit:T('m Ø Höhe','m avg. height','m gem. hoogte'),sub:`max ${A.nf(s.hmax,0)} m · ${F(s.n)} ${T('Gebäude','buildings','gebouwen')}`,parts:s.byH},
    age:{big:s.yKnown?A.nf(100*(s.byY[0]+s.byY[1])/s.yKnown,0):'—',unit:T('% vor 1975','% before 1975','% vóór 1975'),sub:T('Anteil der Grundfläche, gebaut vor der ersten Dämmpflicht','share of footprint built before the first insulation rules','aandeel grondoppervlak gebouwd vóór de eerste isolatie-eisen'),parts:s.byY,ets:true},
    roof:{big:F(s.flat),unit:T('m² Flachdach','m² flat roof','m² plat dak'),sub:`${F(s.nFlat)} ${T('Gebäude mit Flachdach','buildings with a flat roof','gebouwen met plat dak')} · ${s.flat+s.slant>0?A.nf(100*s.flat/(s.flat+s.slant),0):'—'} % ${T('der Dachfläche','of roof area','van het dakoppervlak')}`},
    green:{big:A.nf(s.canopy,0),unit:T('% Kronendach','% canopy','% kronendak'),target:30,v:s.canopy,better:'high',sub:`${F(s.trees)} ${T('Bäume im Register','register trees','bomen in register')} · ${pct(sh('green'))} ${T('Grünfläche','green area','groen')}`},
    seal:{big:A.nf(sh('bld')+sh('sealed'),0),unit:T('% bebaut oder versiegelt','% built or sealed','% bebouwd of verhard'),sub:`${pct(sh('unpaved'))} ${T('teilbefestigt','semi-paved','halfverhard')} · ${pct(sh('green'))} ${T('grün','green','groen')} · ${pct(sh('water'))} ${T('Wasser','water','water')}`,v:sh('bld')+sh('sealed'),target:null},
    shade:{big:s.pathShade!=null?A.nf(s.pathShade,0):'—',unit:T('% der Wege im Schatten','% of paths in shade','% van de paden in schaduw'),target:40,v:s.pathShade,better:'high',sub:T(`${F(s.pathM2)} m² Fuß- und Radwege · 21. Juni, 15 Uhr`,`${F(s.pathM2)} m² of footpaths and cycle paths · 21 June, 3 pm`,`${F(s.pathM2)} m² loop- en fietspad · 21 juni, 15 uur`)},
    heat:{big:s.dark!=null?A.nf(s.dark,0):'—',unit:T('% dunkle Flächen','% dark surfaces','% donkere vlakken'),sub:`${T('Ø Albedo der Freiflächen','avg. albedo of open space','gem. albedo buitenruimte')} ${s.albedo!=null?A.nf(s.albedo,2):'—'}`},
    noise:{big:'53',unit:T('dB WHO-Richtwert','dB WHO guideline','dB WHO-richtwaarde'),sub:T('Farben: amtliche RIVM-Klassen; Wert an jedem Punkt im Werkzeug „Sonne" antippen','colours: official RIVM classes','kleuren: officiële RIVM-klassen')},
    sky:EXT.sky&&EXT.sky.mean!=null?{big:A.nf(EXT.sky.mean,2),unit:T('Ø Himmelssicht am Boden','avg. sky view at ground level','gem. hemelzicht op de grond'),sub:T(`${A.nf(EXT.sky.low,0)} % der Freiflächen sehen weniger als die Hälfte des Himmels`,`${A.nf(EXT.sky.low,0)} % of open ground sees less than half the sky`,`${A.nf(EXT.sky.low,0)} % van de buitenruimte ziet minder dan de helft van de hemel`)}:null,
    walk:EXT.walk&&!EXT.walk.err?{big:A.fmt(EXT.walk.b5),unit:T('Bänke in 5 Minuten zu Fuß','benches within a 5-minute walk','banken binnen 5 minuten lopen'),sub:T(`${EXT.walk.p5} Spielplätze in 5, ${EXT.walk.p10} in 10 Minuten · ${A.nf(EXT.walk.km10,1)} km Wege in 10 Minuten`,`${EXT.walk.p5} playgrounds within 5, ${EXT.walk.p10} within 10 minutes · ${A.nf(EXT.walk.km10,1)} km of paths within 10 minutes`,`${EXT.walk.p5} speelplekken binnen 5, ${EXT.walk.p10} binnen 10 minuten · ${A.nf(EXT.walk.km10,1)} km paden binnen 10 minuten`)}:null,
    habitat:EXT.hab&&EXT.hab.n?{big:A.nf(EXT.hab.maxShare,0),unit:T(`% ${EXT.hab.maxGen} — größte Gattung`,`% ${EXT.hab.maxGen} — largest genus`,`% ${EXT.hab.maxGen} — grootste geslacht`),target:20,v:EXT.hab.maxShare,better:'low',
      sub:`${A.fmt(EXT.hab.n)} ${T('Bäume','trees','bomen')}, ${EXT.hab.genera} ${T('Gattungen','genera','geslachten')} · Shannon ${A.nf(EXT.hab.shannon,2)}${EXT.hab.gbif?` · GBIF: ${A.fmt(EXT.hab.gbif.species)} ${T('Arten seit 2015','species since 2015','soorten sinds 2015')} (${A.fmt(EXT.hab.gbif.count)} ${T('Beobachtungen','observations','waarnemingen')})`:''}`}:null,
    flood:{big:'1/1.000',unit:T('Jahre — Szenario','years — scenario','jaar — scenario'),sub:T('Farben: Wassertiefe nach LIWO; Deiche verhindern das in aller Regel','colours: water depth from LIWO; dikes normally prevent this','kleuren: waterdiepte volgens LIWO; dijken voorkomen dit normaal gesproken')}
  }[d.id];
  return k;
}
function etsBlock(){
  const c=AR.center||A.map.getCenter(),b=A.opt().buurtAt?A.opt().buurtAt(c.lat,c.lng):null,gas=b&&b.v&&b.v.gas;if(!gas)return '';
  const t=gas*1.779/1000,lo=Math.round(t*56/5)*5,hi=Math.round(t*100/5)*5;
  return `<div class="st-ets"><b>${A.nf(t,1)} t CO₂</b><span>${T(`je Wohnung und Jahr aus Erdgas in ${b.name} (Ø ${A.fmt(gas)} m³, CBS) — mit ETS 2 ab 2028 etwa ${lo}–${hi} € mehr pro Jahr bei 56–100 € je Tonne (Annahme)${b.v.gasfrei!=null?`; ${A.nf(b.v.gasfrei,0)} % der Wohnungen sind schon gasfrei`:''}.`,`per home per year from natural gas in ${b.name} (avg. ${A.fmt(gas)} m³, CBS) — with ETS 2 from 2028 roughly €${lo}–${hi} more per year at €56–100 per tonne (assumption)${b.v.gasfrei!=null?`; ${A.nf(b.v.gasfrei,0)} % of homes are already gas-free`:''}.`,`per woning per jaar uit aardgas in ${b.name} (gem. ${A.fmt(gas)} m³, CBS) — met ETS 2 vanaf 2028 ongeveer € ${lo}–${hi} meer per jaar bij € 56–100 per ton (aanname)${b.v.gasfrei!=null?`; ${A.nf(b.v.gasfrei,0)} % van de woningen is al aardgasvrij`:''}.`)}</span></div>`;
}

// ── WMS-Bild (Lärm, Wasser) für das Gebiet ──
const R=6378137,W20=256*Math.pow(2,20);
const merc=(x,y)=>[x/W20*2*Math.PI*R-Math.PI*R,Math.PI*R-y/W20*2*Math.PI*R];
function wmsUrl(d,z,px){
  const b=(()=>{let a=Infinity,c=Infinity,e=-Infinity,f=-Infinity;for(let i=0;i<z.length;i+=2){a=Math.min(a,z[i]);e=Math.max(e,z[i]);c=Math.min(c,z[i+1]);f=Math.max(f,z[i+1]);}return [a,c,e,f];})();
  const [mx0,my1]=merc(b[0],b[1]),[mx1,my0]=merc(b[2],b[3]),w=b[2]-b[0],h=b[3]-b[1],s=px/Math.max(w,h);
  return {b,url:`${d.wms.url}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${encodeURIComponent(d.wms.layer)}&STYLES=${encodeURIComponent(d.wms.style)}&CRS=EPSG:3857&BBOX=${mx0},${my0},${mx1},${my1}&WIDTH=${Math.max(16,Math.round(w*s))}&HEIGHT=${Math.max(16,Math.round(h*s))}&FORMAT=image/png&TRANSPARENT=true`,
    legend:`${d.wms.url}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${encodeURIComponent(d.wms.layer)}${d.wms.style?'&STYLE='+encodeURIComponent(d.wms.style):''}`};
}
function loadWms(){
  const d=dia(),r=AREA.ring();if(!d.wms||!r){ST.wms=null;return;}
  const E=AREA.exportSet(src()),u=wmsUrl(d,E.z,1024),key=u.url;if(ST.wms&&ST.wms.key===key)return;
  const img=new Image();img.crossOrigin='anonymous';ST.wms={key,img,b:u.b,legend:u.legend,ok:false,id:d.id};
  img.onload=()=>{if(ST.wms&&ST.wms.img===img){ST.wms.ok=true;A.req();}};img.onerror=()=>{if(ST.wms&&ST.wms.img===img){ST.wms.err=true;A.rerender();}};img.src=key;
}

// ── Karte zeichnen ──
function drawDia(g,X){
  const S=sty(),d=dia(),z=AREA.ring()&&AREA.exportSet(src()).z,Wc=g.canvas.width,Hc=g.canvas.height;
  g.save();g.fillStyle=S.bg;g.globalAlpha=.96;g.fillRect(0,0,Wc,Hc);g.globalAlpha=1;
  if(d.surf){const by=new Map();for(const o of SL()){const c=d.surf(o);if(!c)continue;if(!by.has(c))by.set(c,[]);by.get(c).push(o);}for(const [c,os] of by)A.chunked(g,os,16,o=>A.poly(g,o.z,X),c);}
  else{const by=new Map([[S.water,SL().filter(o=>o.c===3)]]);for(const [c,os] of by)A.chunked(g,os,16,o=>A.poly(g,o.z,X),c);}
  if(d.wms&&ST.wms&&ST.wms.ok&&ST.wms.id===d.id){const b=ST.wms.b;g.globalAlpha=.85;g.drawImage(ST.wms.img,b[0]*X.k-X.ox,b[1]*X.k-X.oy,(b[2]-b[0])*X.k,(b[3]-b[1])*X.k);g.globalAlpha=1;}
  if(d.ext==='sky'&&EXT.sky&&EXT.sky.img){const b=EXT.sky.b;g.globalAlpha=.92;g.imageSmoothingEnabled=true;g.drawImage(EXT.sky.img,b[0]*X.k-X.ox,b[1]*X.k-X.oy,(b[2]-b[0])*X.k,(b[3]-b[1])*X.k);g.globalAlpha=1;}
  if(d.shadow){const sun=refSun();if(sun.alt>.02)A.castShadows(g,sun,X,A.treesIn(.05),S.shadow,S.shadow,4,BL());}
  if(d.trees){const m=A.mpp()/X.sc,ts=A.treesIn(.05),cOf=t=>{if(!d.treeCol||!EXT.hab||!EXT.hab.top)return S.tree;const i=EXT.hab.top.findIndex(([gn])=>gn===(A.GENERA[t[6]]||'?'));return i>=0?GEN_COL[i]:S.tree;};
    const byC=new Map();for(const t of ts){const c=cOf(t);if(!byC.has(c))byC.set(c,[]);byC.get(c).push(t);}
    for(const [c,arr] of byC)A.chunked(g,arr,48,t=>{const x=t[4]*X.k-X.ox,y=t[5]*X.k-X.oy,r=Math.max(1.2*X.sc,t[2]/m);g.moveTo(x+r,y);g.arc(x,y,r,0,2*Math.PI);},c,S.treeL,.6*X.sc);}
  const by=new Map();for(const b of BL()){const c=d.bld(b);if(!by.has(c))by.set(c,[]);by.get(c).push(b);}
  for(const [c,bs] of by)A.chunked(g,bs,16,b=>A.poly(g,b.z,X),c,d.id==='ground'?null:S.bg,.5*X.sc);
  if(d.ext==='walk'&&EXT.walk&&EXT.walk.segs){g.lineCap='round';g.lineJoin='round';for(let k=2;k>=0;k--){g.strokeStyle=WCOL[k];g.lineWidth=(k===0?4:3)*X.sc;g.beginPath();
      for(const zz of EXT.walk.segs[k]){g.moveTo(zz[0]*X.k-X.ox,zz[1]*X.k-X.oy);for(let i=2;i<zz.length;i+=2)g.lineTo(zz[i]*X.k-X.ox,zz[i+1]*X.k-X.oy);}g.stroke();}
    const o=EXT.walk.origin;g.fillStyle='#FFD600';g.strokeStyle=S.ink;g.lineWidth=2*X.sc;g.beginPath();g.arc(o[0]*X.k-X.ox,o[1]*X.k-X.oy,7*X.sc,0,2*Math.PI);g.fill();g.stroke();}
  if(z){g.fillStyle=S.bg;g.globalAlpha=.72;g.beginPath();g.rect(0,0,Wc,Hc);A.poly(g,z,X);g.fill('evenodd');g.globalAlpha=1;
    g.strokeStyle=S.ink;g.lineWidth=1.6*X.sc;g.beginPath();A.poly(g,z,X);g.stroke();}
  g.restore();
}

// ── Diagramm als SVG (rund oder gezeichnet, mit Legende, Kennzahl, Maßstab) ──
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/<\/?sub>/g,'');
const clean=s=>String(s).replace(/<sub>/g,'').replace(/<\/sub>/g,'');
async function dataUrl(u){try{const r=await fetch(u);if(!r.ok)return null;const b=await r.blob();return await new Promise(res=>{const f=new FileReader();f.onload=()=>res(f.result);f.onerror=()=>res(null);f.readAsDataURL(b);});}catch(e){return null;}}
async function diagramSvg(){
  const E=AREA.exportSet(src()),S=sty(),d=dia(),k=kpi(),P0=pts(E.z,E),N=near(E,80);
  const xs=P0.map(p=>p[0]),ys=P0.map(p=>p[1]),mx0=Math.min(...xs),mx1=Math.max(...xs),my0=Math.min(...ys),my1=Math.max(...ys);
  const Wd=1000,pad=60,side=380,sc=(Wd-2*pad)/Math.max(1,Math.max(mx1-mx0,my1-my0)),Hd=Math.round((my1-my0)*sc+2*pad+170),W=Wd+side;
  const P=(x,y)=>[(pad+(x-mx0)*sc).toFixed(1),(pad+(my1-y)*sc).toFixed(1)];
  const path=z=>{let s='';for(let i=0;i<z.length-2;i+=2){const p=E.loc(z[i],z[i+1]),[x,y]=P(p[0],p[1]);s+=(i?'L':'M')+x+' '+y;}return s+'Z';};
  let s=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${Hd}" viewBox="0 0 ${W} ${Hd}" font-family="DM Sans, Helvetica, Arial, sans-serif"><rect width="${W}" height="${Hd}" fill="${S.bg}"/>`;
  s+=`<defs><clipPath id="ar"><path d="${path(E.z)}"/></clipPath></defs><g clip-path="url(#ar)"><rect width="${W}" height="${Hd}" fill="${S.plate}"/>`;
  const surfs=N.surfs;
  if(d.surf){const by=new Map();for(const o of surfs){const c=d.surf(o);if(!c)continue;if(!by.has(c))by.set(c,[]);by.get(c).push(o);}for(const [c,os] of by)s+=`<g fill="${c}">${os.map(o=>`<path d="${path(o.z)}"/>`).join('')}</g>`;}
  else s+=`<g fill="${S.water}">${surfs.filter(o=>o.c===3).map(o=>`<path d="${path(o.z)}"/>`).join('')}</g>`;
  if(d.wms){const u=wmsUrl(d,E.z,1400),href=await dataUrl(u.url)||u.url,a=E.loc(u.b[0],u.b[1]),b=E.loc(u.b[2],u.b[3]),[x0,y0]=P(a[0],a[1]),[x1,y1]=P(b[0],b[1]);
    s+=`<image href="${esc(href)}" x="${x0}" y="${y0}" width="${(x1-x0).toFixed(1)}" height="${(y1-y0).toFixed(1)}" opacity=".85" preserveAspectRatio="none"/>`;}
  if(d.shadow){const sun=refSun();if(sun.alt>.02){const dx=Math.sin(sun.az),dy=Math.cos(sun.az),t=Math.tan(sun.alt);let gsh='';
    for(const t2 of E.trees){const L=Math.min(250,t2[3]*.65/t),p=E.loc(t2[4],t2[5]),[x,y]=P(p[0]+dx*L,p[1]+dy*L);gsh+=`<circle cx="${x}" cy="${y}" r="${(t2[2]*sc).toFixed(1)}"/>`;}
    for(const b of N.blds){if(!(b.h>=1))continue;const L=Math.min(600,b.h/t),Q=pts(b.z,E),n=Q.length;
      for(let i=0;i<n;i++){const a=Q[i],c=Q[(i+1)%n];gsh+=`<path d="M${P(...a)}L${P(...c)}L${P(c[0]+dx*L,c[1]+dy*L)}L${P(a[0]+dx*L,a[1]+dy*L)}Z"/>`;}
      gsh+=`<path d="M${Q.map(p=>P(p[0]+dx*L,p[1]+dy*L).join(' ')).join('L')}Z"/>`;}
    s+=`<g fill="${S.shadow}" style="mix-blend-mode:multiply">${gsh}</g>`;}}
  if(d.ext==='sky'&&EXT.sky&&EXT.sky.img&&EXT.sky.img.toDataURL){const b=EXT.sky.b,a=E.loc(b[0],b[1]),c=E.loc(b[2],b[3]),[x0,y0]=P(a[0],a[1]),[x1,y1]=P(c[0],c[1]);
    s+=`<image href="${EXT.sky.img.toDataURL('image/png')}" x="${x0}" y="${y0}" width="${(x1-x0).toFixed(1)}" height="${(y1-y0).toFixed(1)}" opacity=".92" preserveAspectRatio="none"/>`;}
  if(d.trees){const cOf=t=>{if(!d.treeCol||!EXT.hab||!EXT.hab.top)return S.tree;const i=EXT.hab.top.findIndex(([gn])=>gn===(A.GENERA[t[6]]||'?'));return i>=0?GEN_COL[i]:S.tree;};
    s+=`<g stroke="${S.treeL}" stroke-width=".6">${E.trees.map(t=>{const p=E.loc(t[4],t[5]),[x,y]=P(p[0],p[1]);return `<circle cx="${x}" cy="${y}" r="${Math.max(1.5,t[2]*sc).toFixed(1)}" fill="${cOf(t)}"/>`;}).join('')}</g>`;}
  const by=new Map();for(const b of N.blds){const c=d.bld(b);if(!by.has(c))by.set(c,[]);by.get(c).push(b);}
  for(const [c,bs] of by)s+=`<g fill="${c}" ${d.id==='ground'?'':`stroke="${S.bg}" stroke-width=".6"`}>${bs.map(b=>`<path d="${path(b.z)}"/>`).join('')}</g>`;
  if(d.ext==='walk'&&EXT.walk&&EXT.walk.segs)for(let k=2;k>=0;k--)s+=`<g fill="none" stroke="${WCOL[k]}" stroke-width="${k===0?3.2:2.4}" stroke-linecap="round" stroke-linejoin="round">${EXT.walk.segs[k].map(zz=>{let dd='';for(let i=0;i<zz.length;i+=2){const p=E.loc(zz[i],zz[i+1]),[x,y]=P(p[0],p[1]);dd+=(i?'L':'M')+x+' '+y;}return `<path d="${dd}"/>`;}).join('')}</g>`;
  s+=`</g><path d="${path(E.z)}" fill="none" stroke="${S.ink}" stroke-width="1.6"/>`;
  // Seitenleiste: Titel, Kennzahl, Legende, Quellen
  const X0=Wd+10;let y=pad+8;
  s+=`<text x="${X0}" y="${y}" font-size="13" font-weight="700" letter-spacing="1.5" fill="${S.mute}">INSPECTOR NICE · STUDIO</text>`;y+=40;
  s+=`<text x="${X0}" y="${y}" font-size="30" font-family="Syne, DM Sans, Helvetica, sans-serif" fill="${S.ink}">${esc(d.n())}</text>`;y+=26;
  if(ST.stats&&ST.stats.place){s+=`<text x="${X0}" y="${y}" font-size="14" fill="${S.mute}">${esc(ST.stats.place)} · Utrecht</text>`;y+=34;}
  if(k){s+=`<text x="${X0}" y="${y+34}" font-size="54" font-family="Syne, DM Sans, Helvetica, sans-serif" fill="${S.ink}">${esc(k.big)}</text><text x="${X0}" y="${y+58}" font-size="14" font-weight="700" fill="${S.ink}">${esc(k.unit)}</text>`;y+=82;
    if(k.target!=null&&k.v!=null){const bw=side-50,f=v=>Math.min(bw,bw*v/100);s+=`<rect x="${X0}" y="${y}" width="${bw}" height="10" rx="5" fill="${S.mute}" opacity=".25"/><rect x="${X0}" y="${y}" width="${f(k.v).toFixed(1)}" height="10" rx="5" fill="${k.v>=k.target?'#3f7f6a':'#c8553d'}"/><line x1="${X0+f(k.target)}" x2="${X0+f(k.target)}" y1="${y-5}" y2="${y+15}" stroke="${S.ink}" stroke-width="2"/><text x="${X0+f(k.target)+5}" y="${y+28}" font-size="12" fill="${S.ink}">${T('Ziel','target','doel')} ${k.target} %</text>`;y+=44;}
    s+=wrap(clean(k.sub),X0,y,side-40,13,S.mute);y+=lines(clean(k.sub),side-40,13)*17+14;}
  if(d.legend){for(const [i,[c,l]] of d.legend().entries()){const share=k&&k.parts&&ST.stats&&ST.stats.foot?` · ${A.nf(100*k.parts[i]/ST.stats.foot,0)} %`:'';s+=`<rect x="${X0}" y="${y}" width="14" height="14" rx="3" fill="${c}" stroke="${S.ink}" stroke-opacity=".25"/><text x="${X0+22}" y="${y+11.5}" font-size="13" fill="${S.ink}">${esc(l)}${share}</text>`;y+=22;}y+=10;}
  s+=wrap(clean(d.goal()),X0,y,side-40,12,S.mute);y+=lines(clean(d.goal()),side-40,12)*16+10;
  const sb=[10,20,50,100,200].find(v=>v*sc>80)||200,yb=Hd-60;
  s+=`<g transform="translate(${pad},${yb})"><rect width="${(sb*sc).toFixed(1)}" height="5" fill="${S.ink}"/><text y="22" font-size="12" fill="${S.ink}">${sb} m</text></g><g transform="translate(${pad+sb*sc+50},${yb})"><path d="M0 -12 6 8 0 4 -6 8Z" fill="${S.ink}"/><text y="24" font-size="12" text-anchor="middle" fill="${S.ink}">N</text></g>`;
  s+=`<text x="${pad}" y="${Hd-20}" font-size="11" fill="${S.mute}">${esc(srcLine(d))} · RD ${E.ox} / ${E.oy} · ${new Date().toISOString().slice(0,10)}</text>`;
  return s+'</svg>';
}
const srcLine=d=>({sky:'AHN (dsm/dtm 0,5 m, PDOK) · Sky View Factor',walk:'NWB (Rijkswaterstaat, PDOK) · Straatmeubilair Gemeente Utrecht',habitat:'Bomenkaart Gemeente Utrecht · GBIF.org',noise:'RIVM Geluidkaart wegverkeer 2022',flood:'LIWO, Rijkswaterstaat',green:'Bomenkaart Gemeente Utrecht · BGT',seal:'BGT (Kadaster / PDOK)',shade:'3D BAG · Bomenkaart Utrecht · BGT',heat:'BGT · Albedo-Literaturwerte'}[d.id]||'3D BAG (TU Delft / 3DGI, CC BY 4.0)')+' · Inspector Nice';
const lines=(t,w,fs)=>Math.max(1,Math.ceil(t.length*fs*.52/w));
function wrap(t,x,y,w,fs,col){const per=Math.max(10,Math.floor(w/(fs*.52))),words=t.split(' '),out=[];let cur='';for(const wd of words){if((cur+' '+wd).trim().length>per){out.push(cur.trim());cur=wd;}else cur+=' '+wd;}if(cur.trim())out.push(cur.trim());
  return out.map((l,i)=>`<text x="${x}" y="${y+i*fs*1.32}" font-size="${fs}" fill="${col}">${esc(l)}</text>`).join('');}

// Nur, was das Gebiet berührt (Flächen am Rahmen zugeschnitten; Gebäude bis 80 m außerhalb werfen noch Schatten hinein)
function near(E,pad){const m=A.m20(),p=(pad||0)/m,[x0,y0,x1,y1]=E.frame;
  const inB=z=>{for(let i=0;i<z.length;i+=2)if(z[i]>=x0-p&&z[i]<=x1+p&&z[i+1]>=y0-p&&z[i+1]<=y1+p)return true;return false;};
  return {surfs:E.surfs.map(s=>({...s.o,z:s.z})),blds:BL().filter(b=>inB(b.z))};}
// ── Explosionszeichnung: Gebiet in Ebenen, axonometrisch ──
function axoSvg(){
  const E=AREA.exportSet(src()),S=sty(),d=dia(),st=ST.stats||{},P0=pts(E.z,E),N=near(E,80),SL=N.surfs;
  const cx=P0.reduce((a,p)=>a+p[0],0)/P0.length,cy=P0.reduce((a,p)=>a+p[1],0)/P0.length,rad=Math.max(...P0.map(p=>Math.hypot(p[0]-cx,p[1]-cy)));
  const th=-35*Math.PI/180,ct=Math.cos(th),sn=Math.sin(th),KY=.52,W=1400,sc=560/(2*rad);
  const rot=(x,y)=>[(x-cx)*ct-(y-cy)*sn,(x-cx)*sn+(y-cy)*ct];
  const H0=Math.max(...E.blds.map(b=>b.h||0),10),plateH=2*rad*sc*KY,gap=Math.max(plateH*.62,H0*sc+40);
  const LAY=[
    {id:'ground',n:T('Boden','Ground','Bodem'),kpi:`${A.nf((st.share?st.share.bld+st.share.sealed:0),0)} % ${T('bebaut oder versiegelt','built or sealed','bebouwd of verhard')}`},
    {id:'heat',n:T('Hitzeflächen','Heat surfaces','Hitteoppervlak'),kpi:st.dark!=null?`${A.nf(st.dark,0)} % ${T('dunkle Flächen (Albedo < 0,12)','dark surfaces (albedo < 0.12)','donkere vlakken (albedo < 0,12)')}`:''},
    {id:'shade',n:T('Wege & Schatten','Paths & shade','Paden & schaduw'),kpi:st.pathShade!=null?`${A.nf(st.pathShade,0)} % ${T('der Wege beschattet · Richtwert 40 %','of paths shaded · guideline 40 %','van de paden in schaduw · richtwaarde 40 %')}`:''},
    {id:'green',n:T('Grün & Bäume','Green & trees','Groen & bomen'),kpi:st.canopy!=null?`${A.nf(st.canopy,0)} % ${T('Kronendach · Ziel 30 %','canopy · target 30 %','kronendak · doel 30 %')}`:''},
    {id:'bld',n:T('Gebäude','Buildings','Gebouwen'),kpi:`${A.fmt(E.blds.length)} ${T('Gebäude','buildings','gebouwen')}${st.yKnown?` · ${A.nf(100*(st.byY[0]+st.byY[1])/st.yKnown,0)} % ${T('vor 1975','before 1975','vóór 1975')}`:''}`}];
  const nL=LAY.length,top=60+H0*sc,Hs=Math.round(top+gap*(nL-1)+plateH+120);
  const pr=(x,y,zm,lv)=>{const [u,v]=rot(x,y);return [W*.38+u*sc,top+gap*(nL-1-lv)+plateH/2-v*sc*KY-zm*sc];};
  const pp=(P,lv,zm)=>P.map(p=>pr(p[0],p[1],zm||0,lv).map(v=>v.toFixed(1)).join(' ')).join('L');
  const sp=(z,lv)=>'M'+pp(pts(z,E),lv)+'Z';
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hs}" viewBox="0 0 ${W} ${Hs}" font-family="DM Sans, Helvetica, Arial, sans-serif"><rect width="${W}" height="${Hs}" fill="${S.bg}"/><defs>`;
  LAY.forEach((l,i)=>{s+=`<clipPath id="c${i}"><path d="M${pp(P0,i)}Z"/></clipPath>`;});s+='</defs>';
  const sun=refSun(),inA=b=>true;
  LAY.forEach((l,i)=>{
    const plate=`M${pp(P0,i)}Z`;
    s+=`<g><path d="${plate}" fill="${S.plate}" fill-opacity=".92" stroke="${S.ink}" stroke-width="1.1"/><g clip-path="url(#c${i})">`;
    if(l.id==='ground'){const by=new Map();for(const o of SL){const c=SEAL_COL[o.c];if(!by.has(c))by.set(c,[]);by.get(c).push(o);}for(const [c,os] of by)s+=`<g fill="${c}" fill-opacity=".85">${os.map(o=>`<path d="${sp(o.z,i)}"/>`).join('')}</g>`;}
    if(l.id==='heat')s+=`<g fill="#d0583c">${SL.filter(o=>o.c!==3&&o.c!==2&&(o.a||0)<.12).map(o=>`<path d="${sp(o.z,i)}"/>`).join('')}</g>`;
    if(l.id==='shade'){s+=`<g fill="${S.path}">${SL.filter(isPath).map(o=>`<path d="${sp(o.z,i)}"/>`).join('')}</g>`;
      if(sun.alt>.02){const dx=Math.sin(sun.az),dy=Math.cos(sun.az),t=Math.tan(sun.alt);let g='';
        for(const b of N.blds){if(!(b.h>=1))continue;const L=Math.min(600,b.h/t),Q=pts(b.z,E),n=Q.length;for(let j=0;j<n;j++){const a=Q[j],c=Q[(j+1)%n];g+=`<path d="M${pp([a,c,[c[0]+dx*L,c[1]+dy*L],[a[0]+dx*L,a[1]+dy*L]],i)}Z"/>`;}}
        for(const tr of E.trees){const L=Math.min(250,tr[3]*.65/t),p=E.loc(tr[4],tr[5]),[x,y]=pr(p[0]+dx*L,p[1]+dy*L,0,i);g+=`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(tr[2]*sc).toFixed(1)}" ry="${(tr[2]*sc*KY).toFixed(1)}"/>`;}
        s+=`<g fill="${S.shadow}">${g}</g>`;}}
    if(l.id==='green'){s+=`<g fill="${S.green}">${SL.filter(o=>o.c===2).map(o=>`<path d="${sp(o.z,i)}"/>`).join('')}</g>`;
      s+=`<g fill="#4f7a3a" fill-opacity=".75" stroke="${S.treeL}" stroke-width=".4">${E.trees.map(t=>{const p=E.loc(t[4],t[5]),[x,y]=pr(p[0],p[1],0,i);return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${Math.max(1.2,t[2]*sc).toFixed(1)}" ry="${Math.max(.8,t[2]*sc*KY).toFixed(1)}"/>`;}).join('')}</g>`;}
    s+='</g>';
    if(l.id==='bld'){   // Körper von hinten nach vorn; sichtbar sind Wände, deren Außennormale zum Betrachter zeigt
      const bs=E.blds.map(b=>{const Q=pts(b.z,E),c=Q.reduce((a,p)=>[a[0]+p[0]/Q.length,a[1]+p[1]/Q.length],[0,0]);return {b,Q,dep:rot(c[0],c[1])[1]};}).sort((a,b)=>b.dep-a.dep);
      const col=b=>{const c=d.bld(b);return c===S.mute||c===S.bld?S.plate:c;};
      for(const {b,Q} of bs){const h=Math.max(.5,b.h||3),ccw=sArea(Q)>0,n=Q.length;let w='';
        for(let j=0;j<n;j++){const a=Q[j],c=Q[(j+1)%n],nx=ccw?(c[1]-a[1]):-(c[1]-a[1]),ny=ccw?-(c[0]-a[0]):(c[0]-a[0]),rn=rot(nx+cx,ny+cy);if(rn[1]>=0)continue;
          const lit=.55+.45*cl01((rn[0]*.7-rn[1]*.3)/Math.hypot(nx,ny));w+=`<path d="M${pp([a,c],i)}L${pp([c,a],i,h)}Z" fill="${S.ink}" fill-opacity="${(.5-.32*lit).toFixed(2)}"/>`;}
        s+=`<g stroke="${S.ink}" stroke-width=".35" stroke-linejoin="round"><path d="M${pp(Q,i)}Z" fill="${col(b)}"/>${w}<path d="M${pp(Q,i,h)}Z" fill="${col(b)}"/></g>`;}}
    s+='</g>';
    const rx=Math.max(...P0.map(p=>pr(p[0],p[1],0,i)[0])),ry=pr(cx,cy,0,i)[1];
    s+=`<line x1="${rx+12}" x2="${W*.72}" y1="${ry}" y2="${ry}" stroke="${S.ink}" stroke-width=".8" stroke-dasharray="2 3"/><circle cx="${rx+12}" cy="${ry}" r="2.5" fill="${S.ink}"/>`;
    s+=`<text x="${W*.73}" y="${ry-4}" font-size="22" font-family="Syne, DM Sans, Helvetica, sans-serif" fill="${S.ink}">${esc(l.n)}</text>${l.kpi?`<text x="${W*.73}" y="${ry+18}" font-size="13.5" fill="${S.mute}">${esc(l.kpi)}</text>`:''}`;
  });
  const nv=rot(cx,cy+1),na=Math.atan2(-(nv[1])*KY,nv[0]);
  s+=`<g transform="translate(60,${Hs-70}) rotate(${(na*180/Math.PI+90).toFixed(1)})"><path d="M0 -16 7 10 0 5 -7 10Z" fill="${S.ink}"/></g><text x="60" y="${Hs-34}" font-size="12" text-anchor="middle" fill="${S.ink}">N</text>`;
  s+=`<text x="110" y="${Hs-60}" font-size="13" font-weight="700" letter-spacing="1.5" fill="${S.mute}">INSPECTOR NICE · ${esc(T('EXPLOSIONSZEICHNUNG','EXPLODED VIEW','EXPLOSIETEKENING'))}${st.place?' · '+esc(st.place.toUpperCase()):''}</text>`;
  s+=`<text x="110" y="${Hs-40}" font-size="11.5" fill="${S.mute}">${esc(T('Gebäudehöhen maßstäblich (3D BAG) · Schatten 21. Juni 15 Uhr · BGT · Bomenkaart Utrecht','Building heights to scale (3D BAG) · shade 21 June 3 pm · BGT · Utrecht tree register','Gebouwhoogtes op schaal (3D BAG) · schaduw 21 juni 15 uur · BGT · Bomenkaart Utrecht'))} · ${new Date().toISOString().slice(0,10)}</text>`;
  return s+'</svg>';
}
function overlay(svg,name){
  closeOv();const o=document.createElement('div');o.className='st-ov';o.setAttribute('role','dialog');o.setAttribute('aria-label',name);
  o.innerHTML=`<div class="st-ovh"><b>${name}</b><button class="cta lab-mini" data-dl>${T('SVG herunterladen','Download SVG','SVG downloaden')}</button><button class="lab-x st-x" aria-label="${T('Schließen','Close','Sluiten')}">×</button></div><div class="st-ovb">${svg}</div>`;
  document.body.appendChild(o);ST.ov=o;
  o.querySelector('[data-dl]').onclick=()=>download(`inspector-nice_${ST.dia}_${stamp()}.svg`,svg,'image/svg+xml');
  o.querySelector('.st-x').onclick=closeOv;o.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closeOv();}});o.tabIndex=-1;o.focus();
}
function closeOv(){if(ST.ov){ST.ov.remove();ST.ov=null;}}
const stamp=()=>new Date().toISOString().slice(0,10);
function download(name,data,type){const b=data instanceof Blob?data:new Blob([data],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);return b.size;}

// ══════════════════════════════════════════════════════════════
// Lasercut-Modell
// ══════════════════════════════════════════════════════════════
// Vereinigung von Grundrissen über Kanten: Ecken verschweißen, T-Stöße teilen,
// gemeinsame Kanten (gegenläufig) streichen, Rest zu Ringen verketten.
function unionRings(rings,tol){
  const V=[],grid=new Map(),cg=new Map(),CG=2;
  const weld=(x,y)=>{const gx=Math.round(x/tol),gy=Math.round(y/tol);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const a=grid.get((gx+i)+','+(gy+j));if(a)for(const id of a){const v=V[id];if(Math.abs(v[0]-x)<=tol&&Math.abs(v[1]-y)<=tol)return id;}}
    const id=V.length;V.push([x,y]);const k=gx+','+gy;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(id);const c=Math.floor(x/CG)+','+Math.floor(y/CG);if(!cg.has(c))cg.set(c,[]);cg.get(c).push(id);return id;};
  const E=[];
  for(const r of rings){let ids=r.map(p=>weld(p[0],p[1]));ids=ids.filter((v,i)=>v!==ids[(i+ids.length-1)%ids.length]);if(ids.length<3)continue;
    let a=0;for(let i=0;i<ids.length;i++){const p=V[ids[i]],q=V[ids[(i+1)%ids.length]];a+=p[0]*q[1]-q[0]*p[1];}if(Math.abs(a)<1e-6)continue;if(a<0)ids.reverse();
    for(let i=0;i<ids.length;i++)E.push([ids[i],ids[(i+1)%ids.length]]);}
  const E2=[];
  for(const [a,b] of E){const p=V[a],q=V[b],dx=q[0]-p[0],dy=q[1]-p[1],L2=dx*dx+dy*dy;if(!L2)continue;const on=[];
    for(let gx=Math.floor(Math.min(p[0],q[0])/CG);gx<=Math.floor(Math.max(p[0],q[0])/CG);gx++)for(let gy=Math.floor(Math.min(p[1],q[1])/CG);gy<=Math.floor(Math.max(p[1],q[1])/CG);gy++){const c=cg.get(gx+','+gy);if(!c)continue;
      for(const id of c){if(id===a||id===b)continue;const v=V[id],t=((v[0]-p[0])*dx+(v[1]-p[1])*dy)/L2;if(t<=1e-6||t>=1-1e-6)continue;const ex=p[0]+t*dx-v[0],ey=p[1]+t*dy-v[1];if(ex*ex+ey*ey<=tol*tol)on.push([t,id]);}}
    if(!on.length){E2.push([a,b]);continue;}on.sort((u,w)=>u[0]-w[0]);let s=a;for(const [,id] of on){if(id!==s)E2.push([s,id]);s=id;}if(s!==b)E2.push([s,b]);}
  const cnt=new Map();for(const [a,b] of E2){const k=a+'>'+b;cnt.set(k,(cnt.get(k)||0)+1);}
  const out=new Map(),keep=[];const seen=new Set();
  for(const [a,b] of E2){const k=a+'>'+b;if(seen.has(k)||cnt.get(b+'>'+a))continue;seen.add(k);keep.push([a,b]);}
  keep.forEach((e,i)=>{if(!out.has(e[0]))out.set(e[0],[]);out.get(e[0]).push(i);});
  const used=new Uint8Array(keep.length),res=[];
  for(let i=0;i<keep.length;i++){if(used[i])continue;const ring=[];let e=i,guard=0;
    while(!used[e]&&guard++<100000){used[e]=1;const [a,b]=keep[e];ring.push(a);const nx=(out.get(b)||[]).filter(j=>!used[j]);if(!nx.length)break;
      if(nx.length===1){e=nx[0];continue;}const pa=V[a],pb=V[b],h=Math.atan2(pb[1]-pa[1],pb[0]-pa[0]);let best=nx[0],bt=Infinity;
      for(const j of nx){const pc=V[keep[j][1]],t=((Math.atan2(pc[1]-pb[1],pc[0]-pb[0])-h+3*Math.PI)%(2*Math.PI));if(t<bt){bt=t;best=j;}}e=best;}
    if(ring.length>=3)res.push(simplify(ring.map(id=>V[id]),tol));}
  return res.filter(r=>r.length>=3&&Math.abs(sArea(r))>tol*tol*4);
}
function simplify(P,tol){let Q=P.slice(),ch=true;
  while(ch&&Q.length>3){ch=false;for(let i=0;i<Q.length;i++){const a=Q[(i+Q.length-1)%Q.length],b=Q[i],c=Q[(i+1)%Q.length],L=Math.hypot(c[0]-a[0],c[1]-a[1]);
    const d=L?Math.abs((c[0]-a[0])*(a[1]-b[1])-(a[0]-b[0])*(c[1]-a[1]))/L:0;if(d<tol*.5||Math.hypot(b[0]-a[0],b[1]-a[1])<tol*.5){Q.splice(i,1);ch=true;break;}}}
  return Q;}
// Teile: Außenring (gegen Uhrzeigersinn) mit Löchern
function piecesOf(rings){
  const outs=rings.filter(r=>sArea(r)>0).map(r=>({o:r,h:[],a:sArea(r)})),holes=rings.filter(r=>sArea(r)<0);
  for(const h of holes){const p=h[0];let best=null;for(const o of outs)if(pIn(p[0],p[1],o.o)&&(!best||o.a<best.a))best=o;if(best)best.h.push(h);}
  return outs;
}
// Einstrich-Schrift für Gravuren (Raster 4 × 6)
const GLY={'0':'0,0 4,0 4,6 0,6 0,0;0,0 4,6','1':'1,5 2,6 2,0;1,0 3,0','2':'0,5 1,6 3,6 4,5 4,4 0,0 4,0','3':'0,6 4,6 2,4 3,4 4,3 4,1 3,0 1,0 0,1','4':'3,0 3,6 0,2 4,2','5':'4,6 0,6 0,4 3,4 4,3 4,1 3,0 0,0',
  '6':'4,6 1,6 0,5 0,1 1,0 3,0 4,1 4,2 3,3 0,3','7':'0,6 4,6 1,0','8':'1,3 0,4 0,5 1,6 3,6 4,5 4,4 3,3 1,3 0,2 0,1 1,0 3,0 4,1 4,2 3,3','9':'0,0 3,0 4,1 4,5 3,6 1,6 0,5 0,4 1,3 4,3',
  A:'0,0 0,4 2,6 4,4 4,0;0,3 4,3',B:'0,0 0,6 3,6 4,5 4,4 3,3 0,3;3,3 4,2 4,1 3,0 0,0',C:'4,6 1,6 0,5 0,1 1,0 4,0',D:'0,0 0,6 3,6 4,5 4,1 3,0 0,0',E:'4,6 0,6 0,0 4,0;0,3 3,3',F:'4,6 0,6 0,0;0,3 3,3',
  G:'4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1 4,3 2,3',H:'0,0 0,6;4,0 4,6;0,3 4,3',I:'1,6 3,6;2,6 2,0;1,0 3,0',J:'4,6 4,1 3,0 1,0 0,1',K:'0,0 0,6;4,6 0,2;1,3 4,0',L:'0,6 0,0 4,0',M:'0,0 0,6 2,3 4,6 4,0',N:'0,0 0,6 4,0 4,6',
  O:'1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0',P:'0,0 0,6 3,6 4,5 4,4 3,3 0,3',Q:'1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0;3,1 4,0',R:'0,0 0,6 3,6 4,5 4,4 3,3 0,3;2,3 4,0',S:'4,5 3,6 1,6 0,5 0,4 1,3 3,3 4,2 4,1 3,0 1,0 0,1',
  T:'0,6 4,6;2,6 2,0',U:'0,6 0,1 1,0 3,0 4,1 4,6',V:'0,6 2,0 4,6',W:'0,6 1,0 2,3 3,0 4,6',X:'0,0 4,6;0,6 4,0',Y:'0,6 2,3 4,6;2,3 2,0',Z:'0,6 4,6 0,0 4,0','.':'2,0 2,.7','-':'1,3 3,3',':':'2,1 2,1.7;2,4 2,4.7','/':'0,0 4,6','=':'1,2 3,2;1,4 3,4'};
const up=s=>String(s).toUpperCase().replace(/Ä/g,'AE').replace(/Ö/g,'OE').replace(/Ü/g,'UE').replace(/ß/g,'SS').replace(/[×]/g,'X').replace(/,/g,'.');
function strokeText(txt,x,y,h){   // x,y = links unten (mm, y nach unten); Rückgabe: Polylinien
  const u=h/6,out=[];let cx=x;for(const ch of up(txt)){const g=GLY[ch];if(g)for(const part of g.split(';'))out.push(part.split(' ').map(p=>{const [a,b]=p.split(',').map(Number);return [cx+a*u,y-b*u];}));cx+=5.5*u;}return out;}
const textW=(txt,h)=>up(txt).length*5.5*h/6-1.5*h/6;
// Schraffur einer Fläche (Wasser) innerhalb der Grundplatte
function hatch(P,clipP,step){
  const ys=P.map(p=>p[1]),out=[];
  for(let y=Math.min(...ys)+step/2;y<Math.max(...ys);y+=step){const xs=[];for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
    xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2){const n=Math.max(1,Math.ceil((xs[i+1]-xs[i])/(step/2)));let s=null;
      for(let k=0;k<=n;k++){const x=xs[i]+(xs[i+1]-xs[i])*k/n,inn=pIn(x,y,clipP);if(inn&&s==null)s=x;if((!inn||k===n)&&s!=null){const e=inn?x:xs[i]+(xs[i+1]-xs[i])*(k-1)/n;if(e-s>.05)out.push([[s,y],[e,y]]);s=null;}}}}
  return out;}
async function buildLaser(){
  const O=ST.laser,E=AREA.exportSet(src()),f=1000/O.scale,Hl=O.th*O.scale/1000,tol=Math.max(.06,.12*O.scale/1000);
  const P0=pts(E.z,E),xs=P0.map(p=>p[0]),ys=P0.map(p=>p[1]),ox=Math.min(...xs),oy=Math.max(...ys);
  const mm=p=>[(p[0]-ox)*f,(oy-p[1])*f];   // Modell-mm, y nach unten
  // Gebäude → Schichtzahl
  const B=E.blds.filter(b=>b.h!=null).map(b=>({P:pts(b.z,E),n:Math.max(0,Math.round(b.h/Hl)),h:b.h})).filter(b=>b.n>0);
  const K=Math.min(150,Math.max(0,...B.map(b=>b.n)));
  const levels=[];for(let k=1;k<=K;k++){levels.push(unionRings(B.filter(b=>b.n>=k).map(b=>b.P),tol));if(k%4===0)await A.yieldNow();}
  // Grundplatte
  const base={cut:[P0.map(mm)],eng:[],holes:[],lbl:'0'};
  for(const r of levels[0]||[])base.eng.push(r.map(mm).concat([mm(r[0])]));
  if(O.roads||O.green||O.water)for(const o of E.surfs){const t=LAB.street?LAB.street.typeOf(o):'';const want=(O.roads&&(t==='car'||t==='transit'||t==='bike'))||(O.green&&o.c===2)||(O.water&&o.c===3);if(!want)continue;
    const Q=pts(o.z,E);for(let i=0;i<Q.length;i++){const a=Q[i],b=Q[(i+1)%Q.length];if(pIn(a[0],a[1],P0)&&pIn(b[0],b[1],P0))base.eng.push([mm(a),mm(b)]);}
    if(O.water&&o.c===3)for(const s of hatch(Q.map(mm),P0.map(mm),1.6))base.eng.push(s);}
  if(O.trees){const foot=levels[0]||[];for(const t of E.trees){const p=E.loc(t[4],t[5]);if(!pIn(p[0],p[1],P0)||foot.some(r=>pIn(p[0],p[1],r)))continue;base.holes.push(mm(p));}}
  // Teile je Schicht, mit Gravur der nächsten Schicht und Nummer
  const parts=[{...base,w:0,h:0,kind:'base'}];let small=0;
  levels.forEach((rings,i)=>{const next=levels[i+1]||[];let j=0;
    for(const pc of piecesOf(rings)){const ring=pc.o.map(mm),bb=bbox(ring);if(bb[2]-bb[0]<1.2||bb[3]-bb[1]<1.2){small++;continue;}j++;
      const cutR=[ring,...pc.h.map(h=>h.map(mm))],inside=r=>r.some(p=>pIn(p[0],p[1],pc.o)&&!pc.h.some(h=>pIn(p[0],p[1],h)));
      const eng=next.filter(inside).flatMap(r=>offEdge(r.map(mm).concat([mm(r[0])]),cutR,.25));
      parts.push({cut:cutR,eng,holes:[],lbl:`${i+1}.${j}`,kind:'level',lv:i+1});}});
  // Nummern einbetten und packen
  const [bw,bh]=O.bed.split('x').map(Number),M=5,GAP=2,FOOT=9,UW=bw-2*M,UH=bh-2*M-FOOT;
  for(const p of parts){const bb=bbox(p.cut[0]);p.bb=bb;p.w=bb[2]-bb[0];p.h=bb[3]-bb[1];
    if(p.kind==='level'){const th=Math.min(2.4,p.h*.4,p.w/Math.max(1,textW(p.lbl,1)+.6));if(th>=1){const pt=inner(p.cut[0],p.cut.slice(1));if(pt)p.txt=strokeText(p.lbl,pt[0]-textW(p.lbl,th)/2,pt[1]+th/2,th);}}}
  const sheets=[],over=[];let sh=null,x=0,y=0,rowH=0;
  const order=parts.slice(1).sort((a,b)=>b.h-a.h);order.unshift(parts[0]);
  for(const p of order){if(p.w>UW||p.h>UH){over.push(p);continue;}
    if(!sh||x+p.w>UW){if(sh&&y+rowH+GAP+p.h<=UH){y+=rowH+GAP;x=0;rowH=0;}else{sh={items:[]};sheets.push(sh);x=0;y=0;rowH=0;}}
    p.dx=M+x-p.bb[0];p.dy=M+y-p.bb[1];sh.items.push(p);x+=p.w+GAP;rowH=Math.max(rowH,p.h);}
  // Längen
  const len=pl=>{let s=0;for(let i=1;i<pl.length;i++)s+=Math.hypot(pl[i][0]-pl[i-1][0],pl[i][1]-pl[i-1][1]);return s;};
  let cut=0,eng=0;for(const p of parts){if(over.includes(p))continue;for(const r of p.cut)cut+=len(r.concat([r[0]]));cut+=p.holes.length*Math.PI*O.treeD;for(const e of p.eng)eng+=len(e);for(const t of p.txt||[])eng+=len(t);}
  const nLv=levels.map(r=>piecesOf(r).length);
  return {O,Hl,K,parts,sheets,over,small,cut,eng,nLv,bw,bh,E,baseW:parts[0].w,baseH:parts[0].h,levels,mm,P0,f,B};
}
// Gravur nicht auf der Schnittkante: Abschnitte, die auf einer Kante des Teils liegen, fallen weg (sonst fährt der Laser doppelt)
const dSeg=(x,y,p,q)=>{const dx=q[0]-p[0],dy=q[1]-p[1],L2=dx*dx+dy*dy,t=L2?Math.max(0,Math.min(1,((x-p[0])*dx+(y-p[1])*dy)/L2)):0;return Math.hypot(p[0]+t*dx-x,p[1]+t*dy-y);};
function offEdge(pl,rings,tl){const on=(a,b)=>{const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;for(const R of rings)for(let i=0;i<R.length;i++)if(dSeg(mx,my,R[i],R[(i+1)%R.length])<tl)return true;return false;};
  const out=[];let cur=[pl[0]];for(let i=1;i<pl.length;i++){if(on(pl[i-1],pl[i])){if(cur.length>1)out.push(cur);cur=[pl[i]];}else cur.push(pl[i]);}if(cur.length>1)out.push(cur);return out;}
function bbox(P){let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;for(const p of P){a=Math.min(a,p[0]);c=Math.max(c,p[0]);b=Math.min(b,p[1]);d=Math.max(d,p[1]);}return [a,b,c,d];}
function inner(P,holes){   // Punkt im Inneren: Mitte der breitesten Spanne auf mittlerer Höhe
  const bb=bbox(P);let best=null,bw=0;for(const fy of [.5,.35,.65]){const y=bb[1]+(bb[3]-bb[1])*fy,xs=[];for(const R of [P,...holes])for(let i=0;i<R.length;i++){const a=R[i],b=R[(i+1)%R.length];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
    xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)if(xs[i+1]-xs[i]>bw){bw=xs[i+1]-xs[i];best=[(xs[i]+xs[i+1])/2,y];}}return best;}
const n2=v=>(Math.round(v*100)/100).toString();
function sheetSvg(L,sh,i){
  const {bw,bh,O}=L,mv=(p,P)=>P.map(q=>[q[0]+p.dx,q[1]+p.dy]),d=(P,close)=>'M'+P.map(q=>n2(q[0])+' '+n2(q[1])).join('L')+(close?'Z':'');
  let c='',e='';
  for(const p of sh.items){for(const r of p.cut)c+=`<path d="${d(mv(p,r),true)}"/>`;for(const h of p.holes){const [x,y]=[h[0]+p.dx,h[1]+p.dy];c+=`<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(O.treeD/2)}"/>`;}
    for(const q of p.eng)e+=`<path d="${d(mv(p,q),false)}"/>`;for(const t of p.txt||[])e+=`<path d="${d(mv(p,t),false)}"/>`;}
  for(const t of strokeText(`INSPECTOR NICE 1:${O.scale} ${A.nf(O.th,1)} MM PLATTE ${i+1}/${L.sheets.length}`,5,bh-4,3))e+=`<path d="${d(t,false)}"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${bw}mm" height="${bh}mm" viewBox="0 0 ${bw} ${bh}">\n<!-- Inspector Nice · Lasercut-Modell · Platte ${i+1}/${L.sheets.length} · Maßstab 1:${O.scale} · Materialstärke ${O.th} mm (1 Schicht = ${A.nf(L.Hl,2)} m) · rot = schneiden, blau = gravieren · Quellen: 3D BAG (CC BY 4.0), BGT, Bomenkaart Utrecht -->\n<g id="SCHNEIDEN" fill="none" stroke="#ff0000" stroke-width="0.05">${c}</g>\n<g id="GRAVIEREN" fill="none" stroke="#0000ff" stroke-width="0.05">${e}</g>\n</svg>`;
}
function sheetDxf(L,sh,i){
  const {bh,O}=L,out=[],add=(...a)=>{for(const x of a)out.push(String(x));},f=v=>(Math.round(v*1000)/1000).toString(),Y=y=>bh-y;
  add(999,`Inspector Nice Lasercut Platte ${i+1}/${L.sheets.length} Massstab 1:${O.scale} Material ${O.th} mm Einheit mm`);
  add(0,'SECTION',2,'TABLES',0,'TABLE',2,'LAYER',70,2,0,'LAYER',2,'SCHNEIDEN',70,0,62,1,6,'CONTINUOUS',0,'LAYER',2,'GRAVIEREN',70,0,62,5,6,'CONTINUOUS',0,'ENDTAB',0,'ENDSEC',0,'SECTION',2,'ENTITIES');
  const pl=(layer,P,close)=>{add(0,'POLYLINE',8,layer,66,1,70,close?1:0,10,0,20,0,30,0);for(const q of P)add(0,'VERTEX',8,layer,10,f(q[0]),20,f(Y(q[1])),30,0);add(0,'SEQEND',8,layer);};
  for(const p of sh.items){const mv=P=>P.map(q=>[q[0]+p.dx,q[1]+p.dy]);for(const r of p.cut)pl('SCHNEIDEN',mv(r),true);for(const h of p.holes)add(0,'CIRCLE',8,'SCHNEIDEN',10,f(h[0]+p.dx),20,f(Y(h[1]+p.dy)),30,0,40,f(O.treeD/2));
    for(const q of p.eng)pl('GRAVIEREN',mv(q),false);for(const t of p.txt||[])pl('GRAVIEREN',mv(t),false);}
  for(const t of strokeText(`INSPECTOR NICE 1:${O.scale} ${A.nf(O.th,1)} MM PLATTE ${i+1}/${L.sheets.length}`,5,bh-4,3))pl('GRAVIEREN',t,false);
  add(0,'ENDSEC',0,'EOF');return out.join('\n');
}
function planSvg(L){   // Montageplan: Grundplatte mit Schichtzahl je Gebäude
  const {baseW,baseH,O}=L,pad=15,W=Math.round(baseW+2*pad),H=Math.round(baseH+2*pad+24),d=P=>'M'+P.map(q=>n2(q[0]+pad)+' '+n2(q[1]+pad)).join('L')+'Z';
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" font-family="DM Sans, Helvetica, Arial, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/><path d="${d(L.P0.map(L.mm))}" fill="#f1ede5" stroke="#17151c" stroke-width=".3"/>`;
  const mx=Math.max(1,L.K);for(const b of L.B){const P=b.P.map(L.mm),c=P.reduce((a,p)=>[a[0]+p[0]/P.length,a[1]+p[1]/P.length],[0,0]),g=Math.round(235-180*b.n/mx);
    s+=`<path d="${d(P)}" fill="rgb(${g},${g},${g+8})" stroke="#17151c" stroke-width=".12"/>`;const bb=bbox(P);if(Math.min(bb[2]-bb[0],bb[3]-bb[1])>3.2)s+=`<text x="${n2(c[0]+pad)}" y="${n2(c[1]+pad+1)}" font-size="2.6" text-anchor="middle" fill="${g<130?'#fff':'#17151c'}">${b.n}</text>`;}
  s+=`<text x="${pad}" y="${H-8}" font-size="4" fill="#17151c">Montageplan · Zahl = Schichten je Gebäude (1 Schicht = ${A.nf(L.Hl,2)} m) · Teile tragen „Schicht.Nummer" · Maßstab 1:${O.scale}</text>`;
  return s+'</svg>';
}
function readme(L){
  const {O}=L;const lv=L.nLv.map((n,i)=>`  Schicht ${i+1} (${A.nf((i+1)*L.Hl,1)} m): ${n} Teile`).join('\n');
  return `INSPECTOR NICE · LASERCUT-MODELL
Erzeugt ${new Date().toISOString().slice(0,16).replace('T',' ')} · ${ST.stats&&ST.stats.place?ST.stats.place+', ':''}Utrecht

Maßstab 1:${O.scale} · Materialstärke ${O.th} mm · 1 Schicht = ${A.nf(L.Hl,2)} m echte Höhe
Laserbett ${O.bed.replace('x',' × ')} mm · ${L.sheets.length} Platten · ${L.parts.length-L.over.length} Teile
Schnittlänge ${A.nf(L.cut/1000,1)} m · Gravurlänge ${A.nf(L.eng/1000,1)} m
Grundplatte ${A.nf(L.baseW,0)} × ${A.nf(L.baseH,0)} mm${L.over.length?`\nACHTUNG: ${L.over.length} Teil(e) größer als das Laserbett — kleinerer Maßstab oder kleinere Fläche.`:''}${L.small?`\n${L.small} Kleinstteile (unter 1,2 mm) weggelassen.`:''}

DATEIEN
  platte-N.svg / platte-N.dxf  je Platte, Einheit mm
  montageplan.svg              Grundplatte mit Schichtzahl je Gebäude
FARBEN / EBENEN
  rot  #FF0000 / SCHNEIDEN  = durchschneiden
  blau #0000FF / GRAVIEREN  = gravieren (Lage der nächsten Schicht, Straßen, Wasser-Schraffur, Nummern)
  Strichstärke 0,05 mm — je nach Laser-Software als Haarlinie einstellen.

ZUSAMMENBAU
  1. Grundplatte: graviert sind Gebäudeumrisse${O.roads?', Fahrbahnen und Radwege':''}${O.water?', Wasser (Schraffur)':''}${O.trees?`; Löcher Ø ${A.nf(O.treeD,1)} mm für Modellbäume`:''}.
  2. Teile tragen „Schicht.Nummer" (z. B. 3.12). Schicht 1 auf die Gravur der Grundplatte kleben,
     jede weitere Schicht auf die Gravur der darunterliegenden.
  3. Gebäude gleicher Höhe, die sich berühren, sind je Schicht zu einem Teil vereinigt.
${lv}

GRUNDLAGEN
  Gebäudehöhe = 70-%-Dachhöhe − Gelände (3D BAG, LoD 1.2), auf ganze Schichten gerundet.
  Gelände flach angenommen (Utrecht: wenige Meter Unterschied).
  Quellen: 3D BAG (TU Delft / 3DGI, CC BY 4.0) · BGT (Kadaster / PDOK) · Bomenkaart Gemeente Utrecht
  Koordinaten: Rijksdriehoek, lokaler Ursprung X=${L.E.ox} Y=${L.E.oy}
`;
}
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function zip(files){   // ZIP ohne Kompression (Methode 0), Namen in UTF-8
  const enc=new TextEncoder(),parts=[],cd=[];let off=0;const d=new Date();
  const tm=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),dt=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  for(const f of files){const nm=enc.encode(f.name),data=typeof f.data==='string'?enc.encode(f.data):f.data,crc=crc32(data);
    const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint16(10,tm,true);h.setUint16(12,dt,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,nm.length,true);h.setUint16(28,0,true);
    parts.push(new Uint8Array(h.buffer),nm,data);
    const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);c.setUint16(12,tm,true);c.setUint16(14,dt,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
    cd.push(new Uint8Array(c.buffer),nm);off+=30+nm.length+data.length;}
  const size=cd.reduce((s,p)=>s+p.length,0),e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,off,true);
  const all=new Uint8Array(off+size+22);let p=0;for(const a of [...parts,...cd,new Uint8Array(e.buffer)]){all.set(a,p);p+=a.length;}return all;
}
function laserFiles(L){
  const F=[];L.sheets.forEach((sh,i)=>{F.push({name:`platte-${i+1}.svg`,data:sheetSvg(L,sh,i)});F.push({name:`platte-${i+1}.dxf`,data:sheetDxf(L,sh,i)});});
  F.push({name:'montageplan.svg',data:planSvg(L)});F.push({name:'anleitung.txt',data:readme(L)});return F;
}
const SCALES=[200,250,500,750,1000,1250,1500,2000,2500,5000];
const fitScale=(L)=>{const [bw,bh]=L.O.bed.split('x').map(Number),m=[L.baseW*L.O.scale/1000,L.baseH*L.O.scale/1000];
  return SCALES.find(s=>m[0]*1000/s<=bw-10&&m[1]*1000/s<=bh-19)||5000;};

// ── Bedienung ──
function laserPanel(){
  const O=ST.laser,L=O.res,ch=(k,vals,fmt)=>`<div class="wt-chips st-ch">${vals.map(v=>`<button data-lo="${k}" data-v="${v}" class="${String(O[k])===String(v)?'on':''}">${fmt(v)}</button>`).join('')}</div>`;
  const ck=(k,l)=>`<label class="ex-ck"><input type="checkbox" data-lc="${k}" ${O[k]?'checked':''}><span>${l}</span></label>`;
  let h=`<div class="st-lz"><div class="st-lbl">${T('Maßstab','Scale','Schaal')}${O.auto&&L?` · ${T('passend zum Laserbett gewählt','chosen to fit the laser bed','gekozen passend bij het laserbed')}`:''}</div>${ch('scale',[...new Set([500,1000,2000,O.scale])].sort((a,b)=>a-b),v=>'1:'+v)}
    <div class="st-lbl">${T('Materialstärke','Material thickness','Materiaaldikte')} · ${T('1 Schicht','1 layer','1 laag')} = ${A.nf(O.th*O.scale/1000,2)} m</div>${ch('th',[1,1.5,2,3],v=>A.nf(v,1)+' mm')}
    <div class="st-lbl">${T('Laserbett','Laser bed','Laserbed')}</div>${ch('bed',['300x200','600x400','1000x600'],v=>v.replace('x',' × '))}
    <div class="ex-cks">${ck('roads',T('Fahrbahnen gravieren','Engrave roads','Rijbanen graveren'))}${ck('water',T('Wasser schraffieren','Hatch water','Water arceren'))}${ck('green',T('Grünflächen gravieren','Engrave green','Groen graveren'))}${ck('trees',T('Baumlöcher Ø 1 mm','Tree holes Ø 1 mm','Boomgaten Ø 1 mm'))}</div>
    <button class="cta lab-mini" id="stLz">${T('Platten berechnen','Compute sheets','Platen berekenen')}</button>`;
  if(O.busy)h+=`<p class="lab-hint"><span class="lab-spin" aria-hidden="true"></span> ${T('Grundrisse werden je Schicht vereinigt …','Merging footprints per layer …','Contouren per laag samenvoegen …')}</p>`;
  if(L&&!O.busy){const fs=fitScale(L);
    h+=`<div class="ar-grid st-lg"><div><b>${L.sheets.length}</b><span>${T('Platten','sheets','platen')} ${O.bed.replace('x',' × ')} mm</span></div><div><b>${A.fmt(L.parts.length-L.over.length)}</b><span>${T('Teile','parts','onderdelen')} · ${L.K} ${T('Schichten','layers','lagen')}</span></div>
      <div><b>${A.nf(L.cut/1000,1)} m</b><span>${T('Schnittlänge','cut length','snijlengte')}</span></div><div><b>${A.nf(L.eng/1000,1)} m</b><span>${T('Gravur','engraving','gravure')}</span></div></div>
      <div class="st-prev">${sheetSvg(L,L.sheets[0]||{items:[]},0).replace(/^<\?xml[^>]*>\n/,'').replace(/width="\d+mm" height="\d+mm"/,'width="100%"').replace(/stroke-width="0.05"/g,'stroke-width="0.6" vector-effect="non-scaling-stroke"')}</div>
      ${L.over.length?`<p class="wt-warn">${T(`Die Grundplatte (${A.nf(L.baseW,0)} × ${A.nf(L.baseH,0)} mm) passt nicht auf das Laserbett. Passender Maßstab: 1:${fs}.`,`The base plate (${A.nf(L.baseW,0)} × ${A.nf(L.baseH,0)} mm) does not fit the laser bed. Fitting scale: 1:${fs}.`,`De grondplaat (${A.nf(L.baseW,0)} × ${A.nf(L.baseH,0)} mm) past niet op het laserbed. Passende schaal: 1:${fs}.`)} <button class="st-fix" data-fs="${fs}">1:${fs}</button></p>`:''}
      <button class="cta lab-mini" id="stZip">${T('ZIP herunterladen (SVG + DXF + Anleitung)','Download ZIP (SVG + DXF + guide)','ZIP downloaden (SVG + DXF + handleiding)')}</button>${O.last?`<p class="ex-last">${O.last}</p>`:''}`;}
  return h+'</div>';
}
LAB.addTool({id:'studio',order:8,grp:'make',usesSurfaces:true,gate:false,
  icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3 9 4.5-9 4.5-9-4.5Z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16.5 9 4.5 9-4.5"/></svg>',
  label:()=>'Studio',
  sub:()=>T('Diagramme, Explosionszeichnung, Lasercut','Diagrams, exploded view, laser cut','Diagrammen, explosietekening, lasercut'),
  enter(){if(!AR.center)AR.center=A.PIN||A.map.getCenter();if(AR.type==='view')AR.type='circle';},
  leave(){closeOv();},
  render(){
    const d=dia(),k=kpi(),s=ST.stats;
    const area=AR.type==='draw'?T('gezeichnete Fläche','drawn area','getekend gebied'):`r = ${AR.r} m`;
    let h=`<p class="lab-hint">${T('Gebiet wählen, Thema wählen, Stil wählen — dann als Diagramm, Explosionszeichnung oder Lasercut-Modell ausgeben. Jedes Thema misst das Gebiet an einem Ziel.','Pick an area, a theme and a style — then output a diagram, an exploded view or a laser-cut model. Each theme measures the area against a target.','Kies een gebied, thema en stijl — en maak een diagram, explosietekening of lasercut-model. Elk thema meet het gebied aan een doel.')}</p>
      <div class="st-step"><i>1</i>${T('Gebiet','Area','Gebied')} <small>${area}</small></div>
      <div class="wt-chips">${[100,200,400].map(r=>`<button data-r="${r}" class="${AR.type==='circle'&&AR.r===r?'on':''}">r = ${r} m</button>`).join('')}<button data-draw>${T('Zeichnen','Draw','Tekenen')}</button></div>
      <div class="st-step"><i>2</i>${T('Thema','Theme','Thema')}</div>
      <div class="st-dias">${DIA.map(x=>`<button data-d="${x.id}" class="${x.id===d.id?'on':''}" aria-pressed="${x.id===d.id}">${x.ic}<span>${x.n()}</span></button>`).join('')}</div>`;
    if(ST.busy||EXT.busy===d.ext&&d.ext)h+=`<p class="lab-hint"><span class="lab-spin" aria-hidden="true"></span> ${d.ext==='sky'?T('Himmelssicht wird aus dem Oberflächenmodell berechnet …','Computing sky view from the surface model …','Hemelzicht wordt berekend uit het oppervlaktemodel …'):d.ext==='walk'?T('Gehminuten werden auf dem Wegenetz berechnet …','Computing walking minutes on the road network …','Loopminuten worden berekend op het wegennet …'):d.ext==='hab'?T('Baumgattungen und Artbeobachtungen werden gezählt …','Counting tree genera and species observations …','Boomgeslachten en waarnemingen worden geteld …'):T('Gebiet wird ausgewertet …','Analysing area …','Gebied wordt geanalyseerd …')}</p>`;
    else if(d.ext&&EXT[d.ext]&&EXT[d.ext].err)h+=`<p class="wt-warn">${T('Die Daten für dieses Framework sind gerade nicht erreichbar.','The data for this framework is currently unreachable.','De data voor dit framework zijn nu niet bereikbaar.')}</p>`;
    else if(k){h+=`<div class="st-kpi"><div class="st-big"><b>${k.big}</b><span>${k.unit}</span></div>`;
      if(k.target!=null&&k.v!=null){const ok=k.better==='high'?k.v>=k.target:k.v<=k.target;h+=`<div class="st-bar"><u style="width:${Math.min(100,k.v)}%;background:${ok?'#3f7f6a':'#c8553d'}"></u><s style="left:${k.target}%"></s></div><div class="st-tg"><span class="chip2 ${ok?'ok':'bad'}">${ok?T('Ziel erreicht','target met','doel gehaald'):T(`${A.nf(Math.abs(k.target-k.v),0)} Punkte unter dem Ziel`,`${A.nf(Math.abs(k.target-k.v),0)} points below target`,`${A.nf(Math.abs(k.target-k.v),0)} punten onder het doel`)}</span><small>${T('Ziel','target','doel')} ${k.target} %</small></div>`;}
      h+=`<p class="st-sub">${k.sub}</p>`;
      if(d.legend)h+=`<div class="ar-bl st-leg">${d.legend().map(([c,l],i)=>`<span><i style="background:${c}"></i>${l}${k.parts&&s&&s.foot?` <em>${A.nf(100*k.parts[i]/s.foot,0)} %</em>`:''}</span>`).join('')}</div>`;
      if(d.wms&&ST.wms)h+=ST.wms.err?`<p class="wt-warn">${T('Der Kartendienst antwortet gerade nicht.','The map service is not responding right now.','De kaartdienst reageert nu niet.')}</p>`:`<img class="st-wl" alt="${T('Legende','Legend','Legenda')}" src="${ST.wms.legend}">`;
      if(k.ets)h+=etsBlock();
      h+=`<p class="st-goal">${d.goal()}</p></div>`;}
    h+=`<div class="st-step"><i>3</i>${T('Stil','Style','Stijl')}</div><div class="st-stys">${Object.entries(STY).map(([id,S])=>`<button data-s="${id}" class="${ST.sty===id?'on':''}" aria-pressed="${ST.sty===id}"><i style="background:linear-gradient(135deg,${S.bg} 0 50%,${S.bld} 50% 70%,${S.green} 70%)"></i>${S.n()}</button>`).join('')}</div>
      <div class="st-step"><i>4</i>${T('Ausgabe','Output','Uitvoer')}</div>
      <div class="ex-fmt"><button data-x="svg"><b>${T('Diagramm','Diagram','Diagram')}</b><span>${T('SVG mit Legende und Kennzahl','SVG with legend and figure','SVG met legenda en kengetal')}</span></button>
        <button data-x="axo"><b>${T('Explosion','Exploded','Explosie')}</b><span>${T('Ebenen axonometrisch, mit Zielen','layers in axonometry, with targets','lagen axonometrisch, met doelen')}</span></button>
        <button data-x="laser" class="${ST.laser.open?'on':''}"><b>Lasercut</b><span>${T('Platten für Modellbau','sheets for model making','platen voor maquettebouw')}</span></button></div>`;
    if(ST.laser.open)h+=laserPanel();
    return h;
  },
  bind(root){
    root.querySelectorAll('[data-r]').forEach(el=>el.onclick=()=>{AR.type='circle';AR.r=+el.dataset.r;AR.center=AR.center||A.map.getCenter();ST.laser.res=null;fitA();compute().then(loadWms);});
    const dr=root.querySelector('[data-draw]');if(dr)dr.onclick=()=>{AR.type='draw';AR.pts=[];AR.done=false;A.setTool('area');};
    root.querySelectorAll('[data-d]').forEach(el=>el.onclick=()=>{ST.dia=el.dataset.d;loadWms();A.rerender();A.req();ensureExt();});
    root.querySelectorAll('[data-s]').forEach(el=>el.onclick=()=>{ST.sty=el.dataset.s;A.rerender();A.req();});
    root.querySelectorAll('[data-x]').forEach(el=>el.onclick=async()=>{const x=el.dataset.x;
      if(x==='laser'){ST.laser.open=!ST.laser.open;A.rerender();return;}
      if(!ST.stats)await compute();el.disabled=true;
      if(x==='svg'){const svg=await diagramSvg();overlay(svg,`${dia().n()} · ${T('Diagramm','Diagram','Diagram')}`);}
      if(x==='axo')overlay(axoSvg(),T('Explosionszeichnung','Exploded view','Explosietekening'));
      el.disabled=false;});
    root.querySelectorAll('[data-lo]').forEach(el=>el.onclick=()=>{const k=el.dataset.lo,v=el.dataset.v;ST.laser[k]=k==='bed'?v:+v;if(k==='scale')ST.laser.touched=true;ST.laser.res=null;A.rerender();});
    root.querySelectorAll('[data-lc]').forEach(el=>el.onchange=()=>{ST.laser[el.dataset.lc]=el.checked;ST.laser.res=null;});
    const fx=root.querySelector('[data-fs]');if(fx)fx.onclick=()=>{ST.laser.scale=+fx.dataset.fs;ST.laser.touched=true;runLaser();};
    const lz=root.querySelector('#stLz');if(lz)lz.onclick=runLaser;
    const zp=root.querySelector('#stZip');if(zp)zp.onclick=()=>{const L=ST.laser.res;if(!L)return;const z=zip(laserFiles(L)),name=`inspector-nice_lasercut_1-${ST.laser.scale}_${stamp()}.zip`;
      const n=download(name,new Blob([z],{type:'application/zip'}));ST.laser.last=`${name} · ${(n/1024).toFixed(0)} KB`;A.rerender();};
  },
  async load(){if(!ST.stats&&!ST.busy&&AREA.ring())compute().then(loadWms);},
  moved(){},
  draw(g,X){drawDia(g,X);},
  click(e){if(AR.type!=='circle')return null;AR.center=e.latlng;ST.laser.res=null;compute().then(loadWms);A.req();return null;},
  note:()=>T('Gebäude mit Mittelpunkt im Gebiet (3D BAG: gemessene Höhe, Baujahr, Dachflächen). Flächen aus der BGT (nur gültige Objekte), Bäume aus dem Register mit gemessener Höhe (AHN). Schatten geometrisch für den 21. Juni, 15 Uhr. Lärm und Wasser als amtliche Kartenbilder (RIVM, LIWO). Baujahr ist ein Hinweis auf den Energiebedarf, kein Dämmzustand; CO₂ aus Erdgas mit 1,779 kg je m³ (RVO-Energieträgerliste 2026), ETS-2-Preis als Annahme. Lasercut: Höhen auf ganze Schichten gerundet, Gelände flach.','Buildings with their centre in the area (3D BAG: measured height, build year, roof areas). Surfaces from the BGT (valid objects only), trees from the register with measured height (AHN). Shade geometric for 21 June, 3 pm. Noise and water as official map images (RIVM, LIWO). Build year hints at energy demand, not insulation; CO₂ from natural gas at 1.779 kg per m³ (RVO 2026), ETS 2 price is an assumption. Laser cut: heights rounded to whole layers, flat terrain.','Gebouwen met middelpunt in het gebied (3D BAG: gemeten hoogte, bouwjaar, dakvlakken). Vlakken uit de BGT (alleen geldige objecten), bomen uit het register met gemeten hoogte (AHN). Schaduw geometrisch voor 21 juni, 15 uur. Geluid en water als officiële kaartbeelden (RIVM, LIWO). Bouwjaar is een aanwijzing voor energievraag, geen isolatiestaat; CO₂ uit aardgas 1,779 kg per m³ (RVO 2026), ETS 2-prijs als aanname. Lasercut: hoogtes afgerond op hele lagen, vlak maaiveld.'),
  src:()=>`3D BAG (TU Delft / 3DGI, CC BY 4.0) · BGT · ${T('Baumregister Gemeente Utrecht','Tree register, Gemeente Utrecht','Bomenregister gemeente Utrecht')} · RIVM · LIWO · CBS`
});
async function runLaser(){const O=ST.laser;if(O.busy)return;O.busy=true;A.rerender();
  try{if(!src())await snapshot();O.res=await buildLaser();
    if(O.res.over.includes(O.res.parts[0])&&!O.touched){O.scale=fitScale(O.res);O.res=await buildLaser();O.auto=true;}else O.auto=false;}catch(e){O.res=null;}O.busy=false;A.rerender();}
function fitA(){const r=AREA.ring();if(!r)return;const b=L.latLngBounds(r);if(!A.map.getBounds().contains(b)&&A.map.getSize().x)A.map.fitBounds(b.pad(.15),{maxZoom:18});}
LAB.studio={SN,snapshot,ST,EXT,ensureExt,skyCalc,walkCalc,habCalc,DIA,STY,compute,kpi,diagramSvg,axoSvg,buildLaser,laserFiles,unionRings,piecesOf,strokeText,zip,crc32,sheetSvg,sheetDxf,refSun};
})();

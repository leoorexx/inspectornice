// ══════════════════════════════════════════════════════════════
// Straßenlabor · Werkzeug „Standort" — Umfeld-Profil eines Ortes (Wohnen, Büro, Planung).
// Amtlich: BAG-Verblijfsobjecte nach Nutzung (nur reine Nutzung, in Gebrauch) und Baumregister;
// Grün in Gehweite aus der BGT; OpenStreetMap live nur für Haltestellen. Gezählt wird Verfügbarkeit, nicht Qualität.
// Klima am Ort: Wärmeinsel (RIVM) und Quartierswerte der Stadtkarte.
// ══════════════════════════════════════════════════════════════
(function(){
'use strict';
const LAB=window.LAB;if(!LAB||!LAB.api)return;
const A=LAB.api,T=(d,e,n)=>A.T(d,e,n);
const SC={pt:null,res:null,busy:false,uhi:null,job:0,photo:null};
const CATS=[
  {k:'shop',g:'winkelfunctie',r:500,goal:[6,2],col:'#c9a53f',de:'Läden und Nahversorgung',en:'Shops and daily needs',nl:'Winkels en dagelijkse boodschappen'},
  {k:'meet',g:'bijeenkomstfunctie',r:500,goal:[6,2],col:'#c97b4f',de:'Gastronomie, Kultur, Treffpunkte',en:'Food, culture, meeting places',nl:'Horeca, cultuur, ontmoetingsplekken'},
  {k:'edu',g:'onderwijsfunctie',r:800,goal:[2,1],col:'#7c3aed',de:'Schulen und Bildung',en:'Schools and education',nl:'Scholen en onderwijs'},
  {k:'health',g:'gezondheidszorgfunctie',r:800,goal:[2,1],col:'#b34a4a',de:'Gesundheit und Pflege',en:'Health and care',nl:'Zorg'},
  {k:'sport',g:'sportfunctie',r:800,goal:[1,1],col:'#0e8ac9',de:'Sport',en:'Sport',nl:'Sport'},
  {k:'ov',osm:true,r:400,goal:[2,1],col:'#3a3646',de:'Haltestellen (Bus, Tram, Bahn)',en:'Stops (bus, tram, rail)',nl:'Haltes (bus, tram, trein)'},
  {k:'green',bgt:true,r:300,goal:[2,.5],unit:'ha',col:'#5f7a52',de:'Grünflächen',en:'Green space',nl:'Groen'}];
const IN_USE=/^Verblijfsobject in gebruik|^Verbouwing verblijfsobject/;
const dist=(la1,lo1,la2,lo2)=>{const x=(lo2-lo1)*111320*Math.cos(la1*Math.PI/180),y=(la2-la1)*110574;return Math.hypot(x,y);};
const box=(la,lo,r)=>{const dy=r/110574,dx=r/(111320*Math.cos(la*Math.PI/180));return [lo-dx,la-dy,lo+dx,la+dy].map(v=>v.toFixed(6)).join(',');};
async function bag(c,la,lo){
  const u=`https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?bbox=${box(la,lo,c.r)}&gebruiksdoel=${c.g}&limit=1000&f=json`;
  const sig=typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(15000):undefined;
  const j=await fetch(u,{signal:sig}).then(r=>{if(!r.ok)throw 0;return r.json();});
  return (j.features||[]).filter(f=>f.geometry&&IN_USE.test(f.properties.status||'')).map(f=>{const [x,y]=f.geometry.coordinates;return {lat:y,lon:x,name:[f.properties.openbare_ruimte_naam,f.properties.huisnummer].filter(Boolean).join(' ')};});
}
// Grün in Gehweite aus der BGT (begroeidterreindeel, nur aktuelle Objekte, ohne Landwirtschaft): Fläche in ha, deren Mitte ≤ 300 m liegt
const AGRI=/^(grasland agrarisch|bouwland|fruitteelt|boomteelt)$/;
async function green(la,lo,r){
  const sig=typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(15000):undefined;
  let url=`https://api.pdok.nl/lv/bgt/ogc/v1/collections/begroeidterreindeel/items?bbox=${box(la,lo,r)}&filter=${encodeURIComponent('eind_registratie IS NULL')}&filter-lang=cql2-text&limit=1000&f=json`,ha=0,n=0,near=null;
  for(let k=0;k<6&&url;k++){const j=await fetch(url,{signal:sig}).then(x=>{if(!x.ok)throw 0;return x.json();});
    for(const f of j.features||[]){const g=f.geometry,p=f.properties||{};if(!g||AGRI.test(p.fysiek_voorkomen||''))continue;const ring=g.type==='Polygon'?g.coordinates[0]:g.type==='MultiPolygon'?g.coordinates[0][0]:null;if(!ring||ring.length<4)continue;
      let a=0,cx=0,cy=0;const k0=111320*Math.cos(la*Math.PI/180),k1=110574;for(let i=0,j2=ring.length-1;i<ring.length;j2=i++){const x0=(ring[j2][0]-lo)*k0,y0=(ring[j2][1]-la)*k1,x1=(ring[i][0]-lo)*k0,y1=(ring[i][1]-la)*k1,c=x0*y1-x1*y0;a+=c;cx+=(x0+x1)*c;cy+=(y0+y1)*c;}
      if(Math.abs(a)<1)continue;cx/=3*a;cy/=3*a;const d=Math.hypot(cx,cy);if(d>r)continue;ha+=Math.abs(a)/2/10000;n++;if(near==null||d<near)near=d;}
    const nx=(j.links||[]).find(l=>l.rel==='next');url=nx?nx.href:null;}
  return {ha,n,near:near==null?null:Math.round(near)};
}
const OVP=['https://overpass-api.de/api/interpreter','https://z.overpass-api.de/api/interpreter'];
async function osm(la,lo){
  const q=`[out:json][timeout:10];(node["highway"="bus_stop"](around:400,${la},${lo});node["railway"~"^(tram_stop|station|halt)$"](around:400,${la},${lo}););out 200;`;
  for(const h of OVP){try{const sig=typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(9000):undefined;const t=await fetch(h,{method:'POST',body:'data='+encodeURIComponent(q),referrerPolicy:'origin',signal:sig}).then(r=>r.ok?r.text():Promise.reject());if(!t.trim().startsWith('{'))continue;
    const els=JSON.parse(t).elements||[];const pick=m=>els.filter(e=>m(e.tags||{})).map(e=>({lat:e.lat!=null?e.lat:e.center&&e.center.lat,lon:e.lon!=null?e.lon:e.center&&e.center.lon,name:(e.tags||{}).name||''})).filter(p=>p.lat!=null);
    return {ov:pick(t=>t.highway==='bus_stop'||/^(tram_stop|station|halt)$/.test(t.railway||''))};}catch(e){}}
  return null;
}
// Straßenfoto in der Nähe (Panoramax, offene Straßenbilder, CC BY-SA)
async function photo(la,lo){
  const d=.0007,j=await fetch(`https://api.panoramax.xyz/api/search?bbox=${lo-d*1.6},${la-d},${lo+d*1.6},${la+d}&limit=40`).then(r=>r.ok?r.json():null).catch(()=>null);
  let best=null,bd=Infinity;for(const f of (j&&j.features)||[]){const c=f.geometry&&f.geometry.coordinates,a=f.assets||{};if(!c||!a.thumb)continue;const dd=dist(la,lo,c[1],c[0]);if(dd<bd){bd=dd;best=f;}}
  if(!best||bd>90)return null;const pr=best.properties||{};
  return {id:best.id,thumb:best.assets.sd?best.assets.sd.href:best.assets.thumb.href,by:(pr.providers&&pr.providers[0]&&pr.providers[0].name)||pr['geovisio:producer']||'',date:(pr.datetime||'').slice(0,10),d:Math.round(bd),lic:pr.license||'CC-BY-SA-4.0'};
}
async function analyse(ll){
  const job=++SC.job,la=+ll.lat.toFixed(5),lo=+ll.lng.toFixed(5);SC.pt={lat:la,lon:lo};SC.res=null;SC.busy=true;SC.uhi=null;SC.photo=null;
  photo(la,lo).then(p=>{if(job!==SC.job)return;SC.photo=p;if(SC.res)A.rerender();});A.PIN=ll;A.rerender();A.req();
  A.status(T('Umfeld wird abgefragt (BAG, OpenStreetMap) …','Querying surroundings (BAG, OpenStreetMap) …','Omgeving wordt opgevraagd (BAG, OpenStreetMap) …'),true);
  const mk=(c,raw)=>{if(raw===undefined)return {...c,wait:true};if(!raw)return {...c,fail:true};
    const pts=raw.map(p=>({...p,d:Math.round(dist(la,lo,p.lat,p.lon))})).filter(p=>p.d<=c.r).sort((a,b)=>a.d-b.d);
    const n=pts.length,st=n>=c.goal[0]?'good':n>=c.goal[1]?'ok':'poor';return {...c,n,st,near:n?pts[0].d:null,pts:pts.slice(0,300)};};
  const op=osm(la,lo).catch(()=>null),gp=green(la,lo,300).catch(()=>null);   // OpenStreetMap ist langsam: amtliche Werte zuerst zeigen
  const bags=await Promise.all(CATS.filter(c=>c.g).map(c=>bag(c,la,lo).catch(()=>null)));
  if(job!==SC.job)return;
  const gr=await gp;if(job!==SC.job)return;
  let bi=0;SC.res=CATS.map(c=>c.bgt?(gr?{...c,n:Math.round(gr.ha*10)/10,cnt:gr.n,near:gr.near,st:gr.ha>=c.goal[0]?'good':gr.ha>=c.goal[1]?'ok':'poor',pts:[]}:{...c,fail:true}):mk(c,c.g?bags[bi++]:undefined));SC.busy=false;A.rerender();A.req();
  A.status(T('Haltestellen werden aus OpenStreetMap geladen …','Loading stops from OpenStreetMap …','Haltes worden uit OpenStreetMap geladen …'),true);
  const o=await op;if(job!==SC.job)return;
  SC.res=SC.res.map(c=>c.osm?mk(c,o?o[c.k]:null):c);A.status('');
  try{const u=A.uhiAt(la,lo);SC.uhi=u&&u.then?await u:u;}catch(e){SC.uhi=null;}
  if(job!==SC.job)return;A.rerender();A.req();
}
const stCol=st=>st==='good'?'var(--pos)':st==='ok'?'var(--warn)':'var(--neg)';
const stLbl=st=>st==='good'?T('gut','good','goed'):st==='ok'?T('ausreichend','fair','voldoende'):T('knapp','scarce','schaars');
function total(){const R=(SC.res||[]).filter(c=>!c.fail&&!c.wait);if(!R.length)return null;const v={good:100,ok:60,poor:20};return Math.round(R.reduce((s,c)=>s+v[c.st],0)/R.length);}
function climate(){
  const NX=window.__NX,o=A.opt(),b=o.buurtAt&&SC.pt?o.buurtAt(SC.pt.lat,SC.pt.lon):null;if(!b||!NX)return '';
  const s=NX.score(b),g=NX.grade(s),R=NX.RISKS.filter(r=>!r.city),trees=(A.TREES||[]).filter(t=>Math.abs(t[0]-SC.pt.lat)<.0012&&Math.abs(t[1]-SC.pt.lon)<.002&&dist(SC.pt.lat,SC.pt.lon,t[0],t[1])<=100).length;
  return `<div class="h sc-h">${T('Klima am Ort','Climate here','Klimaat ter plekke')}</div>
    <div class="sc-cl">${s!=null?`<div><span class="nxg${g>=3?' lt':''}" style="--c:${NX.scol(s)}">${NX.GR[g][1]}</span><span>${T('Klimabelastung','Climate burden','Klimaatbelasting')} ${Math.round(s)}/100 · ${b.name}</span></div>`:''}
    ${SC.uhi!=null&&isFinite(SC.uhi)?`<div><b>+${A.nf(SC.uhi,1)} °C</b><span>${T('Wärmeinsel genau hier (RIVM)','heat island right here (RIVM)','hitte-eiland precies hier (RIVM)')}</span></div>`:''}
    <div><b>${A.fmt(trees)}</b><span>${T('Bäume im Umkreis von 100 m (Register der Gemeente)','trees within 100 m (municipal register)','bomen binnen 100 m (gemeenteregister)')}</span></div>
    ${R.map(r=>{const v=r.v(b);return v==null?'':`<div><b class="${r.over(v)?'bad':''}">${r.f(v)}</b><span>${T(r.de,r.en,r.nl)} ${T('im Quartier','in the neighbourhood','in de buurt')} · ${T('Richtwert','guideline','richtwaarde')} ${r.lim}</span></div>`;}).join('')}</div>`;
}
function body(){
  if(!SC.pt)return `<div class="sx-empty"><svg viewBox="0 0 120 54" width="120" height="54" aria-hidden="true"><circle cx="60" cy="27" r="24" fill="none" stroke="var(--line2)" stroke-dasharray="3 4"/><circle cx="60" cy="27" r="14" fill="none" stroke="var(--line2)" stroke-dasharray="3 4"/><circle cx="60" cy="27" r="4" fill="var(--ink)"/><circle cx="76" cy="16" r="3" fill="#c9a53f"/><circle cx="44" cy="36" r="3" fill="#7c3aed"/><circle cx="70" cy="42" r="3" fill="#5f7a52"/></svg><p>${T('Tippe auf einen Ort: Was liegt in Gehweite (400 bis 800 m), und wie steht es dort um Hitze, Lärm und Grün?','Tap a place: what is within walking distance (400 to 800 m), and how are heat, noise and green there?','Tik op een plek: wat ligt op loopafstand (400 tot 800 m), en hoe staat het daar met hitte, geluid en groen?')}</p></div>`;
  if(SC.busy&&!SC.res)return `<p class="lab-mute">${T('Wird abgefragt …','Querying …','Wordt opgevraagd …')}</p>`;
  const tot=total(),R=SC.res||[];
  return `<div class="sc-top"><svg viewBox="0 0 64 64" width="60" height="60" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="none" stroke="var(--line2)" stroke-width="5"/>${tot!=null?`<circle cx="32" cy="32" r="27" fill="none" style="stroke:${tot>=75?'var(--pos)':tot>=50?'var(--warn)':'var(--neg)'}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(tot/100*169.6).toFixed(1)} 170" transform="rotate(-90 32 32)"/>`:''}<text x="32" y="38" text-anchor="middle" class="sc-num">${tot!=null?tot:'–'}</text></svg>
      <div><b>${T('Versorgung in Gehweite','Amenities within walking distance','Voorzieningen op loopafstand')}</b><span>${T('Mittel der Kategorien: gut 100, ausreichend 60, knapp 20. Zählt, was da ist — nicht, wie gut es ist.','Mean of the categories: good 100, fair 60, scarce 20. Counts what is there — not how good it is.','Gemiddelde van de categorieën: goed 100, voldoende 60, schaars 20. Telt wat er is — niet hoe goed.')}</span></div></div>
    <div class="sc-list">${R.map(c=>`<div class="sc-row"><i style="background:${c.col}"></i><div class="sc-n"><b>${T(c.de,c.en,c.nl)}</b><small>≤ ${c.r} m · ${c.g?'BAG':c.bgt?'BGT':'OpenStreetMap'}</small></div>${c.wait?`<em class="sc-f">${T('lädt …','loading …','laden …')}</em>`:c.fail?`<em class="sc-f">${T('gerade nicht erreichbar','currently unavailable','nu niet bereikbaar')}</em>`:`<div class="sc-v"><b>${c.unit?A.nf(c.n,1)+' ha':c.n}</b><small style="color:${stCol(c.st)}">${stLbl(c.st)}${c.near!=null?' · '+c.near+' m':''}</small></div>`}</div>`).join('')}</div>
    ${SC.photo?`<figure class="sc-ph"><a href="https://api.panoramax.xyz/#focus=pic&pic=${SC.photo.id}" target="_blank" rel="noopener"><img src="${SC.photo.thumb}" alt="${T('Straßenfoto','Street photo','Straatfoto')} ${SC.photo.d} m ${T('vom Punkt','from the point','van het punt')}" loading="lazy"></a><figcaption>${T('So sieht es hier aus','What it looks like here','Zo ziet het er hier uit')} · ${SC.photo.d} m · ${SC.photo.date} · ${T('Foto','Photo','Foto')}: ${SC.photo.by} · ${SC.photo.lic.replace(/^CC-/,'CC ').replace(/-(\d)/,' $1')} · Panoramax</figcaption></figure>`:''}
    ${climate()}
    <button class="cta ghost lab-mini" id="scSun">${A.IC.sun||''}<span>${T('Besonnung an diesem Ort ansehen','See sunlight at this place','Bezonning op deze plek bekijken')}</span></button>
    <p class="lab-mute">${T('BAG zählt Einheiten mit genau einer Nutzung (gemischt genutzte fehlen) — eher zu wenig als zu viel. Grün: Pflanzflächen der BGT, deren Mitte höchstens 300 m entfernt ist (ab 0,5 ha ausreichend, ab 2 ha gut — angelehnt an die WHO). OpenStreetMap ist je nach Stadtteil unvollständig.','BAG counts units with exactly one use (mixed-use ones are missing) — rather too few than too many. Green: planted areas from the BGT whose centre is within 300 m (0.5 ha fair, 2 ha good — based on WHO guidance). OpenStreetMap is incomplete in some districts.','BAG telt eenheden met precies één gebruiksdoel (gemengde ontbreken) — eerder te weinig dan te veel. Groen: begroeide vlakken uit de BGT waarvan het midden binnen 300 m ligt (vanaf 0,5 ha voldoende, vanaf 2 ha goed — naar de WHO). OpenStreetMap is per wijk onvolledig.')}</p>`;
}
LAB.addTool({id:'standort',order:5.5,grp:'check',gate:false,keepStatus:true,
  icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  label:()=>T('Standort','Location','Locatie'),
  sub:()=>T('Was liegt in Gehweite — und wie ist das Klima dort?','What is within walking distance — and what is the climate like?','Wat ligt op loopafstand — en hoe is het klimaat daar?'),
  render:body,
  bind(root){const b=root.querySelector('#scSun');if(b)b.onclick=()=>{A.setTool('sun');};},
  draw(g,X){
    if(!A.tooFar()&&A.B.list.length){const dark=A.dark();A.drawBuildings(g,X,dark?'rgba(60,56,66,.35)':'rgba(251,249,244,.45)',dark?'rgba(255,255,255,.16)':'rgba(23,21,28,.2)');}
    if(!SC.pt)return;const [wx,wy]=A.w20(SC.pt.lat,SC.pt.lon),cx=wx*X.k-X.ox,cy=wy*X.k-X.oy,px=m=>m/A.mpp()*X.sc,dark=A.dark();
    g.save();g.setLineDash([4*X.sc,5*X.sc]);g.lineWidth=1.2*X.sc;
    for(const [r,a] of [[400,.7],[500,.5],[800,.4]]){g.strokeStyle=dark?`rgba(243,239,231,${a})`:`rgba(23,21,28,${a})`;g.beginPath();g.arc(cx,cy,px(r),0,2*Math.PI);g.stroke();}
    g.setLineDash([]);
    for(const c of (SC.res||[])){if(!c.pts)continue;g.fillStyle=c.col;g.strokeStyle=dark?'rgba(0,0,0,.6)':'#fff';g.lineWidth=1*X.sc;
      for(const p of c.pts){const [x,y]=A.w20(p.lat,p.lon),qx=x*X.k-X.ox,qy=y*X.k-X.oy;g.beginPath();g.arc(qx,qy,3.6*X.sc,0,2*Math.PI);g.fill();g.stroke();}}
    g.fillStyle=dark?'#f3efe7':'#17151c';g.strokeStyle='#FFD600';g.lineWidth=2.5*X.sc;g.beginPath();g.arc(cx,cy,7*X.sc,0,2*Math.PI);g.fill();g.stroke();
    g.font=`700 ${12*X.sc}px "DM Sans",sans-serif`;g.fillStyle=dark?'rgba(243,239,231,.85)':'rgba(23,21,28,.8)';
    for(const r of [400,800]){g.fillText(r+' m',cx+px(r)*.71+4*X.sc,cy-px(r)*.71-4*X.sc);}
    g.restore();},
  click(e){analyse(e.latlng);return null;},
  note:()=>T('Läden, Gastronomie und Kultur, Bildung, Gesundheit und Sport aus dem amtlichen Gebäuderegister BAG: Wohn- und Gewerbeeinheiten mit genau dieser Nutzung, in Gebrauch oder im Umbau, Luftlinie zum Punkt. Grünflächen aus der BGT (Pflanzflächen ohne Landwirtschaft, Mitte ≤ 300 m). Haltestellen live aus OpenStreetMap. Bewertung je Kategorie über einfache Schwellen (zum Beispiel 6 Läden in 500 m = gut) — ein Richtmaß für den Vergleich von Orten, keine Qualitätsaussage.','Shops, food and culture, education, health and sport from the official building register BAG: units with exactly this use, in use or under renovation, straight-line distance. Green space from the BGT (planted areas without farmland, centre ≤ 300 m). Stops live from OpenStreetMap. Each category is rated with simple thresholds (for example 6 shops within 500 m = good) — a yardstick for comparing places, not a statement on quality.','Winkels, horeca en cultuur, onderwijs, zorg en sport uit de BAG: eenheden met precies dit gebruiksdoel, in gebruik of in verbouwing, hemelsbreed. Groen uit de BGT (begroeide vlakken zonder landbouw, midden ≤ 300 m). Haltes live uit OpenStreetMap. Per categorie eenvoudige drempels (bijvoorbeeld 6 winkels binnen 500 m = goed) — een maatstaf om plekken te vergelijken, geen kwaliteitsoordeel.'),
  src:()=>'BAG, BGT (Kadaster / PDOK) · OpenStreetMap (ODbL) · RIVM · Panoramax (CC BY-SA) · '+T('Baumregister Gemeente Utrecht','tree register Gemeente Utrecht','bomenregister gemeente Utrecht')
});
LAB.standort={SC,CATS,analyse,total};
})();

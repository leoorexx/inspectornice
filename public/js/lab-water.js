// ══════════════════════════════════════════════════════════════
// Straßenlabor · Werkzeug „Wasser" — wie Climate Central, aber amtlich:
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
const CLS=[{k:1,p:10,n:['grote kans','large probability','grote kans']},{k:2,p:100,n:['middelgrote kans','medium probability','middelgrote kans']},
  {k:3,p:1000,n:['kleine kans','small probability','kleine kans']},{k:4,p:10000,n:['zeer kleine kans','very small probability','zeer kleine kans']},
  {k:5,p:100000,n:['extreem kleine kans','extremely small probability','extreem kleine kans']}];
const lname=k=>`LIWO_Basis:MaximaleWaterdiepteNederland_Kaart${k}`;
const W={mode:'flood',k:3,layer:null,legend:null,level:0,dem:null,demKey:'',img:null,yr:'huidig',cm:20,chLegend:null};
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

// ── Werkzeug ──
LAB.addTool({id:'water',order:4,gate:false,keepStatus:true,
  icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 9c1.7-1.6 3.3-1.6 5 0s3.3 1.6 5 0 3.3-1.6 5 0 3.3 1.6 5 0"/><path d="M2 15c1.7-1.6 3.3-1.6 5 0s3.3 1.6 5 0 3.3-1.6 5 0 3.3 1.6 5 0"/></svg>',
  label:()=>T('Wasser','Water','Water'),
  sub:()=>W.mode==='flood'?T('Amtliche Überflutungstiefen','Official flood depths','Officiële overstromingsdiepten'):W.mode==='chance'?T('Überflutungswahrscheinlichkeit heute, 2050, 2100','Flood probability today, 2050, 2100','Overstromingskans nu, 2050, 2100'):T('Geländehöhe und Wasserstand','Terrain height and water level','Maaiveldhoogte en waterstand'),
  enter(){showLayer();Promise.all([legend(),chLegend()]).then(()=>A.rerender());},
  leave(){if(W.layer){A.map.removeLayer(W.layer);W.layer=null;}},
  render(){
    const modes=A.seg([['flood',T('Tiefe','Depth','Diepte')],['chance',T('Zukunft','Future','Toekomst')],['terrain',T('Höhe','Height','Hoogte')]],W.mode);
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
    root.querySelectorAll('.wt-cls [data-k]').forEach(el=>el.onclick=()=>{W.k=+el.dataset.k;showLayer();A.rerender();});
    root.querySelectorAll('[data-y]').forEach(el=>el.onclick=()=>{W.yr=el.dataset.y;showLayer();A.rerender();});
    root.querySelectorAll('[data-c]').forEach(el=>el.onclick=()=>{W.cm=+el.dataset.c;showLayer();A.rerender();});
    const sl=root.querySelector('#wtL');if(sl)sl.oninput=()=>{W.level=+sl.value;root.querySelector('#wtV').textContent=A.nf(W.level,1)+' m NAP';paint();A.req();const s=root.querySelector('#wtS b');if(s)s.textContent=Math.round(100*(W.below||0))+' %';root.querySelectorAll('.wt-chips [data-l]').forEach(b=>b.classList.toggle('on',Math.abs(W.level-+b.dataset.l)<.05));};
    root.querySelectorAll('.wt-chips [data-l]').forEach(el=>el.onclick=()=>{W.level=+el.dataset.l;paint();A.rerender();A.req();});
  },
  async load(){
    if(W.mode!=='terrain'){A.status('');return;}
    if(A.map.getZoom()<14){W.dem=null;A.status(T('Für das Höhenmodell näher heranzoomen (ab Zoom 14).','Zoom in further for the elevation model (level 14+).','Zoom verder in voor het hoogtemodel (vanaf niveau 14).'));A.rerender();return;}
    try{await loadDem();paint();A.rerender();}catch(e){A.status(T('Höhenmodell gerade nicht erreichbar.','Elevation model currently unavailable.','Hoogtemodel momenteel niet bereikbaar.'));}
  },
  draw(g,X){
    const dark=A.dark();
    if(W.mode==='terrain'&&W.dem&&W.img){const D=W.dem,P=(x,y)=>{const ll=A.fromRD(x,y),q=A.w20(ll[0],ll[1]);return [q[0]*X.k-X.ox,q[1]*X.k-X.oy];};
      const tl=P(D.x0,D.y1),tr=P(D.x1,D.y1),bl=P(D.x0,D.y0);
      g.save();g.imageSmoothingEnabled=true;g.setTransform((tr[0]-tl[0])/D.w,(tr[1]-tl[1])/D.w,(bl[0]-tl[0])/D.h,(bl[1]-tl[1])/D.h,tl[0],tl[1]);g.drawImage(W.img,0,0);g.restore();}
    if(!A.tooFar()&&A.B.list.length)A.drawBuildings(g,X,W.mode==='terrain'?(dark?'rgba(60,56,66,.5)':'rgba(240,236,228,.55)'):null,dark?'rgba(255,255,255,.3)':'rgba(23,21,28,.35)');
  },
  click(e){
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
  note:()=>W.mode==='chance'?T('LIWO „plaatsgebonden overstromingskans": Wahrscheinlichkeit pro Jahr, dass an diesem Ort mehr als die gewählte Wassertiefe auftritt — durch Bruch eines Deichs am Haupt- oder Regionalgewässer oder Überflutung ungeschützter Gebiete. „Heute" nach dem aktuellen Zustand der Primärdeiche; „2050": alle Primärdeiche erfüllen exakt die Norm des Wasserrechts; „2100": zusätzlich Klimawandel. Regionale Deiche jeweils mit der Provinznorm, ohne Notmaßnahmen.','LIWO “location-based flood probability”: annual probability that more than the chosen water depth occurs here — from a dike breach along main or regional waters or flooding of unprotected areas. “Today” reflects the current state of the primary dikes; “2050”: all primary dikes meet the legal standard exactly; “2100”: climate change included as well. Regional dikes at the provincial standard, without emergency measures.','LIWO „plaatsgebonden overstromingskans": kans per jaar dat hier meer dan de gekozen waterdiepte optreedt — door een doorbraak langs het hoofd- of regionale watersysteem of overstromen van onbeschermde gebieden. „Nu" volgens de actuele staat van de primaire keringen; „2050": alle primaire keringen voldoen exact aan de norm uit de Waterwet; „2100": daarnaast klimaatverandering. Regionale keringen met de provinciale norm, zonder noodmaatregelen.'):W.mode==='flood'?T('Amtliche „Maximale waterdiepte Nederland" aus dem LIWO (Landelijk Informatiesysteem Water en Overstromingen, Rijkswaterstaat): zusammengesetzt aus vielen Überflutungsszenarien des Landelijk Databestand Overstromingen. Jede Klasse zeigt, wo Überflutungen etwa so selten auftreten können; die Karten zeigen mögliche Überflutungen, die in Wirklichkeit nicht alle gleichzeitig eintreten.','Official “Maximale waterdiepte Nederland” from LIWO (Rijkswaterstaat’s national flood information system), compiled from many flood scenarios of the national flood database. Each class shows where floods of roughly that rarity can occur; the maps show possible floods that would not all happen at the same time.','Officiële „Maximale waterdiepte Nederland" uit LIWO (Rijkswaterstaat), samengesteld uit vele overstromingsscenario\'s uit het Landelijk Databestand Overstromingen. Elke klasse toont waar overstromingen van ongeveer die zeldzaamheid kunnen voorkomen; de kaarten tonen mogelijke overstromingen die niet allemaal tegelijk optreden.')
    :T('Geländehöhe aus dem AHN (Actueel Hoogtebestand Nederland, Laserscanning, Raster 0,5 m, ohne Gebäude) in Metern über NAP (≈ mittlerer Meeresspiegel). Der Regler färbt alles blau, was tiefer liegt als der gewählte Wasserstand — eine „Badewanne" ohne Deiche, Pumpwerke und Kanäle, keine Überflutungsvorhersage.','Ground height from the AHN (national laser-scanned elevation model, 0.5 m grid, without buildings) in metres above NAP (≈ mean sea level). The slider colours everything blue that lies lower than the chosen water level — a “bathtub” without dikes, pumping stations and canals, not a flood forecast.','Maaiveldhoogte uit het AHN (laserscanning, raster 0,5 m, zonder gebouwen) in meter t.o.v. NAP. De schuif kleurt alles blauw wat lager ligt dan de gekozen waterstand — een „badkuip" zonder dijken, gemalen en kanalen, geen overstromingsverwachting.'),
  src:()=>W.mode!=='terrain'?'LIWO · Rijkswaterstaat (basisinformatie-overstromingen.nl)':'AHN (Rijkswaterstaat / Waterschappen, via PDOK) · 3D BAG'
});
LAB.water={W,CLS,depthAt,demAt,paint,loadDem};
})();
